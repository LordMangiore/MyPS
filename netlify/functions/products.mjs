import { getStore } from "@netlify/blobs";

/**
 * Product catalog: the single source of truth for both the storefront and the
 * admin Product Manager.
 *
 * GET    /api/products                 → { products: [...] }
 * GET    /api/products?status=active   → only active products
 * GET    /api/products?sku=ABC         → that one product (still in a products array)
 * POST   /api/products                 body: { product: {...} }         → upsert one by sku
 * POST   /api/products                 body: { products: [{...}, ...] } → bulk upsert (CSV import)
 * POST   /api/products                 body: { action:"delete", sku }   → delete one
 * DELETE /api/products?sku=ABC                                          → delete one
 *
 * STORAGE: one blob per product, keyed `product/<sku>`, in the "ps-catalog"
 * store. This is deliberate. The rest of this codebase keeps whole collections
 * in a single blob and read-modify-writes the lot on every save, which loses
 * updates when two writers overlap. Here a write touches exactly the one
 * product's key, so concurrent edits to different products cannot clobber each
 * other. A partial POST is merged onto the *stored* product (not onto whatever
 * the client last saw), so a status toggle can't silently revert a field edited
 * in another tab.
 *
 * A POST that omits a field leaves the stored value alone. To clear a field,
 * send it explicitly as null.
 *
 * Self-seeding: SEED_PRODUCTS is written on first access, once, guarded by
 * `meta/seeded`. The guard is a separate key from the products themselves so
 * that deleting every product does not resurrect the catalog on next read.
 *
 * Demo only. No auth check.
 */

const STORE_NAME = "ps-catalog";
const PRODUCT_PREFIX = "product/";
const SEEDED_KEY = "meta/seeded";

// Must stay in sync with the storefront's category list (src/prosource-shop.jsx).
const CATEGORIES = [
  "Hardwood",
  "LVP / LVT",
  "Tile & Stone",
  "Carpet",
  "Cabinets",
  "Countertops",
];

// Tolerate the loose category spellings the old admin catalog used, plus the
// obvious things a CSV import will contain.
const CATEGORY_ALIASES = {
  hardwood: "Hardwood",
  wood: "Hardwood",
  lvp: "LVP / LVT",
  lvt: "LVP / LVT",
  "lvp/lvt": "LVP / LVT",
  "luxury vinyl": "LVP / LVT",
  vinyl: "LVP / LVT",
  tile: "Tile & Stone",
  stone: "Tile & Stone",
  "tile & stone": "Tile & Stone",
  "tile and stone": "Tile & Stone",
  carpet: "Carpet",
  cabinets: "Cabinets",
  cabinet: "Cabinets",
  countertops: "Countertops",
  countertop: "Countertops",
};

const UNITS = ["SF", "EA", "BOX"];

// Old admin catalog units → canonical. 'yard' has no canonical equivalent and
// nothing in the seed uses it; it maps to SF so an import never lands a value
// the storefront can't render.
const UNIT_ALIASES = {
  sqft: "SF",
  sf: "SF",
  "sq ft": "SF",
  sqyd: "SF",
  yard: "SF",
  each: "EA",
  ea: "EA",
  box: "BOX",
  carton: "BOX",
};

/* ------------------------------------------------------------------ *
 * Seed catalog: the union of the two hardcoded catalogs this replaces,
 * normalized to the canonical schema.
 *
 *  - 6 from the storefront (src/prosource-shop.jsx `allProducts`), which had
 *    `id: 'prod-00N'` and no SKU at all. Real SKUs minted here, rich data
 *    (colorSwatches / specs / sfPerBox / images) carried over verbatim.
 *  - 4 from the admin Product Manager (src/prosource-product.jsx
 *    `initialProducts`): `price`→`listPrice`, `unit: 'sqft'`→`'SF'`,
 *    lowercase category → Title Case, placeholder SKUs ("ABC123") → real ones.
 *    They had no colour/box data; plausible values are filled in so they render
 *    in the storefront grid alongside the other six.
 *
 * The two catalogs shared no products, so the union is all 10.
 * ------------------------------------------------------------------ */
