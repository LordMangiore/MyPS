import { getStore } from "@netlify/blobs";

/**
 * Fetch a saved user profile from the ps-users blob store.
 *
 * GET  /api/get-profile?userId=xxx
 * GET  /api/get-profile?email=foo@bar.com   (resolves userId via ps-email-to-user)
 * POST { userId } | { email }
 *
 * Returns { profile } or { profile: null } if no record exists yet.
 */
export default async function handler(req) {
  try {
    let userId = null;
    let email = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      userId = url.searchParams.get("userId");
      email = url.searchParams.get("email");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      userId = body.userId;
      email = body.email;
    } else {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!userId && email) {
      const emailStore = getStore("ps-email-to-user");
      try {
        const mapping = await emailStore.get(String(email).toLowerCase().trim(), {
          type: "json",
        });
        userId = mapping?.userId || null;
      } catch {}
    }

    if (!userId) {
      return Response.json({ profile: null });
    }

    const users = getStore({ name: "ps-users", consistency: "strong" });
    const profile = await users.get(userId, { type: "json" }).catch(() => null);

    return Response.json({ profile: profile || null });
  } catch (err) {
    console.error("get-profile error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
