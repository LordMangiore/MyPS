import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import { enqueueItem } from "./am-queue.mjs";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";
const DEV_BYPASS = process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;
const getResend = () => new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const days = (n) => 24 * 60 * 60 * 1000 * n;

const TIMING_TO_TARGET = {
  asap: { startOffset: 7, completionOffset: 60 },
  '1-3': { startOffset: 21, completionOffset: 90 },
  '3-6': { startOffset: 90, completionOffset: 180 },
  exploring: { startOffset: null, completionOffset: null },
};

/**
 * Convert a guest cart submission into a real project + lead.
 *
 * Caller must have already verified the requester's email via otp-verify so we
 * trust `userId` and `email` on the body. The wizard wires these from the
 * verify response.
 *
 * POST body:
 *   { userId, email, firstName, lastName, phone, projectType, zip, timing,
 *     notes, cartItems[{ name, sku, category, qty, price }] }
 *
 * Side effects:
 *   1. Look up showroom + AM by zip (lookupCrm)
 *   2. Persist/refresh the user's profile with name, phone, showroom, AM
 *   3. Create a project in ps-user-data/projects with the cart items as products
 *      and the AM + Designer auto-added to the team
 *   4. For intent 'quote': write the quote itself into the requester's own
 *      `orders` blob as an unpriced estimate, and put it on the showroom's AM
 *      work queue so somebody can actually price it
 *   5. Email the AM (the in-app "AM notification") with the lead summary
 *   6. Email the requester confirming the quote
 *
 * Returns { projectId, quoteId, userId, showroom, accountManager }.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const {
      userId,
      email,
      firstName = "",
      lastName = "",
      phone = "",
      audience = "",
      projectType,
      zip,
      budget = "",
      timing = "exploring",
      notes = "",
      cartItems = [],
      // 'quote' (default) → notify the AM of a hot quote request.
      // 'save'            → create project + account, but no quote signal.
      //                     AM still sees the lead, just not as "wants pricing".
      intent = "quote",
    } = body || {};
    const isSave = intent === "save";

    if (!userId || !email) {
      return Response.json({ error: "userId + email required (verify OTP first)" }, { status: 400 });
    }
    if (!projectType || !zip) {
      return Response.json({ error: "projectType + zip required" }, { status: 400 });
    }

    // 1) Showroom + AM lookup (mirrors lookupCrm in /api/lookup-showroom).
    let showroom = null;
    let accountManager = null;
    try {
      const baseUrl =
        process.env.URL ||
        `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`;
      const lookupRes = await fetch(`${baseUrl}/api/lookup-showroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip }),
      });
      const lookupData = await lookupRes.json();
      showroom = lookupData?.showroom || null;
      accountManager = lookupData?.manager || null;
    } catch (err) {
      console.warn("showroom lookup failed:", err.message);
    }

    const now = Date.now();
    const normalizedEmail = String(email).toLowerCase().trim();

    // 2) Persist / refresh user profile.
    try {
      const users = getStore({ name: "ps-users", consistency: "strong" });
      const existing = (await users.get(userId, { type: "json" }).catch(() => null)) || {};
      const merged = {
        ...existing,
        userId,
        email: normalizedEmail,
        firstName: firstName || existing.firstName || "",
        lastName: lastName || existing.lastName || "",
        phone: phone || existing.phone || "",
        userType: existing.userType || "homeowner",
        showroom: showroom || existing.showroom || null,
        accountManager: accountManager || existing.accountManager || null,
        updatedAt: now,
        createdAt: existing.createdAt || now,
      };
      await users.setJSON(userId, merged);

      const emailStore = getStore("ps-email-to-user");
      const mapping = (await emailStore.get(normalizedEmail, { type: "json" })) || {};
      await emailStore.setJSON(normalizedEmail, {
        ...mapping,
        userId,
        name: [firstName, lastName].filter(Boolean).join(" ") || mapping.name,
        updatedAt: now,
      });
    } catch (err) {
      console.warn("profile persist failed:", err.message);
    }

    // 3) Create the project with the cart contents.
    const target = TIMING_TO_TARGET[timing] || TIMING_TO_TARGET.exploring;
    const projectId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const projectName = `${(lastName || firstName || normalizedEmail.split("@")[0])} ${projectType}`.trim();

    // Showroom team (Kim + Heather equivalent) auto-added based on lookup.
    const showroomTeam = [];
    if (accountManager?.name) {
      showroomTeam.push({
        connectionId: `am-${normalizedEmail}`,
        name: accountManager.name,
        initials:
          accountManager.initials ||
          accountManager.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2),
        role: accountManager.title || "Account Manager",
        type: "prosource",
        addedAt: now,
      });
    }

    const projectRecord = {
      id: projectId,
      name: projectName,
      type: projectType,
      description: notes,
      address: zip,
      budgetRange: budget || "Not Sure Yet",
      audience,
      targetStart: target.startOffset ? new Date(now + days(target.startOffset)).toISOString().slice(0, 10) : "",
      targetCompletion: target.completionOffset ? new Date(now + days(target.completionOffset)).toISOString().slice(0, 10) : "",
      squareFootage: "",
      rooms: [],
      notes,
      status: "working",
      archived: false,
      team: showroomTeam,
      products: cartItems.map((item, idx) => ({
        id: item.id || idx + 1,
        name: item.name || "Product",
        sku: item.sku || `SKU-${idx + 1}`,
        category: item.category || "Other",
        qty: item.qty || 1,
        price: item.price || 0,
      })),
      origin: isSave ? "project-save" : "quote-submission",
      quoteRequested: !isSave,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const userData = getStore({ name: "ps-user-data", consistency: "strong" });
      const existingProjects = await userData
        .get(`${userId}::projects`, { type: "json" })
        .catch(() => null);
      const list = Array.isArray(existingProjects?.value?.list)
        ? existingProjects.value.list
        : [];
      await userData.setJSON(`${userId}::projects`, {
        value: { list: [projectRecord, ...list] },
        updatedAt: now,
      });
    } catch (err) {
      console.warn("project persist failed:", err.message);
      return Response.json({ error: "Failed to create project: " + err.message }, { status: 500 });
    }

    // 4) The quote itself, plus the AM work queue.
    //
    // This used to append a lead record to a `ps-consultation-requests` bucket
    // keyed by the AM's email. Nothing in the app has ever read that bucket, so
    // a wizard quote reached a human only if the AM happened to read the email
    // in step 5. It is replaced (not supplemented) by the queue below, which is
    // the one index the AM console reads.
    //
    // The lead record also wasn't a quote: it recorded that someone WANTED
    // pricing without creating anything to price. So the quote is written into
    // the requester's own `orders` blob first, exactly as the member cart path
    // does (src/prosource-shop.jsx `submitQuote`), and the queue item points at
    // it. That is what makes the AM's price action able to land real money on a
    // real document, and it means the wizard's "your quote is in" email is true:
    // the quote is on their Estimates tab when they sign in.
    //
    // intent 'save' deliberately produces neither. That path says "no quote
    // yet" (quoteRequested: false on the project); enqueueing it would put work
    // in front of an AM that the customer never asked for.
    const quoteId = isSave ? null : `Q${String(now).slice(-8)}`;
    if (!isSave) {
      const requesterName = [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail;
      // Money stays null, not 0: null means "not priced yet", 0 would render as
      // "$0.00" and read as "this job is free" (see src/order-model.js).
      const quoteRecord = {
        id: quoteId,
        kind: "quote",
        projectId,
        jobName: projectName,
        orderDate: new Date(now).toLocaleDateString("en-US"),
        orderDateTs: now,
        submittedAt: now,
        status: "requested",
        statusText: "Quote Requested",
        docType: "estimate",
        soldTo: requesterName.toUpperCase(),
        client: requesterName,
        showroom: showroom?.name || null,
        accountManager: accountManager?.name || null,
        notes: notes || null,
        invoiceTotal: null,
        material: null,
        salesTax: null,
        service: null,
        totalPaid: null,
        balanceDue: null,
        items: cartItems.map((item, idx) => ({
          id: item.id || idx + 1,
          name: item.name || "Product",
          sku: item.sku || `SKU-${idx + 1}`,
          category: item.category || "Other",
          qty: item.qty || 1,
          price: item.price || 0,
        })),
        listSubtotal: cartItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
      };

      try {
        const userData = getStore({ name: "ps-user-data", consistency: "strong" });
        const ordersKey = `${userId}::orders`;
        const existingOrders = await userData.get(ordersKey, { type: "json" }).catch(() => null);
        const payload = existingOrders?.value;
        const list = Array.isArray(payload?.list) ? payload.list : [];
        await userData.setJSON(ordersKey, {
          value: { ...(payload || {}), schemaVersion: 2, list: [quoteRecord, ...list] },
          updatedAt: now,
        });
      } catch (err) {
        console.warn("quote persist failed:", err.message);
      }

      // Best-effort: the project and the quote are already saved, so a queue
      // write that fails must not fail the whole submit and send the requester
      // back through the wizard.
      try {
        await enqueueItem({
          type: "quote",
          showroomId: showroom?.id || "unassigned",
          memberUserId: userId,
          memberName: [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail,
          memberEmail: normalizedEmail,
          docId: quoteId,
          projectId,
          summary: `${projectType} quote, ${cartItems.length} item${cartItems.length !== 1 ? "s" : ""}`,
          itemCount: cartItems.length,
          submittedAt: now,
        });
      } catch (err) {
        console.warn("AM queue enqueue failed:", err.message);
      }
    }

    // Is there an account manager who will actually pick this up?
    //
    // Not the same question as "did the lookup return one", and the difference is
    // the whole reason this is a variable. lookup-showroom resolves every zip
    // outside the seeded territories to a FALLBACK carrying a real-looking name
    // ("A ProSource account manager") and an EMPTY email, whose own address field
    // says "We'll match you on your first visit". So a truthy `name` means we have
    // something to print, not somebody to expect a call from, and that fallback is
    // the common path rather than the edge: every zip we do not seed lands on it.
    //
    // The email is the honest test. It gates the notification below, and it tracks
    // the queue too: an unresolved showroom enqueues under id "pending", which no
    // account manager's console can select. Nobody is emailed and nobody is
    // queued, so nobody is coming.
    const amIsReachable = !!accountManager?.email;

    // 5) Email the AM. Skip in dev bypass.
    //
    // Skipped, not failed, when the step 1 lookup resolved no reachable account
    // manager: there is simply nobody to notify. The requester's confirmation is a
    // separate block below for that exact reason.
    if (!DEV_BYPASS && amIsReachable) {
      try {
        const itemLines = cartItems
          .slice(0, 8)
          .map((i) => `<li>${escapeHtml(i.name)} <span style="color:#6b7280;">(qty ${i.qty || 1}${i.price ? " · $" + i.price : ""})</span></li>`)
          .join("");
        const subtotal = cartItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
        await getResend().emails.send({
          from: FROM_ADDRESS,
          to: accountManager.email,
          subject: isSave
            ? `New project from ${[firstName, lastName].filter(Boolean).join(" ") || normalizedEmail}: ${projectType} (no quote yet)`
            : `New lead from ${[firstName, lastName].filter(Boolean).join(" ") || normalizedEmail}: ${projectType}`,
          html: `
            <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 560px; padding: 32px 24px; color: #171717;">
              <div style="margin-bottom: 22px;">
                <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
              </div>
              <h2 style="margin: 0 0 6px; font-size: 19px;">${isSave ? 'New project saved (warm lead)' : 'New lead from your profile'}</h2>
              <p style="margin: 0 0 18px; color: #525252;">
                ${isSave
                  ? 'A homeowner built a project on ProSource and added products to it, but hasn\'t requested a quote yet. They picked you as their account manager. No immediate action needed, but say hi when you have a moment.'
                  : 'A homeowner submitted a quote request via ProSource. Project + cart already saved on their account.'}
              </p>
              <div style="background:#f8f9fa;border-radius:8px;padding:14px 18px;margin-bottom:18px;">
                <p style="margin:0 0 6px;"><strong>Lead:</strong> ${escapeHtml([firstName, lastName].filter(Boolean).join(" ") || normalizedEmail)}</p>
                <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(normalizedEmail)}${phone ? " · <strong>Phone:</strong> " + escapeHtml(phone) : ""}</p>
                ${audience ? `<p style="margin:0 0 6px;"><strong>Buyer:</strong> ${escapeHtml(audience)}</p>` : ""}
                <p style="margin:0 0 6px;"><strong>Project:</strong> ${escapeHtml(projectType)}</p>
                <p style="margin:0 0 6px;"><strong>Zip:</strong> ${escapeHtml(zip)}</p>
                ${budget ? `<p style="margin:0 0 6px;"><strong>Budget:</strong> ${escapeHtml(budget)}</p>` : ""}
                <p style="margin:0 0 6px;"><strong>Timing:</strong> ${escapeHtml(timing)}</p>
                <p style="margin:0;"><strong>Cart subtotal:</strong> $${subtotal.toFixed(2)} (${cartItems.length} item${cartItems.length !== 1 ? "s" : ""})</p>
              </div>
              ${itemLines ? `<div style="margin-bottom:18px;"><strong>Items:</strong><ul style="margin:6px 0 0;padding-left:18px;color:#374151;">${itemLines}</ul></div>` : ""}
              ${notes ? `<div style="border-left:3px solid #003087;padding:6px 14px;color:#404040;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notes)}</div>` : ""}
            </div>
          `,
        });
      } catch (err) {
        console.warn("AM lead email failed:", err.message);
      }
    }

    // 6) Email the requester. Skip in dev bypass.
    //
    // Deliberately outside step 5's guard and its try. Their request is already
    // saved by this point, so neither a showroom lookup that resolved no account
    // manager nor a send to the AM that threw may be the reason the person who
    // asked for the quote never hears back. What the mail PROMISES still depends
    // on whether anyone was reached: see amIsReachable.
    if (!DEV_BYPASS) {
      try {
        await getResend().emails.send({
          from: FROM_ADDRESS,
          to: normalizedEmail,
          subject: isSave
            ? `Your project is saved: ${projectType}`
            : `Quote submitted: ${projectType}`,
          html: `
            <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 480px; padding: 32px 24px; color: #171717;">
              <div style="margin-bottom: 22px;">
                <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
              </div>
              <h2 style="margin: 0 0 6px; font-size: 19px;">${isSave ? 'Your project is saved.' : 'Your quote is in.'}</h2>
              <p style="margin: 0 0 14px; color: #525252; line-height: 1.55;">
                ${amIsReachable
                  ? escapeHtml(accountManager.name) + " at " + escapeHtml(showroom?.name || "your ProSource showroom") +
                    (isSave
                      ? " is your account manager whenever you're ready for pricing or have questions."
                      : " will reach out within a business day.")
                  : (isSave
                      ? "We'll match you with your nearest showroom, and your account manager will pick this up whenever you're ready for pricing."
                      : "We'll match you with your nearest showroom and be in touch.")}
              </p>
              <p style="margin: 0 0 14px; color: #525252; line-height: 1.55;">
                In the meantime, you can <a href="${process.env.URL || "https://myprosource.netlify.app"}/projects/${projectId}" style="color:#003087;font-weight:600;">view your project</a> to add details, photos, or message your team.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.warn("Requester confirmation email failed:", err.message);
      }
    }

    return Response.json({
      success: true,
      projectId,
      quoteId,
      userId,
      showroom,
      accountManager,
    });
  } catch (err) {
    console.error("submit-quote error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