const SEED_PRODUCTS = [
  // ---- from the storefront catalog ----
  {
    sku: "FD-PIER-OAK-STRAW",
    id: "prod-001",
    parentSku: "FD-PIER-OAK",
    name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
    brand: "Factory Direct",
    category: "Hardwood",
    subcategory: "Engineered Hardwood",
    listPrice: 7.6,
    unit: "SF",
    sfPerBox: 32.81,
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&h=500&fit=crop",
    colorName: "Strawthorne Oak",
    colorsAvailable: 6,
    colorSwatches: ["#8B7355", "#6B4226", "#A0855B", "#D2B48C", "#C4A882", "#5C4033"],
    specs: {
      Application: "Commercial, Residential",
      Length: "Random",
      Width: "6.384 Inches",
      Construction: "Engineered",
      "Country Of Origin": "US",
      Finish: "UV-Cured Aluminum Oxide",
      "Grade Level": "On,Above,Below Grade",
      Installation: "Floating, Glue, Nail, Staple",
      "Is ADA Compliant": "No",
      "Is Recommended Outdoors": "No",
      "Shade Variation": "V3 - High Variation",
      Appearance: "Wire Brushed",
      "Edge Profile": "Micro Bevel",
      "End Profile": "Micro Bevel",
      "Gloss Level": "Low",
      Style: "Plank",
      Type: "Pre-Finished",
      "Wood Type": "Oak",
      Thickness: "0.375 Inches",
      Size: '6-3/8"',
    },
    badge: "ProSource Price Protection",
    status: "active",
  },
  {
    sku: "CT-PROPLUS-PEMPINE",
    id: "prod-002",
    parentSku: "CT-PROPLUS",
    name: "COREtec Pro Plus Enhanced Luxury Vinyl Plank",
    brand: "COREtec",
    category: "LVP / LVT",
    subcategory: "Luxury Vinyl Plank",
    listPrice: 4.99,
    unit: "SF",
    sfPerBox: 36.64,
    image:
      "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=500&h=500&fit=crop",
    colorName: "Pembroke Pine",
    colorsAvailable: 8,
    colorSwatches: [
      "#C4A882", "#8B7355", "#A0855B", "#D2C4B0",
      "#6B4226", "#B8A590", "#7A6652", "#E8DDD0",
    ],
    specs: {
      Application: "Commercial, Residential",
      Width: "7 Inches",
      Length: "48 Inches",
      Thickness: "6.5mm",
      "Wear Layer": "20mil",
      Construction: "Rigid Core",
      Installation: "Floating",
      "Attached Pad": "Yes - Cork",
      Waterproof: "Yes",
    },
    badge: "Best Seller",
    status: "active",
  },
  {
    sku: "DT-PERP-1224-BWHT",
    id: "prod-003",
    parentSku: "DT-PERP-1224",
    name: "Daltile Perpetuo Porcelain Floor Tile 12x24",
    brand: "Daltile",
    category: "Tile & Stone",
    subcategory: "Porcelain Tile",
    listPrice: 6.49,
    unit: "SF",
    sfPerBox: 15.6,
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=500&h=500&fit=crop",
    colorName: "Brilliant White",
    colorsAvailable: 4,
    colorSwatches: ["#F5F5F5", "#E0D5C7", "#C4B8A8", "#8A8279"],
    specs: {
      Application: "Commercial, Residential",
      Size: "12x24",
      Thickness: "3/8 Inches",
      Finish: "Polished",
      "PEI Rating": "4",
      "Water Absorption": "<0.5%",
    },
    badge: null,
    status: "active",
  },
  {
    sku: "SW-FLORI-CZYTPE",
    id: "prod-004",
    parentSku: "SW-FLORI",
    name: "Shaw Floorigami Carpet Tile - Peel & Stick",
    brand: "Shaw",
    category: "Carpet",
    subcategory: "Carpet Tile",
    listPrice: 3.29,
    unit: "SF",
    sfPerBox: 36.0,
    image:
      "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=500&h=500&fit=crop",
    colorName: "Cozy Taupe",
    colorsAvailable: 12,
    colorSwatches: ["#C4B8A8", "#8B7355", "#A0855B", "#6B6B6B", "#3D3D3D", "#D2C4B0"],
    specs: {
      Application: "Residential",
      Size: "18x18",
      Fiber: "PET Polyester",
      Weight: "24 oz",
      Installation: "Peel & Stick",
      Backing: "Pressure Sensitive Adhesive",
    },
    badge: null,
    status: "active",
  },
  {
    sku: "SS-QTZ-CALGOLD",
    id: "prod-005",
    parentSku: null,
    name: "Silestone Calacatta Gold Quartz Countertop",
    brand: "Silestone",
    category: "Countertops",
    subcategory: "Quartz",
    listPrice: 72.0,
    unit: "SF",
    sfPerBox: null,
    image:
      "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=500&h=500&fit=crop",
    colorName: "Calacatta Gold",
    colorsAvailable: 1,
    colorSwatches: ["#F5F0E8"],
    specs: {
      Application: "Residential, Commercial",
      Thickness: "2cm / 3cm",
      Finish: "Polished",
      "Stain Resistant": "Yes",
      "Heat Resistant": "Yes",
    },
    badge: "New",
    status: "active",
  },
  {
    sku: "KM-DURHAM-DOVEWHT",
    id: "prod-006",
    parentSku: "KM-DURHAM",
    name: "KraftMaid Durham Maple Shaker Cabinet",
    brand: "KraftMaid",
    category: "Cabinets",
    subcategory: "Base Cabinet",
    listPrice: 485.0,
    unit: "EA",
    sfPerBox: null,
    image:
      "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=500&h=500&fit=crop",
    colorName: "Dove White",
    colorsAvailable: 6,
    colorSwatches: ["#F5F0E8", "#D2C4B0", "#8B7355", "#3D3D3D", "#A0855B", "#C4A882"],
    specs: {
      Style: "Shaker",
      Material: "Maple",
      Construction: "All Plywood",
      "Door Type": "Full Overlay",
      "Soft Close": "Yes",
      "Width Options": '12" - 36"',
    },
    badge: null,
    status: "active",
  },

  // ---- from the admin Product Manager catalog ----
  {
    sku: "SW-VENOAK-ENG-NAT",
    parentSku: "SW-VENOAK",
    name: "Venetian Oak Hardwood",
    brand: "Shaw",
    category: "Hardwood",
    subcategory: "Engineered Hardwood",
    listPrice: 4.29,
    unit: "SF",
    sfPerBox: 29.53,
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop",
    colorName: "Natural Venetian",
    colorsAvailable: 4,
    colorSwatches: ["#A0855B", "#8B7355", "#C4A882", "#5C4033"],
    specs: {
      Thickness: "3/8 in",
      Width: "5 in",
      Finish: "Hand Scraped",
      Construction: "Engineered",
    },
    badge: null,
    status: "active",
  },
  {
    sku: "DT-CARRARA-1224-POL",
    parentSku: "DT-CARRARA",
    name: "Carrara Marble Tile",
    brand: "Daltile",
    category: "Tile & Stone",
    subcategory: "Porcelain Tile",
    listPrice: 6.99,
    unit: "SF",
    sfPerBox: 15.6,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&h=500&fit=crop",
    colorName: "Carrara White",
    colorsAvailable: 3,
    colorSwatches: ["#F0F0EE", "#E3E3DF", "#CFCFC9"],
    specs: {
      Thickness: "3/8 in",
      Size: "12x24",
      Finish: "Polished",
    },
    badge: null,
    status: "active",
  },
  {
    sku: "MW-PLSHCMF-STN",
    parentSku: "MW-PLSHCMF",
    name: "Plush Comfort Carpet",
    brand: "Mohawk",
    category: "Carpet",
    subcategory: "Plush",
    listPrice: 3.49,
    unit: "SF",
    sfPerBox: null,
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop",
    colorName: "Sandstone",
    colorsAvailable: 6,
    colorSwatches: ["#D2C4B0", "#C4B8A8", "#8B7355", "#6B6B6B", "#3D3D3D", "#E8DDD0"],
    specs: {
      Weight: "40 oz",
      Fiber: "Nylon",
      Backing: "Action Back",
    },
    badge: null,
    // Carried over from the old admin catalog, which had this one inactive.
    // Keeps an inactive row in the manager and out of the storefront.
    status: "inactive",
  },
  {
    sku: "CT-WPLVP-GRYOAK",
    parentSku: "CT-WPLVP",
    name: "Waterproof LVP - Gray Oak",
    brand: "COREtec",
    category: "LVP / LVT",
    subcategory: "Luxury Vinyl Plank",
    listPrice: 4.99,
    unit: "SF",
    sfPerBox: 23.77,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&h=500&fit=crop",
    colorName: "Gray Oak",
    colorsAvailable: 5,
    colorSwatches: ["#9A9A94", "#B8B2A8", "#7A7A74", "#D2C4B0", "#5C5C58"],
    specs: {
      Thickness: "6mm",
      "Wear Layer": "20mil",
      "Attached Pad": "Yes",
      Waterproof: "Yes",
    },
    badge: null,
    status: "active",
  },
];

