/**
 * Shared project data model.
 *
 * One home for the constants and helpers that used to be copy-pasted (and had
 * started to diverge) across prosource-projects.jsx, prosource-project-create.jsx
 * and prosource-project-detail.jsx.
 *
 * Persisted project shape (one `projects` blob per user: `{ list: [...] }`):
 *
 *   {
 *     id, name, type, description, address, budgetRange,
 *     targetStart, targetCompletion, squareFootage, notes,
 *     status, archived, team: [...],
 *     showroomId: 'st-louis' | 'chicago' | null,
 *     rooms: [{ id, name, type?, squareFootage?, notes?, createdAt }],
 *     products: [{ id, sku, name, category, qty, price, roomId, ...snapshot }],
 *     createdAt, updatedAt,
 *   }
 *
 * `showroomId` names the showroom supplying the job, matching an `id` in the
 * account's `showrooms` list (see auth-context). Most accounts work with exactly
 * one showroom and never see a choice; the field exists for the ones that work
 * with several. It is deliberately just the id, not a copy of the showroom
 * record: names, addresses and account managers change, and the account's list
 * is the one place that should say what they are today.
 *
 * null means "not assigned", which is what every project created before this
 * field existed is. That is a real state, not a missing value to be guessed at:
 * readers should say so rather than assume the primary showroom, which would be
 * wrong for exactly the multi-showroom accounts the field is for.
 *
 * `rooms` used to be an array of plain strings ("Kitchen") and products had no
 * room reference at all. `normalizeStored` migrates both shapes on read, so
 * stored blobs written by the old code keep working with no data reset. The
 * migration is idempotent and deterministic: a legacy room name always maps to
 * the same room id, so a project migrated on one page references the same rooms
 * as the same project migrated on another page (even before anyone re-saves).
 */

// Icons live in project-type-icons.js, keyed by `label`. This module stays
// plain data so it's safe to import anywhere.
export const PROJECT_TYPES = [
  { value: 'Kitchen Remodel', label: 'Kitchen' },
  { value: 'Bathroom Remodel', label: 'Bathroom' },
  { value: 'Flooring', label: 'Flooring' },
  { value: 'Full Home Renovation', label: 'Whole home' },
  { value: 'New Construction', label: 'New build' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Countertops Only', label: 'Countertops' },
  { value: 'Cabinets Only', label: 'Cabinets' },
  { value: 'Other', label: 'Other' },
];

/** Just the type values, for plain <select> menus. */
export const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);

export const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $10,000',
  '$10,000 - $15,000',
  '$15,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+',
  'Not Sure Yet',
];

/** Quick-add suggestions. Rooms are free text, so this list is a shortcut only. */
export const ROOM_OPTIONS = [
  'Kitchen',
  'Bathroom',
  'Master Bathroom',
  'Guest Bathroom',
  'Living Room',
  'Dining Room',
  'Master Bedroom',
  'Bedroom',
  'Basement',
  'Laundry Room',
  'Pantry',
  'Mudroom',
  'Office',
  'Whole Home',
  'Outdoor/Patio',
];

/**
 * Rooms we suggest in the create wizard based on the chosen project type.
 * They are only ever a starting point. The wizard lets you remove any of them
 * and add your own.
 *
 * Rule of thumb: only suggest a room we're actually confident about. A whole-home
 * job really does span several rooms, so suggest the usual ones rather than a
 * single pseudo-room called "Whole Home". That would defeat the point of rooms,
 * which is organising products by space. Where the type says nothing useful about
 * which rooms are involved (Flooring, Commercial, Other), suggest nothing and let
 * the Common-rooms chips do the work.
 */
export const DEFAULT_ROOMS_BY_TYPE = {
  'Kitchen Remodel': ['Kitchen'],
  'Bathroom Remodel': ['Bathroom'],
  'Full Home Renovation': ['Kitchen', 'Living Room', 'Master Bathroom', 'Master Bedroom'],
  'New Construction': ['Kitchen', 'Living Room', 'Master Bathroom', 'Master Bedroom'],
  'Countertops Only': ['Kitchen'],
  'Cabinets Only': ['Kitchen'],
  'Flooring': [],
  'Commercial': [],
  'Other': [],
};

