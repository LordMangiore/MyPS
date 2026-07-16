/**
 * Active shopping cart store.
 *
 * One in-progress cart, in localStorage, shared between guest and logged-in
 * users — so the cart survives sign-in without disruption. The `/carts` page
 * shows the user's *library* of saved carts (server-side blob) and uses
 * `loadSavedCartIntoActive` to bring one of them back into the active slot.
 *
 * Item shape (flat, self-contained — render without re-fetching the product):
 *   { id, sku, name, category, price, qty, isSample?, image?, colorName?, sfPerBox? }
 */

const STORAGE_KEY = 'prosource_guest_cart_v1';

const safeRead = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const safeWrite = (cart) => {
  try {
    if (!cart) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    // Notify same-tab listeners — `storage` only fires across tabs by default.
    window.dispatchEvent(new CustomEvent('prosource-guest-cart-changed'));
  } catch {}
};

const itemKey = (item) => item.sku || item.id;

export const getGuestCart = () => safeRead() || { items: [] };

export const guestCartCount = () =>
  (safeRead()?.items || []).reduce((n, i) => n + (i.qty || 1), 0);

/** Add an item to the active cart. Merges by sku/id if already present. */
export const addToGuestCart = (item) => {
  const current = getGuestCart();
  const key = itemKey(item);
  const existing = current.items.findIndex((i) => itemKey(i) === key);
  let items;
  if (existing >= 0) {
    items = current.items.slice();
    items[existing] = {
      ...items[existing],
      qty: (items[existing].qty || 1) + (item.qty || 1),
    };
  } else {
    items = [...current.items, { qty: 1, ...item }];
  }
  safeWrite({ items, updatedAt: Date.now() });
  return items;
};

export const removeFromGuestCart = (idOrSku) => {
  const current = getGuestCart();
  const items = current.items.filter((i) => itemKey(i) !== idOrSku);
  safeWrite(items.length ? { items, updatedAt: Date.now() } : null);
  return items;
};

/** Set the qty of an existing item. Removes it when qty drops to 0. */
export const updateGuestCartQty = (idOrSku, nextQty) => {
  const current = getGuestCart();
  if (nextQty <= 0) return removeFromGuestCart(idOrSku);
  const items = current.items.map((i) =>
    itemKey(i) === idOrSku ? { ...i, qty: nextQty } : i
  );
  safeWrite({ items, updatedAt: Date.now() });
  return items;
};

/** Replace the entire active cart in one shot (used when loading a saved cart). */
export const setGuestCart = (items) => {
  if (!items || items.length === 0) {
    safeWrite(null);
    return [];
  }
  safeWrite({ items, updatedAt: Date.now() });
  return items;
};

export const clearGuestCart = () => safeWrite(null);

/** Subscribe to cart changes (same-tab + cross-tab via storage event). */
export const subscribeGuestCart = (handler) => {
  const onLocal = () => handler(getGuestCart());
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) handler(getGuestCart());
  };
  window.addEventListener('prosource-guest-cart-changed', onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('prosource-guest-cart-changed', onLocal);
    window.removeEventListener('storage', onStorage);
  };
};

/**
 * Snapshot the active cart into the user's saved-carts library (blob).
 * Active cart is left untouched — the user can keep editing or clear it.
 * Resolves to the new saved-cart entry, or null if there was nothing to save.
 */
export const saveActiveAsNewCart = async ({ userId, userName, name, loadUserData, saveUserData }) => {
  if (!userId) return null;
  const active = safeRead();
  if (!active || !active.items || active.items.length === 0) return null;
  const existing = await loadUserData('carts', null);
  const list = Array.isArray(existing?.list) ? existing.list : [];
  const now = Date.now();
  const newCart = {
    id: `cart-${now}`,
    name: name || `Cart ${new Date(now).toLocaleDateString('en-US')}`,
    updatedAt: new Date(now).toLocaleDateString('en-US'),
    updatedAtTs: now,
    updatedBy: userName || 'You',
    itemCount: active.items.reduce((n, i) => n + (i.qty || 1), 0),
    products: active.items.map((i, idx) => ({
      id: i.id || idx + 1,
      name: i.name || 'Product',
      sku: i.sku || `SKU-${idx}`,
      category: i.category || 'Other',
      qty: i.qty || 1,
      price: i.price || 0,
      image: i.image,
      colorName: i.colorName,
      sfPerBox: i.sfPerBox,
      isSample: !!i.isSample,
    })),
  };
  await saveUserData('carts', { list: [newCart, ...list] });
  return newCart;
};

/**
 * Replace the active cart with the items from a saved cart entry.
 * Used by the "Add to Cart" button on /carts.
 */
export const loadSavedCartIntoActive = (savedCart) => {
  const products = Array.isArray(savedCart?.products) ? savedCart.products : [];
  const items = products.map((p) => ({
    id: p.id,
    sku: p.sku || String(p.id),
    name: p.name,
    category: p.category,
    price: p.price || 0,
    qty: p.qty || 1,
    image: p.image,
    colorName: p.colorName,
    sfPerBox: p.sfPerBox,
    isSample: !!p.isSample,
  }));
  return setGuestCart(items);
};
