import { getStore } from "@netlify/blobs";

/**
 * Look up a ProSource user by email.
 *
 * GET  /api/lookup-user?email=foo@bar.com
 *
 * Returns:
 *   { found: true, user: { userId, email, firstName, lastName, name, role, type, businessName } }
 *   { found: false, email }
 *
 * Demo only — no auth gate.
 */
export default async function handler(req) {
  try {
    let email = null;
    if (req.method === "GET") {
      email = new URL(req.url).searchParams.get("email");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      email = body.email;
    } else {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    const normalized = String(email).toLowerCase().trim();

    const emailStore = getStore("ps-email-to-user");
    const mapping = await emailStore.get(normalized, { type: "json" }).catch(() => null);

    if (!mapping?.userId) {
      return Response.json({ found: false, email: normalized });
    }

    // Hydrate from the profile store if possible so we can show their real
    // name + business + role on the invite confirmation.
    const userStore = getStore({ name: "ps-users", consistency: "strong" });
    const profile = await userStore.get(mapping.userId, { type: "json" }).catch(() => null);

    const firstName = profile?.firstName || "";
    const lastName = profile?.lastName || "";
    const name =
      [firstName, lastName].filter(Boolean).join(" ") ||
      mapping.name ||
      normalized.split("@")[0];

    // userType is set on the profile; map to the connections "type" classification.
    const userType = profile?.userType || "tradepro";
    const type = userType === "homeowner" ? "client" : "tradepro";

    return Response.json({
      found: true,
      user: {
        userId: mapping.userId,
        email: normalized,
        firstName,
        lastName,
        name,
        role:
          profile?.business?.tradeType ||
          profile?.business?.businessType ||
          (type === "client" ? "Homeowner" : "Trade Pro"),
        type,
        businessName: profile?.business?.name || mapping.businessName || "",
        phone: profile?.phone || "",
        address: profile?.businessAddress
          ? [profile.businessAddress.city, profile.businessAddress.state]
              .filter(Boolean)
              .join(", ")
          : profile?.address
          ? [profile.address.city, profile.address.state]
              .filter(Boolean)
              .join(", ")
          : "",
      },
    });
  } catch (err) {
    console.error("lookup-user error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
