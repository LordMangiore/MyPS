/**
 * Customer-facing order status presentation.
 *
 * The RFMS backend emits seven distinct document states (ready / declined /
 * payment / processing / items / pickup / complete). The three middle states
 * (payment, processing, items) all map to "order is confirmed and being put
 * together" from the customer's perspective. They can't take a different action
 * in any of those three, so showing them as separate badges is just noise.
 *
 * This file is the single source of truth for what the customer *sees* for a
 * status: label, badge colours, icon. The data model itself lives in
 * order-model.js. If you need to surface the granular RFMS state (e.g. on
 * internal AM tooling), read `order.status` directly and bypass this mapping.
 */

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';

// Internal RFMS status keys → customer-facing badge label.
export const customerStatusLabel = (status) => {
  switch (status) {
    case 'requested':
      // A quote the customer submitted from their cart. It sits here until the
      // account manager prices it, at which point it becomes 'ready'. Without
      // this case it fell through to the generic "In progress", which told the
      // customer nothing about what they had actually done.
      return 'Quote requested';
    case 'ready':
      return 'Quote ready to approve';
    case 'declined':
      return 'Quote declined';
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

// Filter-dropdown options: the customer-facing set. "Order Confirmed"
// fans out to multiple internal statuses (see matchesCustomerStatus).
export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ready', label: 'Quote ready to approve' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'pickup', label: 'Ready for pickup' },
  { value: 'complete', label: 'Complete' },
  { value: 'declined', label: 'Quote declined' },
];

// Which internal RFMS statuses match a customer-facing filter value.
export const matchesCustomerStatus = (customerValue, internalStatus) => {
  if (customerValue === 'all') return true;
  if (customerValue === 'confirmed') {
    return ['payment', 'processing', 'items'].includes(internalStatus);
  }
  return customerValue === internalStatus;
};

/**
 * Badge colours, keyed by internal status. Both the list and the detail page
 * read this one map. They used to carry a `switch` each, and the two had
 * drifted: `items` and `pickup` existed in the taxonomy above but neither
 * switch styled them, so a real RFMS state rendered as anonymous grey.
 *
 * Line-item states share the map: the detail page badges those with the same
 * component, and an item that is "On Order" should read the same blue as an
 * order that is being processed.
 */
const TONE = {
  // Document states
  requested: { bg: '#f1f5f9', fg: '#475569' },
  ready: { bg: '#fef3c7', fg: '#d97706' },
  declined: { bg: '#f1f5f9', fg: '#64748b' },
  payment: { bg: '#fee2e2', fg: '#BA0C2F' },
  processing: { bg: '#dbeafe', fg: '#003087' },
  items: { bg: '#dbeafe', fg: '#003087' },
  pickup: { bg: '#ffedd5', fg: '#ea580c' },
  complete: { bg: '#dcfce7', fg: '#07542E' },
  // Line-item states
  pending: { bg: '#f5f5f5', fg: '#404040' },
  'on-order': { bg: '#dbeafe', fg: '#003087' },
  received: { bg: '#dbeafe', fg: '#003087' },
  'ready-for-pickup': { bg: '#ffedd5', fg: '#ea580c' },
  delivered: { bg: '#dcfce7', fg: '#07542E' },
};

export const statusTone = (status) => TONE[status] || { bg: '#f5f5f5', fg: '#404040' };

/**
 * The lucide icon component for a status, or null if it doesn't have one.
 * Returns the component (not an element) so this module stays plain JS.
 */
export const statusIcon = (status) => {
  switch (status) {
    case 'requested':
      return Clock;
    case 'ready':
      return AlertCircle;
    case 'declined':
      return XCircle;
    case 'payment':
    case 'pending':
      return Clock;
    case 'processing':
      return Loader;
    case 'items':
    case 'on-order':
    case 'received':
      return Package;
    case 'pickup':
    case 'ready-for-pickup':
      return Truck;
    case 'complete':
    case 'delivered':
      return CheckCircle;
    default:
      return null;
  }
};

/** Line-item status → label. Used when a stored line has no explicit text. */
export const lineItemStatusLabel = (status) => {
  switch (status) {
    case 'on-order':
      return 'On Order';
    case 'processing':
      return 'Processing';
    case 'received':
      return 'At Showroom';
    case 'ready-for-pickup':
      return 'Ready for Pickup';
    case 'delivered':
      return 'Delivered';
    case 'declined':
      return 'Declined';
    default:
      return 'Pending';
  }
};
