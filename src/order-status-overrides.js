/**
 * Demo-only: locally override an order's status when the user clicks Pay /
 * Approve. Real production state would come from RFMS via webhook; this
 * fakes the transition so the customer can see the badge flip and the
 * action buttons disappear.
 *
 * Backed by localStorage so /orders and /orders/:id stay in sync.
 */
import { useEffect, useState } from 'react';

const KEY = 'prosource_order_overrides_v1';
const EVT = 'prosource-order-overrides-changed';

const safeRead = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const safeWrite = (map) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
};

export const getStatusOverride = (orderId) => safeRead()[orderId] || null;

export const setStatusOverride = (orderId, status) => {
  const next = { ...safeRead(), [orderId]: status };
  safeWrite(next);
};

/**
 * React hook: returns the effective status for an order, honoring any
 * local override. Re-renders when the override changes in any tab.
 */
export const useEffectiveOrderStatus = (orderId, fallbackStatus) => {
  const [override, setOverride] = useState(() => getStatusOverride(orderId));
  useEffect(() => {
    const sync = () => setOverride(getStatusOverride(orderId));
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
    return () => {
      window.removeEventListener(EVT, sync);
    };
  }, [orderId]);
  return override || fallbackStatus;
};
