import { mintAccessToken, TWILIO_TOKEN_MINT_ENABLED } from "./lib/twilio.mjs";

/**
 * Mint a Twilio Conversations access token for the requesting user.
 *
 * GET  /api/twilio-token?userId=ps-...
 * POST { userId }
 *
 * Demo only — no session validation. Production should verify the userId
 * against the request's session token before issuing a token.
 *
 * Returns:
 *   200 { enabled: true, token, identity, expiresAt }
 *   200 { enabled: false, reason } when API Key env vars aren't set
 */
export default async function handler(req) {
  try {
    if (!TWILIO_TOKEN_MINT_ENABLED) {
      return Response.json({
        enabled: false,
        reason:
          "Twilio API Key not configured. Set TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET to enable Conversations client SDK.",
      });
    }

    let userId = null;
    if (req.method === "GET") {
      userId = new URL(req.url).searchParams.get("userId");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      userId = body.userId;
    } else {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }

    const result = mintAccessToken(userId);
    if (!result) {
      return Response.json(
        { error: "Failed to mint token" },
        { status: 500 }
      );
    }
    return Response.json({ enabled: true, ...result });
  } catch (err) {
    console.error("twilio-token error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
