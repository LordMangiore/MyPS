/**
 * Storefront product catalog: fetch, fallback, and SKU resolution.
 *
 * The catalog is served by `GET /api/products` → `{ products: [...] }` in the
 * canonical schema:
 *
 *   { sku, parentSku, name, brand, category, subcategory, listPrice, unit,
 *     sfPerBox, image, colorName, colorsAvailable, colorSwatches[], specs{},
 *     status, updatedAt }
 *
 * `sku` is the canonical product identity. `listPrice` is the canonical price
 * field (cart *items* keep their own `price`, a snapshot taken at add-time).
 *
 * FALLBACK
 * --------
 * This is a demo: an empty shop because a function hiccuped is worse than a
 * slightly stale shop. `FALLBACK_PRODUCTS` below is a bundled copy of the
 * catalog the storefront used to hardcode, so `/shop` always renders something.
 * `fetchCatalog()` reports which source it used so the UI can say so honestly.
 *
 * LEGACY KEYS
 * -----------
 * Before the catalog had SKUs, the storefront synthesized `sku-${product.id}`
 * (→ `sku-prod-001`) and that value is already stored in guest carts, saved
 * carts and `project.products`. `resolveProductKey` maps those legacy keys onto
 * whatever the catalog now calls the same product, so nothing gets stranded.
 * The fallback copy deliberately keeps `sku: 'sku-prod-00N'`, identical to the
 * stored values, so the offline path needs no migration at all.
 */

/** Sample lines are keyed `sample-<sku>` so they're distinct from the product. */
const SAMPLE_PREFIX_RE = /^sample-/;

// Bundled fallback catalog. Mirrors the seeded backend catalog.
export const FALLBACK_PRODUCTS = [
  {
    sku: 'sku-prod-001',
    parentSku: null,
    id: 'prod-001',
    name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
    brand: 'Factory Direct',
    colorName: 'Strawthorne Oak',
    colorsAvailable: 6,
    category: 'Hardwood',
    subcategory: 'Engineered Hardwood',
    listPrice: 7.60,
    unit: 'SF',
    sfPerBox: 32.81,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&h=500&fit=crop',
    colorSwatches: ['#8B7355', '#6B4226', '#A0855B', '#D2B48C', '#C4A882', '#5C4033'],
    specs: {
      'Application': 'Commercial, Residential',
      'Length': 'Random',
      'Width': '6.384 Inches',
      'Construction': 'Engineered',
      'Country Of Origin': 'US',
      'Finish': 'UV-Cured Aluminum Oxide',
      'Grade Level': 'On,Above,Below Grade',
      'Installation': 'Floating, Glue, Nail, Staple',
      'Is ADA Compliant': 'No',
      'Is Recommended Outdoors': 'No',
      'Shade Variation': 'V3 - High Variation',
      'Appearance': 'Wire Brushed',
      'Edge Profile': 'Micro Bevel',
      'End Profile': 'Micro Bevel',
      'Gloss Level': 'Low',
      'Style': 'Plank',
      'Type': 'Pre-Finished',
      'Wood Type': 'Oak',
      'Thickness': '0.375 Inches',
      'Size': '6-3/8"',
    },
    badge: 'ProSource Price Protection',
    status: 'active',
  },
  {
    sku: 'sku-prod-002',
    parentSku: null,
    id: 'prod-002',
    name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
    brand: 'COREtec',
    colorName: 'Pembroke Pine',
    colorsAvailable: 8,
    category: 'LVP / LVT',
    subcategory: 'Luxury Vinyl Plank',
    listPrice: 4.99,
    unit: 'SF',
    sfPerBox: 36.64,
    image: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=500&h=500&fit=crop',
    colorSwatches: ['#C4A882', '#8B7355', '#A0855B', '#D2C4B0', '#6B4226', '#B8A590', '#7A6652', '#E8DDD0'],
    specs: {
      'Application': 'Commercial, Residential',
      'Width': '7 Inches',
      'Length': '48 Inches',
      'Thickness': '6.5mm',
      'Wear Layer': '20mil',
      'Construction': 'Rigid Core',
      'Installation': 'Floating',
      'Attached Pad': 'Yes - Cork',
      'Waterproof': 'Yes',
    },
    badge: 'Best Seller',
    status: 'active',
  },
  {
    sku: 'sku-prod-003',
    parentSku: null,
    id: 'prod-003',
    name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
    brand: 'Daltile',
    colorName: 'Brilliant White',
    colorsAvailable: 4,
    category: 'Tile & Stone',
    subcategory: 'Porcelain Tile',
    listPrice: 6.49,
    unit: 'SF',
    sfPerBox: 15.6,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F5F5', '#E0D5C7', '#C4B8A8', '#8A8279'],
    specs: {
      'Application': 'Commercial, Residential',
      'Size': '12x24',
      'Thickness': '3/8 Inches',
      'Finish': 'Polished',
      'PEI Rating': '4',
      'Water Absorption': '<0.5%',
    },
    badge: null,
    status: 'active',
  },
  {
    sku: 'sku-prod-004',
    parentSku: null,
    id: 'prod-004',
    name: 'Shaw Floorigami Carpet Tile - Peel & Stick',
    brand: 'Shaw',
    colorName: 'Cozy Taupe',
    colorsAvailable: 12,
    category: 'Carpet',
    subcategory: 'Carpet Tile',
    listPrice: 3.29,
    unit: 'SF',
    sfPerBox: 36.0,
    image: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=500&h=500&fit=crop',
    colorSwatches: ['#C4B8A8', '#8B7355', '#A0855B', '#6B6B6B', '#3D3D3D', '#D2C4B0'],
    specs: {
      'Application': 'Residential',
      'Size': '18x18',
      'Fiber': 'PET Polyester',
      'Weight': '24 oz',
      'Installation': 'Peel & Stick',
      'Backing': 'Pressure Sensitive Adhesive',
    },
    badge: null,
    status: 'active',
  },
  {
    sku: 'sku-prod-005',
    parentSku: null,
    id: 'prod-005',
    name: 'Silestone Calacatta Gold Quartz Countertop',
    brand: 'Silestone',
    colorName: 'Calacatta Gold',
    colorsAvailable: 1,
    category: 'Countertops',
    subcategory: 'Quartz',
    listPrice: 72.00,
    unit: 'SF',
    sfPerBox: null,
    image: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F0E8'],
    specs: {
      'Application': 'Residential, Commercial',
      'Thickness': '2cm / 3cm',
      'Finish': 'Polished',
      'Stain Resistant': 'Yes',
      'Heat Resistant': 'Yes',
    },
    badge: 'New',
    status: 'active',
  },
  {
    sku: 'sku-prod-006',
    parentSku: null,
    id: 'prod-006',
    name: 'KraftMaid Durham Maple Shaker Cabinet',
    brand: 'KraftMaid',
    colorName: 'Dove White',
    colorsAvailable: 6,
    category: 'Cabinets',
    subcategory: 'Base Cabinet',
    listPrice: 485.00,
    unit: 'EA',
    sfPerBox: null,
    image: 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F0E8', '#D2C4B0', '#8B7355', '#3D3D3D', '#A0855B', '#C4A882'],
    specs: {
      'Style': 'Shaker',
      'Material': 'Maple',
      'Construction': 'All Plywood',
      'Door Type': 'Full Overlay',
      'Soft Close': 'Yes',
      'Width Options': '12" - 36"',
    },
    badge: null,
    status: 'active',
  },
];

