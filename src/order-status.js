/**
 * Customer-facing order status mapping.
 *
 * The RFMS backend emits seven distinct order states (ready / payment /
 * processing / items / pickup / complete, plus the implicit pre-state of
 * an estimate). The three middle states — payment, processing, items —
 * all map to "order is confirmed and being put together" from the
 * customer's perspective. They can't take a different action in any of
 * those three, so showing them as separate badges is just noise.
 *
 * This file is the single source of truth for what the customer sees.
 * If you need to surface the granular RFMS state (e.g. on internal AM
 * tooling), read `order.status` directly and bypass this mapping.
 */

// Internal RFMS status keys → customer-facing badge label.
export const customerStatusLabel = (status) => {
  switch (status) {
    case 'ready':
      return 'Quote ready to approve';
    case 'payment':
    case 'processing':
    case 'items':
      return 'Order Confirmed';
    case 'pickup':
      return 'Ready for pickup';
    case 'complete':
      return 'Complete';
    default:
      return 'In progress';
  }
};

// Filter-dropdown options — the customer-facing set. "Order Confirmed"
// fans out to multiple internal statuses (see customerStatusToInternal).
export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ready', label: 'Quote ready to approve' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'pickup', label: 'Ready for pickup' },
  { value: 'complete', label: 'Complete' },
];

// Which internal RFMS statuses match a customer-facing filter value.
export const matchesCustomerStatus = (customerValue, internalStatus) => {
  if (customerValue === 'all') return true;
  if (customerValue === 'confirmed') {
    return ['payment', 'processing', 'items'].includes(internalStatus);
  }
  return customerValue === internalStatus;
};