export const DEFAULT_PROJECT = {
  name: 'New Project',
  type: 'Kitchen Remodel',
  description: '',
  address: '',
  budgetRange: 'Not Sure Yet',
  targetStart: '',
  targetCompletion: '',
  squareFootage: '',
  showroomId: null,
  rooms: [],
  products: [],
  notes: '',
};

// -------- Rooms --------

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Deterministic id for a room name. Legacy string rooms migrate to the same id
 * every time, on every page, so product.roomId links survive migration.
 */
export const roomIdFromName = (name) => `room-${slugify(name) || 'area'}`;

/** Build a new room, guaranteeing its id is unique within `existingRooms`. */
export const makeRoom = (name, existingRooms = [], extra = {}) => {
  const trimmed = String(name || '').trim();
  const taken = new Set((existingRooms || []).map((r) => r && r.id));
  const base = roomIdFromName(trimmed);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return { id, name: trimmed, createdAt: Date.now(), ...extra };
};

/**
 * Migrate + clean a project's rooms array.
 * Accepts legacy strings, room objects, or junk. Idempotent.
 */
export const normalizeRooms = (rooms, fallbackCreatedAt = null) => {
  if (!Array.isArray(rooms)) return [];
  const out = [];
  const taken = new Set();
  rooms.forEach((room) => {
    if (!room) return;
    const source = typeof room === 'string' ? { name: room } : room;
    if (typeof source !== 'object') return;
    const name = String(source.name || '').trim();
    if (!name) return;
    let id = source.id || roomIdFromName(name);
    if (taken.has(id)) {
      const base = id;
      let n = 2;
      while (taken.has(id)) id = `${base}-${n++}`;
    }
    taken.add(id);
    out.push({
      ...(typeof room === 'string' ? {} : room),
      id,
      name,
      createdAt: source.createdAt ?? fallbackCreatedAt ?? null,
    });
  });
  return out;
};

export const findRoom = (rooms, roomId) =>
  (rooms || []).find((r) => r.id === roomId) || null;

export const roomLabel = (rooms, roomId) => {
  const room = findRoom(rooms, roomId);
  return room ? room.name : 'Unassigned';
};

/**
 * Remove a room. Its products are reassigned to Unassigned, never deleted.
 * Returns the patch to merge into the project record.
 */
export const removeRoomFromProject = (project, roomId) => {
  const rooms = (project.rooms || []).filter((r) => r.id !== roomId);
  const products = (project.products || []).map((p) =>
    p.roomId === roomId ? { ...p, roomId: null } : p
  );
  return { rooms, products };
};

/** Rename a room in place. Ids never change, so product links are unaffected. */
export const renameRoomInProject = (project, roomId, nextName) => {
  const name = String(nextName || '').trim();
  if (!name) return { rooms: project.rooms || [] };
  return {
    rooms: (project.rooms || []).map((r) => (r.id === roomId ? { ...r, name } : r)),
  };
};

// -------- Products --------

/** Canonical identity for a product line. SKU first, id as a fallback. */
export const productKey = (item) => (item && (item.sku || String(item.id))) || '';

/**
 * Migrate + clean a project's products array. Every product gets an explicit
 * roomId; anything pointing at a room that no longer exists falls back to
 * Unassigned rather than vanishing. Idempotent.
 */
export const normalizeProducts = (products, rooms = []) => {
  if (!Array.isArray(products)) return [];
  const valid = new Set((rooms || []).map((r) => r.id));
  return products
    .filter(Boolean)
    .map((p) => ({
      ...p,
      qty: p.qty || 1,
      roomId: p.roomId && valid.has(p.roomId) ? p.roomId : null,
    }));
};

/** Turn an active-cart item into a project product line. Keeps the full snapshot. */
export const cartItemToProjectProduct = (item, roomId = null) => ({
  ...item,
  sku: productKey(item),
  qty: item.qty || 1,
  price: item.price ?? null,
  roomId: roomId ?? null,
  addedAt: Date.now(),
});

/**
 * Merge cart items into a project's product list. A line is identified by
 * SKU *and* room, so the same product can live in two rooms as two lines while
 * re-adding it to the same room just bumps the qty.
 */
