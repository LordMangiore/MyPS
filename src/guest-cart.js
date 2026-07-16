/**
 * Active shopping cart store.
 *
 * One in-progress cart, in localStorage, shared between guest and logged-in
 * users, so the cart survives sign-in without disruption. The `/carts` page
 * shows the user's *library* of saved carts (server-side blob) and uses
 * `loadSavedCartIntoActive` to bring one of them back into the active slot.
 *
 * Item shape (flat, self-contained, so it renders without re-fetching the
 * product):
 *   { id, sku, name, category, price, qty, isSample?, image?, colorName?,
 *     colorHex?, sfPerBox?, roomId? }
 *
 * `price` is a snapshot of the catalog's `listPrice` at add-time and stays
 * `price` on purpose, because `project.products` share this shape.
 *
 * ACCOUNT SYNC
 * ------------
 * localStorage alone gave signed-in users no continuity: sign in on another
 * device and the cart was gone. The active cart now mirrors into the user's
 * `carts` blob under an `active` field (the blob's `list` is the saved-cart
 * library and is untouched; the user-data key whitelist has no room for a new
 * key, so both live in `carts`). On sign-in `adoptActiveCartForUser` merges the
 * local cart into whatever the account already had, so neither side is lost.
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
    // Notify same-tab listeners; `storage` only fires across tabs by default.
    window.dispatchEvent(new CustomEvent('prosource-guest-cart-changed'));
  } catch {}
};

const itemKey = (item) => item.sku || item.id;

export const getGuestCart = () => safeRead() || { items: [] };

export const guestCartCount = () =>
  (safeRead()?.items || []).reduce((n, i) => n + (i.qty || 1), 0);

/** Merge one item into a list, bumping qty when the line key already exists. */
const mergeItem = (items, item) => {
  const key = itemKey(item);
  const existing = items.findIndex((i) => itemKey(i) === key);
  if (existing >= 0) {
    const next = items.slice();
    next[existing] = {
      ...next[existing],
      // Samples are one-per-line by definition, so never stack them.
      qty: next[existing].isSample
        ? 1
        : (next[existing].qty || 1) + (item.qty || 1),
    };
    return next;
  }
  return [...items, { qty: 1, ...item }];
};

/** Add an item to the active cart. Merges by sku/id if already present. */
export const addToGuestCart = (item) => {
  const items = mergeItem(getGuestCart().items, item);
  safeWrite({ items, updatedAt: Date.now() });
  return items;
};

/** Merge a batch of items into the active cart, keeping what's already there. */
export const mergeIntoGuestCart = (incoming) => {
  const items = (incoming || []).reduce(mergeItem, getGuestCart().items);
  safeWrite(items.length ? { items, updatedAt: Date.now() } : null);
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

/** Replace the entire active cart in one shot. */
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
 * Union the local cart with the account's, by line key.
 *
 * NOT the same operation as `mergeItem`. "Add this saved cart to my cart" is an
 * explicit user action where stacking quantities is right. Adoption is not: the
 * two sides are usually *the same cart* (this device already synced it), so
 * stacking would double every qty on every page load. Taking the higher qty per
 * key keeps both sides' additions and makes re-adoption a no-op, which it must
 * be, because this runs on every session restore.
 */
const unionByKey = (stored, local) => {
  const out = [];
  const seen = new Map();
  [...stored, ...local].forEach((item) => {
    if (!item) return;
    const key = itemKey(item);
    if (!key) return;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push({ ...item });
      return;
    }
    const existing = out[at];
    out[at] = {
      // Later (local) snapshot wins on fields; it's the fresher render data.
      ...existing,
      ...item,
      qty: existing.isSample || item.isSample
        ? 1
        : Math.max(existing.qty || 1, item.qty || 1),
    };
  });
  return out;
};

/**
 * Rewrite stored cart keys onto canonical catalog SKUs.
 *
 * `migrate` is `migrateItemKeys` from shop-catalog.js, passed in so this store
 * stays free of catalog imports. No-ops (and never writes) when nothing
 * actually changed, so it's safe to run on every cart change; that matters,
 * because adoption can pull *un*migrated items down from the account after the
 * first pass has already run.
 *
 * Re-keying can land two lines on one sku (a legacy line synced from another
 * device plus this device's already-canonical line), so the result is deduped.
 * Dedupe takes the higher qty, not the sum: the two lines are the same product
 * seen twice, and silently doubling someone's order is the worse failure.
 */
export const migrateActiveCartKeys = (migrate, products) => {
  const current = safeRead();
  if (!current || !current.items?.length) return false;
  const { items, changed } = migrate(current.items, products);
  const deduped = unionByKey(items, []);
  if (!changed && deduped.length === current.items.length) return false;
  safeWrite({ ...current, items: deduped });
  return true;
};

// -------- Account (blob) sync --------

