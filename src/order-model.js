/**
 * Shared order + estimate data model.
 *
 * ONE source of truth. /orders, /orders/:id and the project detail page's
 * "Estimates & Orders" tab all read the same per-user `orders` blob through
 * `useOrders()`. They used to carry two independent hardcoded datasets that
 * disagreed with each other (different line items, different totals, and no
 * link to the project the order belonged to).
 *
 * Persisted shape (one `orders` blob per user):
 *
 *   {
 *     schemaVersion: 2,
 *     list: [{
 *       id, docType: 'order' | 'estimate', projectId, jobName, client,
 *       orderDate ('M/D/YYYY'), orderDateTs, expectedDelivery,
 *       status, statusText, soldTo, showroom,
 *       material, salesTax, service, invoiceTotal, totalPaid, balanceDue,
 *       referralBonus,
 *       lineItems: [{ category, product, color, brand, qty, unit, quantity,
 *                     unitPrice, subtotal, status, statusText }],
 *     }]
 *   }
 *
 * An **estimate** is a quote awaiting the customer's decision; an **order** is
 * an estimate they approved. Approving flips docType (see `applyOrderAction`).
 *
 * Legacy blobs (written before schemaVersion 2) have no `docType` and no line
 * items. `normalizeOrder` migrates them on read, so nothing needs a data reset.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { lineItemStatusLabel } from './order-status';

export const ORDERS_SCHEMA_VERSION = 2;
export const ORDERS_KEY = 'orders';

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const round2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * Money that hasn't been set yet is null, NOT zero.
 * A quote the customer just submitted has no pricing until the account manager
 * builds it. Coercing that to 0 renders "$0.00", which reads as "this job is
 * free" rather than "we haven't priced it yet". Keep null distinct and say so.
 */
const numOrNull = (n) => (n == null ? null : num(n));

export const money = (n) => (n == null ? 'To be quoted' : `$${num(n).toFixed(2)}`);

// -------- Normalization (migration on read) --------

const normalizeLineItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const qty = num(raw.qty);
  const unitPrice = num(raw.unitPrice);
  const status = raw.status || 'pending';
  return {
    ...raw,
    category: raw.category || '',
    product: raw.product || 'Item',
    color: raw.color || '',
    brand: raw.brand || '',
    qty,
    unit: raw.unit || '',
    quantity: raw.quantity || (qty ? `${qty} ${raw.unit || ''}`.trim() : '--'),
    unitPrice,
    subtotal: raw.subtotal == null ? round2(qty * unitPrice) : num(raw.subtotal),
    status,
    statusText: raw.statusText || lineItemStatusLabel(status),
  };
};

/**
 * Migrate + guard one stored record. Idempotent.
 *
 * Every money field is coerced to a number: the pages call `.toFixed(2)` all
 * over, and one missing field in a stored blob would take the whole route down.
 */
export const normalizeOrder = (raw) => {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const status = raw.status || 'processing';
  // Legacy records carry no docType. A quote awaiting approval (or a declined
  // one) is an estimate; anything else is an order. 'requested' is a quote the
  // customer just submitted from their cart: it is an estimate too, and without
  // this it would be filed under Orders, which is where the customer would never
  // think to look for it.
  const docType =
    raw.docType ||
    (status === 'ready' || status === 'declined' || status === 'requested'
      ? 'estimate'
      : 'order');
  const invoiceTotal = numOrNull(raw.invoiceTotal);
  const totalPaid = numOrNull(raw.totalPaid);
  return {
    ...raw,
    id: String(raw.id),
    docType,
    projectId: raw.projectId ?? null,
    jobName: raw.jobName || 'Untitled',
    client: raw.client || '',
    soldTo: raw.soldTo || '',
    showroom: raw.showroom || '',
    orderDate: raw.orderDate || '',
    orderDateTs: raw.orderDateTs ?? (raw.orderDate ? Date.parse(raw.orderDate) || null : null),
    expectedDelivery: raw.expectedDelivery || null,
    status,
    material: numOrNull(raw.material),
    salesTax: numOrNull(raw.salesTax),
    service: numOrNull(raw.service),
    invoiceTotal,
    totalPaid,
    // An unpriced quote has no balance to derive, so it stays null and renders
    // as "To be quoted". Only compute a balance once there's a total to work from.
    balanceDue:
      raw.balanceDue != null
        ? num(raw.balanceDue)
        : invoiceTotal == null
        ? null
        : Math.max(0, round2(invoiceTotal - num(totalPaid))),
    referralBonus: raw.referralBonus ?? null,
    lineItems: (Array.isArray(raw.lineItems) ? raw.lineItems : [])
      .map(normalizeLineItem)
      .filter(Boolean),
  };
};

/** The one true reader for the `orders` blob. Accepts `{list}` or a bare array. */
export const normalizeStoredOrders = (stored) => {
  if (!stored) return [];
  const list = Array.isArray(stored) ? stored : Array.isArray(stored.list) ? stored.list : [];
  return list.map(normalizeOrder).filter(Boolean);
};

// -------- Document helpers --------

export const isEstimate = (doc) => doc?.docType === 'estimate';

/** "Estimate" / "Order", for headings and empty-state copy. */
export const docNoun = (doc) => (isEstimate(doc) ? 'Estimate' : 'Order');