export const mergeCartItemsIntoProducts = (existing, items, roomId = null) => {
  const merged = Array.isArray(existing) ? [...existing] : [];
  (items || []).forEach((item) => {
    const key = productKey(item);
    const hit = merged.findIndex(
      (x) => productKey(x) === key && (x.roomId ?? null) === (roomId ?? null)
    );
    if (hit >= 0) {
      merged[hit] = { ...merged[hit], qty: (merged[hit].qty || 1) + (item.qty || 1) };
    } else {
      merged.push(cartItemToProjectProduct(item, roomId));
    }
  });
  return merged;
};

/** Move the product at `index` to `roomId`, merging into an existing line there. */
export const moveProductToRoom = (products, index, roomId) => {
  const list = Array.isArray(products) ? [...products] : [];
  const item = list[index];
  if (!item) return list;
  const target = roomId ?? null;
  if ((item.roomId ?? null) === target) return list;
  const key = productKey(item);
  const hit = list.findIndex(
    (x, i) => i !== index && productKey(x) === key && (x.roomId ?? null) === target
  );
  if (hit >= 0) {
    list[hit] = { ...list[hit], qty: (list[hit].qty || 1) + (item.qty || 1) };
    list.splice(index, 1);
    return list;
  }
  list[index] = { ...item, roomId: target };
  return list;
};

export const setProductQty = (products, index, qty) => {
  const list = Array.isArray(products) ? [...products] : [];
  if (!list[index]) return list;
  list[index] = { ...list[index], qty: Math.max(1, qty) };
  return list;
};

export const removeProductAt = (products, index) =>
  (Array.isArray(products) ? products : []).filter((_, i) => i !== index);

export const countProductsInRoom = (products, roomId) =>
  (products || []).filter((p) => (p.roomId ?? null) === (roomId ?? null)).length;

/**
 * Group products by room for display. Every room gets a group (even empty ones,
 * so the room structure is visible); Unassigned only appears when it has items.
 * Each entry keeps the product's index in the original array so edits can write
 * back without needing per-line ids.
 */
export const groupProductsByRoom = (project) => {
  const rooms = project?.rooms || [];
  const products = project?.products || [];
  const entries = products.map((product, index) => ({ product, index }));
  const groups = rooms.map((room) => ({
    room,
    items: entries.filter((e) => e.product.roomId === room.id),
  }));
  const unassigned = entries.filter(
    (e) => !e.product.roomId || !rooms.some((r) => r.id === e.product.roomId)
  );
  if (unassigned.length) groups.push({ room: null, items: unassigned });
  return groups;
};

// -------- Project / collection --------

/**
 * Migrate a project's showroom reference. Projects stored before showrooms
 * existed simply have no `showroomId`, which normalizes to an explicit null:
 * present and unassigned, rather than absent and ambiguous. Anything that isn't
 * a usable id (empty string, a leftover object, junk) is unassigned too.
 * Idempotent.
 */
export const normalizeShowroomId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

/** Apply every migration to a single project record. Idempotent. */
export const normalizeProject = (project) => {
  if (!project || typeof project !== 'object') return project;
  const rooms = normalizeRooms(project.rooms, project.createdAt ?? null);
  return {
    ...project,
    showroomId: normalizeShowroomId(project.showroomId),
    rooms,
    products: normalizeProducts(project.products, rooms),
  };
};

/**
 * The one true reader for the `projects` blob.
 *
 * Handles three stored shapes:
 *   - `{ list: [...] }`            : current
 *   - `{ project: {...}, status }` : the original single-project blob
 *   - null / junk                  : empty collection
 *
 * and migrates every record through `normalizeProject`.
 */
export const normalizeStored = (stored) => {
  if (!stored) return [];
  if (Array.isArray(stored.list)) return stored.list.map(normalizeProject);
  if (stored.project) {
    const now = Date.now();
    return [
      normalizeProject({
        id: 'legacy-' + now,
        ...stored.project,
        status: stored.status || 'working',
        archived: !!stored.archived,
        createdAt: now,
        updatedAt: now,
      }),
    ];
  }
  return [];
};