export const CATEGORIES = ['All', 'Hardwood', 'LVP / LVT', 'Tile & Stone', 'Carpet', 'Cabinets', 'Countertops'];

export const DEPARTMENTS = {
  Flooring: ['Hardwood', 'LVP / LVT', 'Tile & Stone', 'Carpet'],
  Cabinets: ['Cabinets'],
  Countertops: ['Countertops'],
  Kitchen: ['Cabinets', 'Countertops', 'Tile & Stone'],
  Bath: ['Tile & Stone', 'Cabinets', 'Countertops'],
};

const asNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Coerce one raw catalog record into the shape the storefront renders.
 * Defensive on purpose: the storefront must not blow up because one product
 * came back missing `specs` or with `listPrice` as a string.
 */
export const normalizeProduct = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const sku = String(raw.sku || raw.id || '').trim();
  if (!sku) return null;
  const swatches = Array.isArray(raw.colorSwatches) ? raw.colorSwatches.filter(Boolean) : [];
  return {
    ...raw,
    sku,
    parentSku: raw.parentSku || null,
    // Legacy `id` is kept when present: it's what old `?product=` links and old
    // stored cart keys were built from.
    id: raw.id || sku,
    name: raw.name || 'Product',
    brand: raw.brand || '',
    category: raw.category || 'Other',
    subcategory: raw.subcategory || '',
    listPrice: asNumber(raw.listPrice ?? raw.price),
    unit: raw.unit || 'EA',
    sfPerBox: asNumber(raw.sfPerBox),
    image: raw.image || '',
    colorName: raw.colorName || '',
    colorsAvailable: asNumber(raw.colorsAvailable) || swatches.length || 1,
    colorSwatches: swatches,
    specs: raw.specs && typeof raw.specs === 'object' ? raw.specs : {},
    status: raw.status || 'active',
  };
};

/**
 * Load the catalog. Never rejects: a failure downgrades to the bundled copy
 * and reports it, so callers can render a banner instead of an empty shop.
 * Returns { products, source: 'api' | 'fallback', error }.
 */
export const fetchCatalog = async () => {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
    const data = await res.json();
    const list = Array.isArray(data?.products) ? data.products : null;
    if (!list) throw new Error('Catalog response had no products');
    const products = list.map(normalizeProduct).filter(Boolean);
    // An empty-but-valid response still means a broken shop. Prefer the copy.
    if (products.length === 0) throw new Error('Catalog came back empty');
    return { products, source: 'api', error: null };
  } catch (err) {
    return {
      products: FALLBACK_PRODUCTS.map(normalizeProduct).filter(Boolean),
      source: 'fallback',
      error: err.message || 'Catalog unavailable',
    };
  }
};

