import { getStore } from "@netlify/blobs";

/**
 * Generic per-user blob persistence.
 *
 * POST /api/user-data       body: { userId, key, value }   → upsert
 * GET  /api/user-data?userId=X&key=projects                → { value | null }
 *
 * Stored in the "ps-user-data" store keyed by `${userId}::${key}`. Lets us
 * persist arbitrary feature state (projects, messages, carts, etc.) without
 * spinning up a new endpoint per feature.
 *
 * Demo only: no auth check.
 */

const ALLOWED_KEYS = new Set([
  "projects",
  "messages",
  "carts",
  "connections",
  "notifications",
  "orders",
  "appointments",
  "discussions",
  "consultations",
  // Users the account owner has invited onto their own ProSource account
  // (Settings > Manage Users). Shape: { list: [...] }. Distinct from
  // "connections", which is other businesses you work with rather than people
  // holding access to your account.
  "team",
]);

const sanitizeKey = (k) => {
  if (!k || typeof k !== "string") return null;
  // Whitelist only known keys to keep the namespace tidy.
  return ALLOWED_KEYS.has(k) ? k : null;
};

const blobKey = (userId, key) => `${userId}::${key}`;

export default async function handler(req) {
  try {
    const store = getStore({ name: "ps-user-data", consistency: "strong" });

    if (req.method === "GET") {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      const key = sanitizeKey(url.searchParams.get("key"));
      if (!userId || !key) {
        return Response.json({ error: "userId and valid key required" }, { status: 400 });
      }
      const value = await store.get(blobKey(userId, key), { type: "json" }).catch(() => null);
      return Response.json({ value: value ?? null });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { userId, key: rawKey, value } = body || {};
      const key = sanitizeKey(rawKey);
      if (!userId || !key) {
        return Response.json({ error: "userId and valid key required" }, { status: 400 });
      }
      if (value === undefined) {
        return Response.json({ error: "value required" }, { status: 400 });
      }
      await store.setJSON(blobKey(userId, key), {
        value,
        updatedAt: Date.now(),
      });
      return Response.json({ success: true });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error("user-data error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
