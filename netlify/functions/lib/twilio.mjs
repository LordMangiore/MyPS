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
const parseAttributes = (raw) => {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Bring an existing conversation's copy up to date.
 *
 * Attributes and friendlyName used to be written once, at creation, and never
 * revisited: an existing conversation was only fetched. That means a conversation
 * created before a copy change keeps the old wording forever, in Twilio, where no
 * amount of editing this repo can reach it. That is not hypothetical: names and
 * roles are rendered straight into the thread list, so the live demo was still
 * showing text that had already been rewritten here.
 *
 * Merges rather than replaces: keys the caller does not mention are left alone,
 * so anything written by another flow (a `connectionId` on a thread started by
 * hand, say) survives. Writes only when something actually changed, so the common
 * case stays a single fetch.
 */
const refreshConversationCopy = async (client, convo, uniqueName, friendlyName, attributes) => {
  const current = parseAttributes(convo.attributes);
  const merged = { ...current, ...(attributes || {}) };
  const attrsChanged = JSON.stringify(merged) !== JSON.stringify(current);
  const nameChanged = !!friendlyName && convo.friendlyName !== friendlyName;
  if (!attrsChanged && !nameChanged) return convo;
  try {
    return await client.conversations.v1.conversations(uniqueName).update({
      ...(nameChanged ? { friendlyName } : {}),
      ...(attrsChanged ? { attributes: JSON.stringify(merged) } : {}),
    });
  } catch (err) {
    // Stale copy is better than no conversation.
    console.warn(`Could not refresh conversation ${uniqueName}:`, err.message);
    return convo;
  }
};

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
      convo = await refreshConversationCopy(client, convo, uniqueName, friendlyName, attributes);
    } else {
      throw err;
    }
  }

  // Add any missing participants. In parallel: they are independent of each
  // other, and this runs on every Messages init, where each extra round trip to
  // Twilio is time the user spends looking at a spinner.
  await Promise.all(
    participants.map(async (identity) => {
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
    })
  );

  return convo;
};
