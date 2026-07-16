import { getStore } from "@netlify/blobs";

/**
 * Account-manager work queue: the cross-member index of work that has arrived.
 *
 * GET  /api/am-queue?showroomId=st-louis               → { items: [...] } newest first
 * GET  /api/am-queue?showroomId=st-louis&status=open   → only open work
 * POST /api/am-queue { action: "enqueue", item }       → { item }
 * POST /api/am-queue { action: "price", showroomId, itemId, memberUserId,
 *                      docId, material, salesTax, service, note? } → { ok, doc }
 * POST /api/am-queue { action: "dismiss", showroomId, itemId }     → { ok }
 *
 * WHY THIS EXISTS: member data lives in PER-USER blobs (`${userId}::orders`,
 * see user-data.mjs). An account manager works ACROSS members, and there is no
 * cross-member index, so the only way to find "every quote nobody has priced"
 * would be to scan every user who has ever signed up. This queue is that index,
 * written at the moment work arrives (cart quote, wizard quote, consultation
 * request) rather than derived by a scan.
 *
 * STORAGE: one blob per showroom, keyed `queue/<showroomId>`, in the "ps-am-queue"
 * store. One blob per showroom rather than one global blob so two showrooms'
 * writes can never contend: an enqueue read-modify-writes exactly one key, and
 * St. Louis submitting a quote cannot lose a Chicago write. Within a showroom
 * two simultaneous enqueues can still race (a known, documented pattern in this
 * codebase), which is why nothing else is kept in this blob: it is an index, and
 * the member's own blob remains the source of truth for the document itself.
 *
 * Demo only. No auth check (nothing else in this codebase has one either).
 */

const STORE_NAME = "ps-am-queue";
const QUEUE_PREFIX = "queue/";

const TYPES = ["quote", "consultation"];
const STATUSES = ["open", "handled"];

const queueStore = () => getStore({ name: STORE_NAME, consistency: "strong" });
const queueKey = (showroomId) => QUEUE_PREFIX + showroomId;

const userDataStore = () => getStore({ name: "ps-user-data", consistency: "strong" });
const ordersKey = (userId) => `${userId}::orders`;

// Matches ORDERS_SCHEMA_VERSION in src/order-model.js. Duplicated rather than
// imported because that module pulls in React, and this is a Node function.
const ORDERS_SCHEMA_VERSION = 2;

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Showroom ids are blob key segments, so keep them to a safe, predictable slug. */
const normalizeShowroomId = (raw) => {
  const id = str(raw).toLowerCase();
  return /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null;
};

const readQueue = async (s, showroomId) => {
  const blob = await s.get(queueKey(showroomId), { type: "json" }).catch(() => null);
  return Array.isArray(blob?.list) ? blob.list : [];
};

const writeQueue = async (s, showroomId, list) =>
  s.setJSON(queueKey(showroomId), { list, updatedAt: Date.now() });

/**
 * Read one showroom's queue from another server module.
 *
 * The seed uses this to avoid enqueueing a quote it has already enqueued: it can
 * re-run (it replaces legacy order blobs), and a duplicate row for one quote is
 * something the account manager would see and have to reason about.
 */
export const readQueueFor = async (showroomId) => readQueue(queueStore(), showroomId);

/** Newest first. An item with no timestamp sorts last rather than disappearing. */
const byNewest = (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0);

/**
 * Validate an incoming item and mint the canonical record.
 *
 * Returns { item } or { error }. Nothing half-valid is ever stored: a queue the
 * account manager cannot act on is worse than a loud 400 at the door.
 */