/* ------------------------------------------------------------------ */

const store = () => getStore({ name: STORE_NAME, consistency: "strong" });

const productKey = (sku) => PRODUCT_PREFIX + sku;

/** SKUs are blob keys, so keep them to a safe, predictable shape. */
const normalizeSku = (raw) => {
  if (typeof raw !== "string") return null;
  const sku = raw.trim().toUpperCase().replace(/\s+/g, "-");
  if (!sku || !/^[A-Z0-9._-]+$/.test(sku)) return null;
  return sku;
};

const normalizeCategory = (raw) => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (CATEGORIES.includes(trimmed)) return trimmed;
  return CATEGORY_ALIASES[trimmed.toLowerCase()] || null;
};

const normalizeUnit = (raw) => {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (UNITS.includes(upper)) return upper;
  return UNIT_ALIASES[raw.trim().toLowerCase()] || null;
};

const normalizeNumber = (raw) => {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

/** Fill in every canonical field so stored products always have the full shape. */
const withDefaults = (p) => ({
  sku: p.sku,
  // Legacy storefront id ('prod-001'), carried for the six products that
  // predate SKUs. Old `?product=prod-001` links and cart keys stored as
  // `sku-prod-001` resolve through this. Without it the storefront's only
  // bridge to those records is a product-name match, which this admin UI can
  // now break at any time, since renaming a product is a supported edit.
  // Never set for new products; null is correct for them.
  id: p.id ?? null,
  parentSku: p.parentSku ?? null,
  name: p.name ?? "",
  brand: p.brand ?? "",
  category: p.category,
  subcategory: p.subcategory ?? "",
  listPrice: p.listPrice ?? null,
  unit: p.unit ?? "SF",
  sfPerBox: p.sfPerBox ?? null,
  image: p.image ?? "",
  colorName: p.colorName ?? null,
  colorsAvailable: p.colorsAvailable ?? null,
  colorSwatches: Array.isArray(p.colorSwatches) ? p.colorSwatches : [],
  specs: p.specs && typeof p.specs === "object" ? p.specs : {},
  badge: p.badge ?? null,
  status: p.status === "inactive" ? "inactive" : "active",
  updatedAt: p.updatedAt ?? new Date().toISOString().slice(0, 10),
});

/**
 * Merge an incoming (possibly partial) product onto the stored one and validate.
 * `existing` is null for a create. Returns { product } or { error }.
 */
const buildProduct = (incoming, existing) => {
  const sku = normalizeSku(incoming.sku);
  if (!sku) return { error: "A valid sku is required (letters, digits, . _ -)" };

  const merged = { ...(existing || {}), ...incoming, sku };

  if (!existing && !String(merged.name || "").trim()) {
    return { error: "name is required" };
  }

  const category = normalizeCategory(merged.category);
  if (!category) {
    return {
      error: `category must be one of: ${CATEGORIES.join(", ")} (got ${JSON.stringify(
        merged.category ?? null
      )})`,
    };
  }

  const unit = normalizeUnit(merged.unit ?? "SF");
  if (!unit) {
    return { error: `unit must be one of: ${UNITS.join(", ")}` };
  }

  if (merged.parentSku !== null && merged.parentSku !== undefined && merged.parentSku !== "") {
    const parent = normalizeSku(merged.parentSku);
    if (!parent) return { error: "parentSku must be a valid sku or null" };
    merged.parentSku = parent;
  } else {
    merged.parentSku = null;
  }

  return {
    product: withDefaults({
      ...merged,
      category,
      unit,
      listPrice: normalizeNumber(merged.listPrice),
      sfPerBox: normalizeNumber(merged.sfPerBox),
      colorsAvailable: normalizeNumber(merged.colorsAvailable),
      updatedAt: new Date().toISOString().slice(0, 10),
    }),
  };
};

/**
 * Write the seed catalog once, ever. The `meta/seeded` guard is checked first
 * and set last; a torn seed just re-runs on the next request (writes are
 * idempotent: same sku, same key). Deleting all products does NOT re-seed.
 */
const ensureSeeded = async (s) => {
  const seeded = await s.get(SEEDED_KEY, { type: "json" }).catch(() => null);
  if (seeded) return;
  await Promise.all(
    SEED_PRODUCTS.map((p) => s.setJSON(productKey(p.sku), withDefaults(p)))
  );
  await s.setJSON(SEEDED_KEY, { at: Date.now(), count: SEED_PRODUCTS.length });
};

const listProducts = async (s) => {
  const { blobs } = await s.list({ prefix: PRODUCT_PREFIX });
  const products = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null))
  );
  return products
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export default async function handler(req) {
  try {
    const s = store();
    const url = new URL(req.url);

    if (req.method === "GET") {
      await ensureSeeded(s);
      let products = await listProducts(s);

      const status = url.searchParams.get("status");
      if (status === "active" || status === "inactive") {
        products = products.filter((p) => p.status === status);
      }

      const sku = normalizeSku(url.searchParams.get("sku") || "");
      if (sku) products = products.filter((p) => p.sku === sku);

      return Response.json({ products });
    }

    if (req.method === "POST") {
      await ensureSeeded(s);
      const body = await req.json().catch(() => ({}));

      // Delete-by-action, for clients that can't easily send DELETE.
      if (body?.action === "delete") {
        const sku = normalizeSku(body.sku);
        if (!sku) return Response.json({ error: "valid sku required" }, { status: 400 });
        await s.delete(productKey(sku));
        return Response.json({ success: true, deleted: sku });
      }

      // One product, or a batch (CSV import). Normalize both to a list.
      const incoming = Array.isArray(body?.products)
        ? body.products
        : [body?.product || body];

      if (!incoming.length || !incoming.every((p) => p && typeof p === "object")) {
        return Response.json({ error: "product or products[] required" }, { status: 400 });
      }

      const saved = [];
      const errors = [];

      // Sequential on purpose: each product is read-merged-written against its
      // own key, so this only serializes the round trips, never a shared blob.
      for (const item of incoming) {
        const sku = normalizeSku(item.sku);
        const existing = sku
          ? await s.get(productKey(sku), { type: "json" }).catch(() => null)
          : null;
        const { product, error } = buildProduct(item, existing);
        if (error) {
          errors.push({ sku: item?.sku ?? null, error });
          continue;
        }
        await s.setJSON(productKey(product.sku), product);
        saved.push(product);
      }

      // A single failed upsert is a 400 so the admin UI can surface it; a batch
      // reports per-row results and lets the good rows through.
      if (!Array.isArray(body?.products) && errors.length) {
        return Response.json({ error: errors[0].error }, { status: 400 });
      }

      return Response.json({
        success: errors.length === 0,
        saved,
        savedCount: saved.length,
        errors,
      });
    }

    if (req.method === "DELETE") {
      const sku = normalizeSku(url.searchParams.get("sku") || "");
      if (!sku) return Response.json({ error: "valid sku required" }, { status: 400 });
      await s.delete(productKey(sku));
      return Response.json({ success: true, deleted: sku });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error("products error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
