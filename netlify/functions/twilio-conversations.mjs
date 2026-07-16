import {
  TWILIO_ENABLED,
  getRestClient,
  ensureConversation,
} from "./lib/twilio.mjs";

/**
 * Server-side Twilio Conversations operations.
 *
 * GET  /api/twilio-conversations?userId=...
 *   → list this user's conversations from Twilio (live data, no blob)
 *
 * POST /api/twilio-conversations
 *   body: { action: "seed", userId, projectIds? }
 *     → idempotently create the demo conversations between this user and the
 *       seeded teammates (Kim Marks, Bubba Beans, etc.)
 *
 *   body: { action: "create", userId, otherIdentity, friendlyName?, attributes? }
 *     → create / find a 1:1 conversation between two identities
 *
 *   body: { action: "post", conversationSid, identity, body }
 *     → post a message into a conversation (used to seed demo history)
 *
 * Demo-contact auto-replies: the seeded demo identities have no client behind
 * them, so they never answer on their own. src/twilio-client.js watches for a
 * user send into a `demo-*` conversation, asks /api/ai-reply for an in-character
 * line, then posts it back through the `post` action above authored as that demo
 * identity, so it fans out over the same websocket as any other message and the
 * sender sees it arrive live.
 */

// Demo participants we seed conversations with. In production these would be
// real Twilio identities (user IDs). For the demo they're fixed strings.
const DEMO_PARTICIPANTS = {
  kim: "demo-kim-marks",
  bubba: "demo-bubba-beans",
  ryan: "demo-ryan-otoole",
  sarah: "demo-sarah-chen",
  heather: "demo-heather-yager",
};

const PROJECT_KEY_BY_PARTICIPANT = {
  [DEMO_PARTICIPANTS.kim]: "working",
  [DEMO_PARTICIPANTS.bubba]: "working",
  [DEMO_PARTICIPANTS.ryan]: "complete",
  [DEMO_PARTICIPANTS.sarah]: "published",
  [DEMO_PARTICIPANTS.heather]: "published",
};

const DEMO_DETAILS = {
  [DEMO_PARTICIPANTS.kim]: {
    name: "Kim Marks",
    initials: "KM",
    role: "Account Manager",
    type: "prosource",
    history: [
      {
        from: "kim",
        body: "Hi! Just wanted to let you know the Shaw LVP samples for the Beans kitchen came in.",
      },
      { from: "user", body: "Great! Can you hold a few in the Greige Oak and the Smoked Walnut?" },
      {
        from: "kim",
        body: "Absolutely! I also have the tile samples for the Beans kitchen ready for pickup at the showroom.",
      },
    ],
  },
  [DEMO_PARTICIPANTS.bubba]: {
    name: "Bubba Beans",
    initials: "BB",
    role: "Homeowner: Beans Kitchen Remodel",
    type: "client",
    history: [
      {
        from: "user",
        body: "Hey Bubba, Kim has a couple of LVP samples set aside for the kitchen. Want to come look this weekend?",
      },
      {
        from: "bubba",
        body: "Sounds good, I'll be at the showroom Saturday morning to look at the LVP.",
      },
    ],
  },
  [DEMO_PARTICIPANTS.ryan]: {
    name: "Ryan O'Toole",
    initials: "RO",
    role: "Flooring Installer",
    type: "tradepro",
    history: [
      {
        from: "user",
        body: "Thanks again for hustling on the Wilson bath install. Clients are thrilled.",
      },
      {
        from: "ryan",
        body: "All wrapped on the Wilson bath. Ready for the next one whenever you are.",
      },
    ],
  },
  [DEMO_PARTICIPANTS.sarah]: {
    name: "Sarah Chen",
    initials: "SC",
    role: "Homeowner: Chen Outdoor Patio",
    type: "client",
    history: [
      {
        from: "user",
        body: "Hi Sarah, wanted to check in. Anything we should adjust before we put the patio in our portfolio?",
      },
      {
        from: "sarah",
        body: "We finally got the family photos done on the patio and it looks incredible. Thanks again!",
      },
    ],
  },
  [DEMO_PARTICIPANTS.heather]: {
    name: "Heather Yager",
    initials: "HY",
    role: "Designer",
    type: "prosource",
    history: [
      {
        from: "heather",
        body: "Uploaded the Chen patio render variants. Let me know which lighting layout you want me to spec out.",
      },
    ],
  },
};

