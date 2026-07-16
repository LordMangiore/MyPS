import { getStore } from "@netlify/blobs";

/**
 * Persist a user profile to the ps-users blob store, keyed by userId.
 *
 * Body: { userId, email, profile }
 *   - userId: required, the ID returned from otp-verify
 *   - email: optional, used to refresh the email→userId mapping with display name
 *   - profile: arbitrary JSON, merged shallowly with any existing record
 *
 * Demo only — no auth check. In production, gate this on a verified session token.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { userId, email, profile } = body || {};

    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }
    if (!profile || typeof profile !== "object") {
      return Response.json({ error: "profile object required" }, { status: 400 });
    }

    const users = getStore({ name: "ps-users", consistency: "strong" });

    let existing = null;
    try {
      existing = await users.get(userId, { type: "json" });
    } catch {}

    const merged = {
      ...(existing || {}),
      ...profile,
      userId,
      email: email || existing?.email || profile.email || null,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
    };

    await users.setJSON(userId, merged);

    // Refresh the email→userId mapping with the latest display name so the
    // login screen / admin tools can show a human-readable label.
    if (email && (profile.firstName || profile.lastName || profile.businessName)) {
      try {
        const emailStore = getStore("ps-email-to-user");
        const normalized = String(email).toLowerCase().trim();
        const mapping = (await emailStore.get(normalized, { type: "json" })) || {};
        await emailStore.setJSON(normalized, {
          ...mapping,
          userId,
          name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || mapping.name,
          businessName: profile.businessName || mapping.businessName,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn("Failed to refresh email mapping:", e.message);
      }
    }

    return Response.json({ success: true, profile: merged });
  } catch (err) {
    console.error("save-profile error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