/**
 * A quote doesn't have a balance due. Nobody owes anything until it's
 * approved. Show its total instead, so the header can't claim money is owed on
 * a document the customer hasn't accepted.
 */
export const headlineLabel = (doc) => (isEstimate(doc) ? 'Estimate Total' : 'Balance Due');
export const headlineAmount = (doc) => (isEstimate(doc) ? doc.invoiceTotal : doc.balanceDue);

export const findOrder = (list, id) => (list || []).find((d) => d.id === id) || null;

export const docsForProject = (list, projectId) =>
  !projectId ? [] : (list || []).filter((d) => d.projectId === projectId);

/** Newest first. Undated legacy records sort last. */
export const byNewest = (a, b) => (b.orderDateTs || 0) - (a.orderDateTs || 0);

// -------- Time-range filter --------

/**
 * The filter's options and their meaning in one place. The picker used to list
 * the ranges and nothing anywhere applied them; keeping the labels and the day
 * counts together means a new option can't silently become a no-op.
 */
export const TIME_RANGE_OPTIONS = [
  { value: '3year', label: '3 Years', days: 1095 },
  { value: '1year', label: '1 Year', days: 365 },
  { value: '6mo', label: '6 Months', days: 182 },
];

export const DEFAULT_TIME_RANGE = '3year';

export const withinTimeRange = (doc, range, now = Date.now()) => {
  const option = TIME_RANGE_OPTIONS.find((o) => o.value === range);
  if (!option) return true;
  const { days } = option;
  // An undated record can't be excluded honestly, so never hide it.
  if (!doc.orderDateTs) return true;
  return doc.orderDateTs >= now - days * 24 * 60 * 60 * 1000;
};

// -------- Transitions --------

/**
 * What the customer can actually do with this document right now.
 * Drives both the buttons and the modal, so a button can never appear for an
 * action the model would refuse.
 */
export const availableActions = (doc) => {
  if (!doc) return [];
  if (doc.docType === 'estimate') {
    return doc.status === 'ready' ? ['approve', 'decline'] : [];
  }
  return doc.status === 'payment' && doc.balanceDue > 0 ? ['pay'] : [];
};

/**
 * Apply an action and return the updated record.
 *
 * The point of doing this in one place: the totals, the status and the line
 * items all move together. The old flow wrote a status override to
 * localStorage and left `balanceDue` / `totalPaid` untouched, so an order could
 * show "Order Confirmed" next to the full unpaid balance in red.
 *
 *   approve : estimate(ready) → order(payment)   (a quote becomes an order)
 *   decline : estimate(ready) → estimate(declined)
 *   pay     : order(payment)  → order(processing), balance settled in full
 */
export const applyOrderAction = (doc, action, now = Date.now()) => {
  if (!doc) return doc;
  const setLines = (status) =>
    (doc.lineItems || []).map((li) => ({
      ...li,
      status,
      statusText: lineItemStatusLabel(status),
    }));

  switch (action) {
    case 'approve':
      return {
        ...doc,
        docType: 'order',
        status: 'payment',
        statusText: 'Order Down Payment Due',
        approvedAt: now,
        lineItems: setLines('pending'),
      };
    case 'decline':
      return {
        ...doc,
        status: 'declined',
        statusText: 'Quote Declined',
        declinedAt: now,
        lineItems: setLines('declined'),
      };
    case 'pay':
      return {
        ...doc,
        status: 'processing',
        statusText: 'Order Being Processed',
        totalPaid: round2(num(doc.totalPaid) + num(doc.balanceDue)),
        balanceDue: 0,
        paidAt: now,
        lineItems: setLines('on-order'),
      };
    default:
      return doc;
  }
};

// -------- Data access --------

const unwrap = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

/**
 * Load the user's orders + estimates, and run actions against them.
 *
 * Returns { orders, status: 'loading'|'ready'|'error', error, reload, runAction }.
 */
export const useOrders = () => {
  const { userId, saveUserData } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setOrders([]);
      setStatus('ready');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    // Deliberately NOT auth-context's loadUserData(): it swallows failures and
    // hands back the fallback, which is indistinguishable from "you have no
    // orders". These pages have to tell those two apart.
    fetch(`/api/user-data?userId=${encodeURIComponent(userId)}&key=${ORDERS_KEY}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return unwrap(data.value);
      })
      .then((value) => {
        if (cancelled) return;
        setOrders(normalizeStoredOrders(value));
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load orders');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  /**
   * Apply `action` to one document and persist the collection.
   *
   * Optimistic, but honest: if the write fails the local state rolls back and
   * this throws, so the caller shows the failure instead of a success that
   * never happened.
   */
  const runAction = useCallback(
    async (orderId, action) => {
      const before = orders;
      const next = before.map((o) => (o.id === orderId ? applyOrderAction(o, action) : o));
      setOrders(next);
      try {
        await saveUserData(ORDERS_KEY, {
          schemaVersion: ORDERS_SCHEMA_VERSION,
          list: next,
        });
      } catch (err) {
        setOrders(before);
        throw err;
      }
      return findOrder(next, orderId);
    },
    [orders, saveUserData]
  );

  return { orders, status, error, reload, runAction };
};