/**
 * Whether the active cart is safe to push to the account yet. Guards the
 * window between sign-in and adoption completing, when a push would clobber
 * the account's cart with the local one before they've been merged.
 */
let adoptedUserId = null;

const cartsBlob = async (userId) => {
  const res = await fetch(
    `/api/user-data?userId=${encodeURIComponent(userId)}&key=carts`
  );
  if (!res.ok) throw new Error('Could not load carts');
  const data = await res.json();
  const value = data?.value;
  // user-data wraps writes as { value, updatedAt }; unwrap defensively.
  const inner = value && typeof value === 'object' && 'value' in value ? value.value : value;
  return inner && typeof inner === 'object' ? inner : {};
};

const writeCartsBlob = async (userId, blob) => {
  const res = await fetch('/api/user-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, key: 'carts', value: blob }),
  });
  if (!res.ok) throw new Error('Could not save carts');
  return true;
};

/**
 * Adopt the active cart into an account: union the local (guest) cart with the
 * one stored on the account and write the result to both. Neither side loses
 * items. That was the whole bug: the guest cart was simply abandoned at the
 * door, and there was no account-side cart at all.
 *
 * Runs on sign-in *and* on every session restore, which is what gives the cart
 * continuity across devices. Safe to re-run: `unionByKey` is idempotent.
 *
 * Best-effort: a failure leaves the local cart exactly as it was, so the user
 * still has their items; they just don't sync this session.
 * Takes an explicit `userId` because callers run inside finalizeSession, before
 * the auth context's state has flushed.
 */
export const adoptActiveCartForUser = async (userId) => {
  if (!userId || adoptedUserId === userId) return null;
  // Claim the slot synchronously: sign-in and the session-restore effect can
  // both land in the same tick, and two in-flight adoptions would each write.
  adoptedUserId = userId;
  try {
    const blob = await cartsBlob(userId);
    const stored = Array.isArray(blob?.active?.items) ? blob.active.items : [];
    const local = getGuestCart().items;
    const merged = unionByKey(stored, local);
    setGuestCart(merged);
    // Skip the write when nothing changed; this runs on every page load.
    if (merged.length !== stored.length || local.length > 0) {
      await writeCartsBlob(userId, {
        ...blob,
        list: Array.isArray(blob.list) ? blob.list : [],
        active: { items: merged, updatedAt: Date.now() },
      });
    }
    return merged;
  } catch (err) {
    console.warn('Cart adoption failed:', err.message);
    // adoptedUserId stays claimed: the local cart is the source of truth now,
    // and later syncs should still go through.
    return null;
  }
};

/** Mirror the active cart into the account blob. No-op until adoption ran. */
export const syncActiveCartToAccount = async (userId) => {
  if (!userId || adoptedUserId !== userId) return false;
  try {
    const blob = await cartsBlob(userId);
    await writeCartsBlob(userId, {
      ...blob,
      list: Array.isArray(blob.list) ? blob.list : [],
      active: { items: getGuestCart().items, updatedAt: Date.now() },
    });
    return true;
  } catch (err) {
    console.warn('Cart sync failed:', err.message);
    return false;
  }
};

/** Sign-out: drop the local cart so it isn't inherited by the next visitor. */
export const releaseActiveCart = () => {
  adoptedUserId = null;
  clearGuestCart();
};

/**
 * Snapshot the active cart into the user's saved-carts library (blob).
 * Active cart is left untouched, so the user can keep editing or clear it.
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
      brand: i.brand,
      category: i.category || 'Other',
      qty: i.qty || 1,
      price: i.price || 0,
      unit: i.unit,
      image: i.image,
      colorName: i.colorName,
      colorHex: i.colorHex,
      sfPerBox: i.sfPerBox,
      isSample: !!i.isSample,
    })),
  };
  // Preserve the active-cart mirror alongside the library write.
  await saveUserData('carts', { ...(existing || {}), list: [newCart, ...list] });
  return newCart;
};

/**
 * Bring a saved cart back into the active slot.
 *
 * Default is `merge`: the button says "Add to Cart", and it used to silently
 * destroy whatever was already in the active cart. Callers that genuinely want
 * the old behaviour must ask for it by name.
 */
export const loadSavedCartIntoActive = (savedCart, { mode = 'merge' } = {}) => {
  const products = Array.isArray(savedCart?.products) ? savedCart.products : [];
  const items = products.map((p) => ({
    id: p.id,
    sku: p.sku || String(p.id),
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price || 0,
    unit: p.unit,
    qty: p.qty || 1,
    image: p.image,
    colorName: p.colorName,
    colorHex: p.colorHex,
    sfPerBox: p.sfPerBox,
    isSample: !!p.isSample,
  }));
  return mode === 'replace' ? setGuestCart(items) : mergeIntoGuestCart(items);
};