const buildItem = (raw) => {
  if (!raw || typeof raw !== "object") return { error: "item required" };

  const type = TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return { error: `type must be one of: ${TYPES.join(", ")}` };

  const showroomId = normalizeShowroomId(raw.showroomId);
  if (!showroomId) {
    return { error: "showroomId required (lowercase slug, e.g. st-louis)" };
  }

  // Pricing reaches into the member's own orders blob, so a quote with nobody
  // to price it for is junk. A consultation can arrive from a guest who has no
  // account yet, so that one may legitimately carry null.
  const memberUserId = str(raw.memberUserId) || null;
  if (type === "quote" && !memberUserId) {
    return { error: "memberUserId required for a quote item" };
  }

  const summary = str(raw.summary);
  if (!summary) return { error: "summary required" };

  const submittedAtRaw = Number(raw.submittedAt);
  const itemCountRaw = Number(raw.itemCount);

  return {
    item: {
      // Minted here, never taken from the caller: the id is the handle the
      // console uses to price or dismiss, and a client-chosen one could collide
      // with an item already in the queue and silently retarget those actions.
      id: `amq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      // Enqueue means "this is work nobody has done yet". Always open.
      status: "open",
      showroomId,
      memberUserId,
      memberName: str(raw.memberName) || "Member",
      memberEmail: str(raw.memberEmail).toLowerCase(),
      // The order/estimate id in the member's `orders` blob. Null means there is
      // no document to price (a consultation, or a lead captured before any
      // document existed), and the console can only dismiss it.
      docId: str(raw.docId) || null,
      projectId: str(raw.projectId) || null,
      summary,
      itemCount: Number.isFinite(itemCountRaw) && raw.itemCount != null ? itemCountRaw : null,
      submittedAt: Number.isFinite(submittedAtRaw) && submittedAtRaw > 0 ? submittedAtRaw : Date.now(),
      handledAt: null,
    },
  };
};

/**
 * Add work to a showroom's queue.
 *
 * Exported so the server-side producers (submit-quote, consultation-request)
 * enqueue through the same validation as the HTTP endpoint instead of growing a
 * second, drifting copy of the shape. Throws on invalid input; callers that must
 * not fail the member's own submit catch it and carry on.
 */
export const enqueueItem = async (raw) => {
  const { item, error } = buildItem(raw);
  if (error) throw new Error(error);
  const s = queueStore();
  const list = await readQueue(s, item.showroomId);
  await writeQueue(s, item.showroomId, [item, ...list]);
  return item;
};

/** Flip one item to handled. Returns { item } or { error, status }. */
const markHandled = async (showroomId, itemId) => {
  const s = queueStore();
  const list = await readQueue(s, showroomId);
  const idx = list.findIndex((i) => i?.id === itemId);
  if (idx === -1) {
    return { error: `No queue item ${itemId} in ${showroomId}`, status: 404 };
  }
  const item = { ...list[idx], status: "handled", handledAt: Date.now() };
  const next = [...list];
  next[idx] = item;
  await writeQueue(s, showroomId, next);
  return { item };
};

const readMoney = (v, field) => {
  if (v === null || v === undefined || v === "") return { error: `${field} required` };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { error: `${field} must be a number >= 0` };
  return { value: round2(n) };
};

/**
 * Price a member's quote: the point of this whole feature.
 *
 * Reaches into the member's own `orders` blob, fills in the money the account
 * manager just built, and flips the document to an estimate that is ready to
 * approve. After this the member's Estimates tab stops saying "Quote requested"
 * with no numbers and starts saying "Quote ready to approve" with a real total
 * and a working Approve button.
 *
 * The money field names and the null-vs-zero rule come from src/order-model.js:
 * null means "not priced yet", 0 means "free". Everything written here is a real
 * number, which is exactly what makes the document priced.
 */
const priceQuote = async (body) => {
  const showroomId = normalizeShowroomId(body.showroomId);
  if (!showroomId) return { error: "showroomId required", status: 400 };

  const itemId = str(body.itemId);
  if (!itemId) return { error: "itemId required", status: 400 };

  const memberUserId = str(body.memberUserId);
  if (!memberUserId) return { error: "memberUserId required", status: 400 };

  const docId = str(body.docId);
  if (!docId) return { error: "docId required", status: 400 };

  const material = readMoney(body.material, "material");
  if (material.error) return { error: material.error, status: 400 };
  const salesTax = readMoney(body.salesTax, "salesTax");
  if (salesTax.error) return { error: salesTax.error, status: 400 };
  const service = readMoney(body.service, "service");
  if (service.error) return { error: service.error, status: 400 };

  // The queue item is checked BEFORE the member's blob is touched, and the
  // member + document it names must agree with the request. Pricing the wrong
  // member's document is the one mistake here that is invisible afterwards: the
  // money would simply appear on a stranger's quote.
  const s = queueStore();
  const queue = await readQueue(s, showroomId);
  const queued = queue.find((i) => i?.id === itemId);
  if (!queued) return { error: `No queue item ${itemId} in ${showroomId}`, status: 404 };
  // Only a quote names a document to price. A consultation carries a null
  // docId and a possibly null memberUserId, so the two match checks below would
  // both wave it through and price whatever document the request happened to
  // name. There is nothing to price on a consultation: refuse it here.
  if (queued.type !== "quote") {
    return { error: `Queue item ${itemId} is a ${queued.type}, which has nothing to price`, status: 400 };
  }
  if (!queued.docId) {
    return { error: `Queue item ${itemId} has no document to price`, status: 400 };
  }
  if (queued.memberUserId && queued.memberUserId !== memberUserId) {
    return {
      error: `Queue item ${itemId} belongs to ${queued.memberUserId}, not ${memberUserId}`,
      status: 400,
    };
  }
  if (queued.docId && queued.docId !== docId) {
    return { error: `Queue item ${itemId} is for document ${queued.docId}, not ${docId}`, status: 400 };
  }

  const users = userDataStore();
  const key = ordersKey(memberUserId);
  const stored = await users.get(key, { type: "json" }).catch(() => null);
  // user-data.mjs wraps every payload as { value, updatedAt }; tolerate a bare
  // payload too, the same way order-model.js's reader does.
  const wrapped = stored && typeof stored === "object" && "value" in stored;
  const payload = wrapped ? stored.value : stored;
  const list = Array.isArray(payload?.list) ? payload.list : Array.isArray(payload) ? payload : [];

  const idx = list.findIndex((d) => String(d?.id) === docId);
  if (idx === -1) {
    return { error: `No document ${docId} in ${memberUserId}'s orders`, status: 404 };
  }

  const invoiceTotal = round2(material.value + salesTax.value + service.value);
  const note = str(body.note);
  const doc = {
    ...list[idx],
    material: material.value,
    salesTax: salesTax.value,
    service: service.value,
    invoiceTotal,
    // Nothing has been paid on a quote the customer has not approved yet, so the
    // whole total is outstanding. Written explicitly rather than left to the
    // reader's derivation so the stored record says what it means.
    totalPaid: 0,
    balanceDue: invoiceTotal,
    status: "ready",
    docType: "estimate",
    // Only line items render their statusText (order-detail), but
    // applyOrderAction keeps the document's in step with its status, so this
    // does too rather than leaving a stale "Quote Requested" behind.
    statusText: "Quote Ready to Approve",
    pricedAt: Date.now(),
    // The customer's own `notes` stay untouched: this is the account manager's
    // note about the pricing, and clobbering the note the customer wrote would
    // lose the only thing they said about the job.
    ...(note ? { amNote: note } : {}),
  };

  const next = [...list];
  next[idx] = doc;
  await users.setJSON(key, {
    value: { ...(payload && !Array.isArray(payload) ? payload : {}), schemaVersion: ORDERS_SCHEMA_VERSION, list: next },
    updatedAt: Date.now(),
  });

  // Handled LAST, on purpose. If this write fails the document is already
  // priced and the item stays open, so the account manager retries and prices
  // it to the same numbers. The reverse order could bury a quote as "handled"
  // that nobody ever priced.
  const handled = await markHandled(showroomId, itemId);
  if (handled.error) return handled;

  return { doc, item: handled.item };
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const showroomId = normalizeShowroomId(url.searchParams.get("showroomId"));
      if (!showroomId) {
        return Response.json(
          { error: "showroomId required (e.g. ?showroomId=st-louis)" },
          { status: 400 }
        );
      }
      const rawStatus = url.searchParams.get("status");
      if (rawStatus && !STATUSES.includes(rawStatus)) {
        return Response.json(
          { error: `status must be one of: ${STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      let items = await readQueue(queueStore(), showroomId);
      if (rawStatus) items = items.filter((i) => i?.status === rawStatus);
      return Response.json({ items: [...items].sort(byNewest) });
    }

    if (req.method === "POST") {
      const body = (await req.json().catch(() => null)) || {};
      const action = str(body.action);

      if (action === "enqueue") {
        const { item, error } = buildItem(body.item);
        if (error) return Response.json({ error }, { status: 400 });
        const s = queueStore();
        const list = await readQueue(s, item.showroomId);
        await writeQueue(s, item.showroomId, [item, ...list]);
        return Response.json({ item });
      }

      if (action === "price") {
        const { doc, item, error, status } = await priceQuote(body);
        if (error) return Response.json({ error }, { status: status || 400 });
        return Response.json({ ok: true, doc, item });
      }

      if (action === "dismiss") {
        const showroomId = normalizeShowroomId(body.showroomId);
        if (!showroomId) return Response.json({ error: "showroomId required" }, { status: 400 });
        const itemId = str(body.itemId);
        if (!itemId) return Response.json({ error: "itemId required" }, { status: 400 });
        // Dismissed and priced land in the same place: the queue tracks whether
        // work is outstanding, not how it ended. The member's document is
        // deliberately untouched, so dismissing a quote never silently changes
        // what the member sees.
        const { item, error, status } = await markHandled(showroomId, itemId);
        if (error) return Response.json({ error }, { status: status || 400 });
        return Response.json({ ok: true, item });
      }

      return Response.json(
        { error: "action must be one of: enqueue, price, dismiss" },
        { status: 400 }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error("am-queue error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
