import { setDeactivated } from "./lib/account-status.mjs";

/**
 * Deactivate or reactivate a myProSource account.
 *
 * POST { userId, action: "deactivate" | "reactivate" }
 *
 * Deactivating hides the member from lookups other members make (connections,
 * invites) and stops email notifications to them. Their ProSource membership
 * is untouched; the showroom manages that. Signing back in reactivates.
 *
 * Demo only, no auth check, same as save-profile. In production, gate this on
 * a verified session token for `userId`.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { userId, action } = await req.json().catch(() => ({}));
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
    if (action !== "deactivate" && action !== "reactivate") {
      return Response.json({ error: "action must be deactivate or reactivate" }, { status: 400 });
    }
    const profile = await setDeactivated(userId, action === "deactivate");
    return Response.json({ success: true, deactivatedAt: profile.deactivatedAt || null });
  } catch (err) {
    console.error("account-status error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
