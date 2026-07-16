import twilio from "twilio";

/**
 * Shared Twilio Conversations helpers.
 *
 * Auth model:
 *   • Server-side REST calls: use Account SID + Auth Token (twilio() client).
 *   • Client-side SDK access needs an API Key + Secret; we mint JWT access
 *     tokens here. If API Key envs are missing, mintAccessToken returns null
 *     and the frontend should fall back to its blob-backed messaging.
 */

export const TWILIO_ENABLED = !!(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
);

export const TWILIO_TOKEN_MINT_ENABLED = !!(
  TWILIO_ENABLED &&
  process.env.TWILIO_API_KEY_SID &&
  process.env.TWILIO_API_KEY_SECRET
);

/** Lazy REST client. Instantiating without creds throws. */
let _client = null;
export const getRestClient = () => {
  if (!TWILIO_ENABLED) return null;
  if (_client) return _client;
  _client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  return _client;
};

/**
 * Mint a JWT access token granting Conversations Client SDK access for one
 * identity. The frontend hands the identity (= userId) and gets back a token
 * it can use with `new Client(token)`.
 *
 * Returns null if API Key envs are not configured. Returns { token, identity,
 * expiresAt } otherwise.
 */
export const mintAccessToken = (identity, ttlSeconds = 3600) => {
  if (!TWILIO_TOKEN_MINT_ENABLED || !identity) return null;

  const AccessToken = twilio.jwt.AccessToken;
  const ChatGrant = AccessToken.ChatGrant;

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { identity, ttl: ttlSeconds }
  );

  const grant = new ChatGrant({
    serviceSid:
      process.env.TWILIO_CONVERSATIONS_SERVICE_SID || undefined, // default service if unset
  });
  token.addGrant(grant);

  return {
    token: token.toJwt(),
    identity,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
};

/**
 * Ensure a Conversation exists between two participants. Idempotent: finds an
 * existing one matching the participants if possible, otherwise creates a new
 * one tagged with the optional `friendlyName` and `attributes`.
 *
 * For the ProSource demo a "conversation" maps 1:1 to a thread between the
 * trade pro and one of: AM, client, or another trade pro.
 */
export const ensureConversation = async ({
  uniqueName,
  friendlyName,
  attributes = {},
  participants = [],
}) => {
  const client = getRestClient();
  if (!client) throw new Error("Twilio not configured");

  // uniqueName lets us upsert. If it already exists, .create throws and we
  // fall back to fetch.
  let convo;
  try {
    convo = await client.conversations.v1.conversations.create({
      uniqueName,
      friendlyName,
      attributes: JSON.stringify(attributes || {}),
    });
  } catch (err) {
    if (err?.code === 50307 || /already exists/i.test(err?.message || "")) {
      convo = await client.conversations.v1.conversations(uniqueName).fetch();
    } else {
      throw err;
    }
  }

  // Add any missing participants.
  for (const identity of participants) {
    try {
      await client.conversations.v1
        .conversations(convo.sid)
        .participants.create({ identity });
    } catch (err) {
      // 50433 = participant already exists; ignore.
      if (err?.code !== 50433) {
        console.warn(
          `Failed to add participant ${identity} to ${convo.sid}:`,
          err.message
        );
      }
    }
  }

  return convo;
};