// -------- SKU identity + legacy resolution --------

/** Strip the sample prefix off a stored cart key to get the product identity. */
const baseSkuFromKey = (key) => String(key || '').replace(SAMPLE_PREFIX_RE, '');

/**
 * Every identity a stored key might have meant, most specific first.
 * `sample-sku-prod-001` → ['sample-sku-prod-001', 'sku-prod-001', 'prod-001']
 */
const keyCandidates = (key) => {
  const base = baseSkuFromKey(key);
  const out = [String(key || ''), base];
  // The pre-catalog storefront synthesized `sku-${id}`; recover the raw id.
  if (base.startsWith('sku-')) out.push(base.slice(4));
  else out.push(`sku-${base}`);
  return out.filter(Boolean);
};

const cleanName = (name) =>
  String(name || '').replace(/\s*\(sample\)$/i, '').trim().toLowerCase();

/**
 * Legacy id/sku → product name, built from the bundled copy.
 *
 * This is the bridge that stops old links and old carts from rotting. The live
 * catalog re-keyed every product (`sku-prod-001` → `FD-PIER-OAK-STRAW`) and
 * dropped the `id` field entirely, so a legacy key matches *nothing* in it by
 * identity. But the bundled copy still carries `id: 'prod-001'` alongside the
 * name, and names are stable across the re-key, so legacy id → name → live
 * product resolves. Without this, `/shop?product=prod-001` 404s and a bare
 * stored key with no snapshot name is stranded.
 */
const LEGACY_NAME_BY_KEY = FALLBACK_PRODUCTS.reduce((acc, p) => {
  if (p.id) acc[p.id] = p.name;
  if (p.sku) acc[p.sku] = p.name;
  return acc;
}, {});

/**
 * Resolve a stored key (canonical sku, legacy `sku-prod-001`, or bare
 * `prod-001`) to a catalog product, in order:
 *   1. identity: sku or id, including the sample/colour-stripped base
 *   2. the item's own snapshot name, for carts saved before the catalog existed
 *   3. the legacy key → name bridge above, for links carrying only an old id
 * Returns null when nothing matches.
 */
export const resolveProduct = (key, products, item = null) => {
  if (!key || !Array.isArray(products) || products.length === 0) return null;
  const candidates = keyCandidates(key);
  for (const candidate of candidates) {
    const hit = products.find((p) => p.sku === candidate || p.id === candidate);
    if (hit) return hit;
  }
  // Names are stable and unique in this catalog, and a stranded cart line is
  // worse than a name match.
  const byName = (name) =>
    name ? products.find((p) => cleanName(p.name) === name) || null : null;

  const fromItem = byName(cleanName(item?.name));
  if (fromItem) return fromItem;

  for (const candidate of candidates) {
    const legacy = byName(cleanName(LEGACY_NAME_BY_KEY[candidate]));
    if (legacy) return legacy;
  }
  return null;
};

/** Canonical sku for a stored key, or null when the catalog doesn't know it. */
export const resolveProductKey = (key, products, item = null) => {
  const product = resolveProduct(key, products, item);
  return product ? product.sku : null;
};

/**
 * Rewrite stored item keys onto canonical SKUs, preserving the `sample-` prefix
 * that makes a sample line distinct from the product itself.
 * Non-destructive: an item the catalog can't resolve keeps the key it had, and
 * still renders from its own snapshot. Idempotent, because it runs on every cart
 * change, so a second pass must be a no-op.
 */
export const migrateItemKeys = (items, products) => {
  if (!Array.isArray(items) || !Array.isArray(products) || products.length === 0) {
    return { items: Array.isArray(items) ? items : [], changed: false };
  }
  let changed = false;
  const next = items.map((item) => {
    if (!item) return item;
    const key = item.sku || item.id;
    if (!key) return item;
    const canonical = resolveProductKey(key, products, item);
    if (!canonical) return item;
    const isSample = SAMPLE_PREFIX_RE.test(String(key)) || !!item.isSample;
    const nextSku = `${isSample ? 'sample-' : ''}${canonical}`;
    if (nextSku === item.sku) return item;
    changed = true;
    return { ...item, sku: nextSku, legacySku: item.sku };
  });
  return { items: next, changed };
};

/**
 * Colour variants of a product: sibling SKUs sharing a `parentSku`, ordered
 * with the product itself first. Empty when the catalog has no siblings, which
 * is the storefront's cue that swatches aren't selectable options.
 */
export const colorVariants = (product, products) => {
  if (!product || !Array.isArray(products)) return [];
  const family = product.parentSku || product.sku;
  const siblings = products.filter(
    (p) => p.status !== 'inactive' && (p.parentSku || p.sku) === family
  );
  if (siblings.length < 2) return [];
  return [product, ...siblings.filter((p) => p.sku !== product.sku)];
};