const uniqueNameFor = (userId, otherIdentity) =>
  `ps-${userId}__${otherIdentity}`;

export default async function handler(req) {
  if (!TWILIO_ENABLED) {
    return Response.json(
      {
        enabled: false,
        reason:
          "Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      },
      { status: 200 }
    );
  }

  try {
    const client = getRestClient();

    if (req.method === "GET") {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return Response.json({ error: "userId required" }, { status: 400 });
      }
      const userConvos = await client.conversations.v1.users(userId)
        .userConversations.list({ limit: 50 })
        .catch(() => []);
      return Response.json({ enabled: true, conversations: userConvos });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "seed") {
      const { userId, projectIds = {} } = body;
      if (!userId) {
        return Response.json({ error: "userId required" }, { status: 400 });
      }

      const created = [];
      for (const [identity, details] of Object.entries(DEMO_DETAILS)) {
        const projectKey = PROJECT_KEY_BY_PARTICIPANT[identity];
        const attrs = {
          counterpartyName: details.name,
          counterpartyInitials: details.initials,
          counterpartyRole: details.role,
          counterpartyType: details.type,
          // The client reads this to decide whether the other side is a
          // scripted demo contact or a real signed-in user.
          counterpartyIdentity: identity,
          projectId: projectIds[projectKey] || null,
        };
        const convo = await ensureConversation({
          uniqueName: uniqueNameFor(userId, identity),
          friendlyName: details.name,
          attributes: attrs,
          participants: [userId, identity],
        });

        // Post seeded history (only if the conversation has zero messages).
        let existingCount = 0;
        try {
          const msgs = await client.conversations.v1
            .conversations(convo.sid)
            .messages.list({ limit: 1 });
          existingCount = msgs.length;
        } catch {}

        if (existingCount === 0) {
          for (const h of details.history) {
            const author = h.from === "user" ? userId : identity;
            try {
              await client.conversations.v1
                .conversations(convo.sid)
                .messages.create({ author, body: h.body });
            } catch (err) {
              console.warn(
                `Failed to seed message in ${convo.sid}:`,
                err.message
              );
            }
          }
        }

        created.push({ sid: convo.sid, identity, name: details.name });
      }

      return Response.json({ enabled: true, conversations: created });
    }

    if (action === "create") {
      const { userId, otherIdentity, friendlyName, attributes } = body;
      if (!userId || !otherIdentity) {
        return Response.json(
          { error: "userId and otherIdentity required" },
          { status: 400 }
        );
      }
      const convo = await ensureConversation({
        uniqueName: uniqueNameFor(userId, otherIdentity),
        friendlyName: friendlyName || otherIdentity,
        // Always stamp the counterparty identity so the client can tell a
        // scripted demo contact from a real user without parsing uniqueName.
        attributes: { ...(attributes || {}), counterpartyIdentity: otherIdentity },
        participants: [userId, otherIdentity],
      });
      return Response.json({ enabled: true, sid: convo.sid });
    }

    if (action === "post") {
      const { conversationSid, identity, body: messageBody } = body;
      if (!conversationSid || !identity || !messageBody) {
        return Response.json(
          { error: "conversationSid, identity, body required" },
          { status: 400 }
        );
      }
      const msg = await client.conversations.v1
        .conversations(conversationSid)
        .messages.create({ author: identity, body: messageBody });
      return Response.json({ enabled: true, sid: msg.sid });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("twilio-conversations error:", err);
    // Twilio test credentials reject most Conversations operations. Surface
    // this as a clean "not enabled" so the frontend falls back to blob mode
    // instead of treating it as a hard error.
    const msg = err?.message || "";
    if (/Test Account Credentials/i.test(msg) || err?.code === 20008) {
      return Response.json({
        enabled: false,
        reason:
          "Twilio Conversations is not available with test credentials. Provide live Account SID + Auth Token to enable.",
      });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
