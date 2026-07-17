import { getStore } from "@netlify/blobs";
import {
  TWILIO_ENABLED,
  getRestClient,
  ensureConversation,
} from "./lib/twilio.mjs";
import {
  AM_MEMBER_CAST,
  AM_SELF,
  AM_THREAD_SCRIPT,
  DEMO_ACCOUNT_USER_ID,
  HOMEOWNER_THREAD_SCRIPT,
  TWILIO_SEED_VERSION,
  twilioSeedMarkerKey,
} from "./lib/seed.mjs";

/**
 * Server-side Twilio Conversations operations.
 *
 * GET  /api/twilio-conversations?userId=...
 *   → list this user's conversations from Twilio (live data, no blob)
 *
 * POST /api/twilio-conversations
 *   body: { action: "seed", userId, userType?, projectIds?, force? }
 *     → idempotently create the demo conversations this user should actually
 *       have. A trade pro gets his six demo personas; a homeowner gets her
 *       account manager, her designer and her installer; an account manager gets
 *       her own members. See resolveUserType and the seed plans.
 *       Runs on every Messages init and blocks before the SDK connects, so it
 *       skips out at a version marker once it has nothing left to do. `force`
 *       ignores the marker: the client sends it when it can SEE the marker is
 *       lying, because a conversation the marker claims to have created is not
 *       among the ones it is subscribed to. See TWILIO_SEED_VERSION.
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
//
// Every identity with an AI voice behind it belongs in here, whoever it talks
// to, because this is also the list the retirement sweep works from: an identity
// missing from it can never be recognised as a thread an account should no
// longer be holding.
const DEMO_PARTICIPANTS = {
  kim: "demo-kim-marks",
  bubba: "demo-bubba-beans",
  ryan: "demo-ryan-otoole",
  sarah: "demo-sarah-chen",
  heather: "demo-heather-yager",
  denise: "demo-denise-okafor",
  // The account manager's AI members. Described in lib/seed.mjs rather than
  // here because their identity has to agree with the userId of the account
  // behind it and the connection that carries both, and none of that is this
  // file's business. See AM_MEMBER_CAST.
  ...Object.fromEntries(AM_MEMBER_CAST.map((m) => [m.key, m.identity])),
};

const PROJECT_KEY_BY_PARTICIPANT = {
  [DEMO_PARTICIPANTS.kim]: "working",
  [DEMO_PARTICIPANTS.bubba]: "working",
  [DEMO_PARTICIPANTS.ryan]: "complete",
  [DEMO_PARTICIPANTS.sarah]: "published",
  [DEMO_PARTICIPANTS.heather]: "published",
  // Denise is the Chicago showroom's AM, and the working project is where the
  // account's second showroom actually touches the demo: she is on that
  // project's team in lib/seed.mjs for the same reason.
  [DEMO_PARTICIPANTS.denise]: "working",
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
  // Kept identical to Denise's thread in lib/seed.mjs (buildSeedMessages), so
  // the conversation reads the same whether Messages is backed by Twilio or by
  // the blob.
  [DEMO_PARTICIPANTS.denise]: {
    name: "Denise Okafor",
    initials: "DO",
    role: "Account Manager",
    type: "prosource",
    history: [
      {
        from: "denise",
        body: "Denise at ProSource Chicago. Kim looped me in on the Beans kitchen: the Pembroke Pine LVP is back-ordered out of St. Louis and I have it on the floor here.",
      },
      { from: "user", body: "Good to know. What would it take to get it down to us?" },
      {
        from: "denise",
        body: "Our truck runs to St. Louis on Thursdays. Get me the square footage today and it goes on this week's run.",
      },
    ],
  },
  // The account manager's AI members. Their card and their thread come from the
  // cast in lib/seed.mjs, where the blob transport reads them too, so the two
  // transports cannot drift into two different conversations. Their history is
  // written TO an account manager, because Tessa is the only person any of them
  // talks to: they are on nobody's roster but hers (see AM_ROSTER below).
  ...Object.fromEntries(
    AM_MEMBER_CAST.map((m) => [
      m.identity,
      {
        name: m.name,
        initials: m.initials,
        role: m.role,
        type: m.type,
        history: m.history,
      },
    ])
  ),
};

/**
 * Who each kind of account is actually seeded threads with.
 *
 * DEMO_DETAILS is a cast list, not a roster: it describes everyone with an AI
 * voice, and it grew past the six the trade pro knows the moment the account
 * manager got members of her own. Seeding "everyone in DEMO_DETAILS" was fine
 * while those were the same set and is a bug now, so who-gets-whom is written
 * down instead of inferred.
 *
 * The trade pro's six, in this exact order, are what he has always had and are
 * not to be touched: they are the heart of the demo.
 */
const TRADEPRO_ROSTER = [
  DEMO_PARTICIPANTS.kim,
  DEMO_PARTICIPANTS.bubba,
  DEMO_PARTICIPANTS.ryan,
  DEMO_PARTICIPANTS.sarah,
  DEMO_PARTICIPANTS.heather,
  DEMO_PARTICIPANTS.denise,
];

const uniqueNameFor = (userId, otherIdentity) =>
  `ps-${userId}__${otherIdentity}`;

// ---------------------------------------------------------------------------
// Who is being seeded?
//
// `userType` is the parameter, and it is the same vocabulary the session and the
// profile already speak (auth-context's `userType`, PERSONAS[*].profile.userType
// in demo-session.mjs). Reusing that string means no third naming scheme and no
// translation table. It is an enum rather than an `isAccountManager` flag so a
// fourth kind of account is a new case here, not a new boolean at every call
// site.
//
// It is optional, and absent it is resolved from the userId. That matters:
// seeding is decided by WHOSE conversations these are, the server knows the demo
// accounts by their deterministic userIds, and the only caller
// (src/prosource-messages.jsx) does not currently hand its userType down to
// twilio-client. So the fallback is what fixes the live account manager rather
// than a change nobody made yet, and an explicit `userType` still wins for any
// caller that does know.
//
// Anything unrecognised is a trade pro, which is exactly what every caller got
// before this parameter existed, and his path is byte for byte the seed it
// already was. The homeowner path is the one that has changed: she used to be
// "a member" too, and a member meant Justin's six.
const USER_TYPE_BY_USER_ID = {
  [DEMO_ACCOUNT_USER_ID.tradepro]: "tradepro",
  [DEMO_ACCOUNT_USER_ID.homeowner]: "homeowner",
  [DEMO_ACCOUNT_USER_ID.am]: "accountmanager",
};

const DEFAULT_USER_TYPE = "tradepro";

const resolveUserType = (claimed, userId) =>
  (typeof claimed === "string" && claimed) ||
  USER_TYPE_BY_USER_ID[userId] ||
  DEFAULT_USER_TYPE;

/**
 * Marks a conversation as written by the current script for that kind of
 * account.
 *
 * Tessa's threads existed in the live demo under the old scheme (six
 * member-facing personas), and her Kim thread had the wrong words in it.
 * Alicia's are in the same state today: her Kim thread opens with the Shaw LVP
 * samples for the Beans kitchen, which is Justin's kitchen and Justin's
 * conversation. The marker is how the seed tells "I already fixed this one" from
 * "this predates the fix", so the repair happens exactly once instead of wiping
 * a real conversation on every page load.
 *
 * The trade pro has no marker and wants none. His threads have always been
 * right, so there is nothing to repair, and a repair pass over them could only
 * ever throw away chat he has actually had.
 */
const AM_SEED_MARKER = "am";
const HOMEOWNER_SEED_MARKER = "homeowner";

/**
 * Which script's marker an account's threads should be carrying, if any.
 *
 * Absent (the trade pro, and anything unrecognised) means "no repair pass":
 * out-of-plan threads are still retired, but a planned thread is left exactly
 * as it is however old it is.
 */
const SEED_MARKER_BY_USER_TYPE = {
  accountmanager: AM_SEED_MARKER,
  homeowner: HOMEOWNER_SEED_MARKER,
};

/**
 * Where the "I have already seeded this user's conversations" marker lives.
 *
 * In blobs rather than in Twilio, because the whole point is to answer without
 * talking to Twilio: a marker kept in conversation attributes would cost the
 * fetch it exists to avoid. Same store and key convention as the rest of the
 * demo's per-user data, so demo-session.mjs's ?reset=1 clears it alongside
 * everything else (see seedMarkerKeys in lib/seed.mjs).
 */
const markerStore = () => getStore({ name: "ps-user-data", consistency: "strong" });

/**
 * What the seed plan depends on besides its own script, as one comparable string.
 *
 * A member's conversation attributes carry the projectId of the job each thread
 * is about, and those ids are minted by lib/seed.mjs when the projects blob is
 * written, so they change if that blob is ever re-seeded. A marker that only knew
 * the version would then keep the old ids stamped on the conversations and leave
 * every thread pointing at a project that no longer exists. Recording what the
 * plan was built from closes that: different ids, different fingerprint, real
 * seed, and refreshConversationCopy writes the new ones.
 *
 * Taken from the plan rather than from the request, because an account manager's
 * plan reads no project ids at all: her threads are about her members' jobs, not
 * hers, and amSeedPlan stamps projectId: null on every one. Fingerprinting the
 * ids she happened to be handed would re-seed her whenever a project blob she
 * does not use changed, which is a needless round trip to Twilio and a claim
 * that her conversations depend on something they do not.
 */
const planFingerprint = (plan) =>
  plan
    .map((entry) => `${entry.identity}=${entry.attributes?.projectId ?? ""}`)
    .sort()
    .join("|");

const attributesOf = (convo) => {
  try {
    return JSON.parse(convo?.attributes || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * A trade pro's world: his six demo personas, every one of them a scripted
 * contact with an AI voice. His account manager, the second showroom's account
 * manager, his designer, his two clients and his installer.
 *
 * Byte for byte the plan this built before rosters existed, which is the point:
 * the trade pro demo works and nothing here is trying to improve it.
 */
const tradeproSeedPlan = (projectIds) =>
  TRADEPRO_ROSTER.map((identity) => {
    const details = DEMO_DETAILS[identity];
    return {
      identity,
      friendlyName: details.name,
      attributes: {
        counterpartyName: details.name,
        counterpartyInitials: details.initials,
        counterpartyRole: details.role,
        counterpartyType: details.type,
        // The client reads this to decide whether the other side is a
        // scripted demo contact or a real signed-in user.
        counterpartyIdentity: identity,
        projectId: projectIds[PROJECT_KEY_BY_PARTICIPANT[identity]] || null,
      },
      history: details.history,
    };
  });

/**
 * A homeowner's world: her account manager, her designer, her installer.
 *
 * The three of them come from lib/seed.mjs's shared script for the same reason
 * the account manager's do: the blob transport seeds the same threads, and two
 * copies of a conversation drift.
 *
 * This case did not exist before. Every account that was not an account manager
 * got the trade pro's six, so Alicia held threads with two other homeowners and
 * with a contractor's flooring installer, all of them reading like Justin wrote
 * them, because Justin did. A homeowner's people are the showroom's people, and
 * she has no more business in Bubba's kitchen than he has in her bathroom.
 *
 * Her threads DO carry a projectId, unlike the account manager's: the job they
 * are about is her own.
 */
const homeownerSeedPlan = (projectIds) =>
  HOMEOWNER_THREAD_SCRIPT.map((script) => ({
    identity: script.identity,
    friendlyName: script.name,
    attributes: {
      counterpartyName: script.name,
      counterpartyInitials: script.initials,
      counterpartyRole: script.role,
      counterpartyType: script.type,
      counterpartyIdentity: script.identity,
      projectId: projectIds[script.projectKey] || null,
      seedScript: HOMEOWNER_SEED_MARKER,
    },
    history: script.history,
  }));

/**
 * An account manager's world: her members, from lib/seed.mjs's shared script.
 *
 * `parties` is the addition. The flat `counterparty*` attributes describe one
 * fixed side of a conversation, which is fine when the other side is a persona
 * nobody can sign in as, and wrong here: Tessa's thread with Justin has two real
 * people in it, and Justin signing in must see Tessa, not himself. A per-identity
 * map lets each side resolve the other from the same attributes. The flat fields
 * stay alongside it, describing Tessa's view, so anything still reading them
 * (and any conversation seeded before this) keeps working.
 */
const amSeedPlan = (userId) =>
  AM_THREAD_SCRIPT.map((script) => ({
    identity: script.identity,
    friendlyName: script.name,
    attributes: {
      counterpartyName: script.name,
      counterpartyInitials: script.initials,
      counterpartyRole: script.role,
      counterpartyType: script.type,
      counterpartyIdentity: script.identity,
      // Her threads are about her members' jobs, which are not her projects.
      projectId: null,
      seedScript: AM_SEED_MARKER,
      parties: {
        [userId]: {
          name: AM_SELF.name,
          initials: AM_SELF.initials,
          role: AM_SELF.role,
          type: AM_SELF.type,
        },
        [script.identity]: {
          name: script.name,
          initials: script.initials,
          role: script.role,
          type: script.type,
        },
      },
    },
    // Same contract as DEMO_DETAILS: "user" is authored as the signed-in user,
    // anything else as the counterparty.
    history: script.history,
  }));

/**
 * Undo the old seeding scheme for one account. Runs before the real threads are
 * seeded, and is a no-op from the second call onwards.
 *
 * The old seed handed EVERY account the six demo personas, so the live demo has
 * accounts holding threads that are somebody else's: Tessa with Bubba asking to
 * come to the showroom Saturday, Alicia with Sarah thanking her for a patio.
 * Those cannot simply be left alone. Seeding is idempotent by uniqueName and
 * skips a conversation that already has messages, so without this the wrong
 * threads survive the fix and stay in the list (the client renders every
 * conversation it is subscribed to, not just the ones the plan names), and the
 * Kim thread keeps copy written for a different person forever.
 *
 * Deleting rather than un-subscribing: `ps-${userId}__${identity}` is per-user,
 * so these conversations belong to this account alone and nobody else's list can
 * lose anything. Justin's own Kim thread is `ps-ps-demo-prosource-com__...` and
 * is untouched by a sweep of Alicia's. Removing just the participant would leave
 * a conversation with nothing but a persona in it: orphaned, which is the thing
 * we were told to avoid.
 *
 * Two rules, both narrow on purpose:
 *   • not in this account's plan -> should never have existed for it; delete it.
 *     This is what takes Bubba, Sarah and Denise off the homeowner's list, and
 *     what took the same crowd off the account manager's.
 *   • in the plan -> delete ONLY while it lacks `marker`, so the wrong words are
 *     replaced exactly once and every later seed leaves the real conversation
 *     that has been going on alone. A caller with no marker (the trade pro)
 *     never reaches this rule at all: nothing planned is even fetched.
 *
 * A conversation carrying a `connectionId` is spared either way: that is one the
 * user opened themselves from Connections, not one the seed wrote, and it is not
 * ours to throw away.
 */
const retireStaleConversations = async (client, userId, plan, marker) => {
  const planned = new Set(plan.map((entry) => entry.identity));
  // Only ever considers identities with a persona behind them. Threads with a
  // real account (the account manager's with Justin and Alicia) are keyed by
  // userId and can never match, so they are out of reach of this sweep.
  const candidates = [
    ...new Set([...Object.values(DEMO_PARTICIPANTS), ...planned]),
  ].filter((identity) => !planned.has(identity) || marker);

  for (const identity of candidates) {
    const uniqueName = uniqueNameFor(userId, identity);
    let convo;
    try {
      convo = await client.conversations.v1.conversations(uniqueName).fetch();
    } catch {
      continue; // nothing there: already retired, or never existed
    }

    const attrs = attributesOf(convo);
    if (attrs.connectionId) continue; // theirs, started by hand
    if (planned.has(identity) && attrs.seedScript === marker) {
      continue; // already reseeded under the current script
    }

    try {
      await client.conversations.v1.conversations(convo.sid).remove();
      console.log(`Retired stale conversation ${uniqueName}`);
    } catch (err) {
      // Best effort. A conversation we cannot remove is a stale thread in a
      // list, not a failed sign-in.
      console.warn(`Failed to retire ${uniqueName}:`, err.message);
    }
  }
};

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
      const { userId, userType, projectIds = {}, force = false } = body;
      if (!userId) {
        return Response.json({ error: "userId required" }, { status: 400 });
      }

      const resolvedType = resolveUserType(userType, userId);
      // Built before the marker is consulted because the fingerprint is taken
      // from it. Costs nothing: building a plan is pure, it is the Twilio calls
      // further down that are worth skipping.
      //
      // Anything unrecognised lands on the trade pro's plan, which is what every
      // caller got before this endpoint knew what kind of account it was seeding.
      const plan =
        resolvedType === "accountmanager"
          ? amSeedPlan(userId)
          : resolvedType === "homeowner"
            ? homeownerSeedPlan(projectIds)
            : tradeproSeedPlan(projectIds);
      const store = markerStore();
      const markerKey = twilioSeedMarkerKey(userId);
      const fingerprint = planFingerprint(plan);

      // Everything below is REST calls to Twilio re-verifying conversations that
      // already exist, on every single open of the Messages page, in front of a
      // user watching a spinner. One blob read answers "already done" instead.
      //
      // The marker is trusted here and nowhere else: this endpoint cannot check
      // it against reality without the fetches it is trying to skip. The client
      // does that check instead, for free, because it subscribes to these
      // conversations anyway and can see which ones actually arrived. That is why
      // `conversations` is echoed back even on this path: it is the claim the
      // client checks. Anything the marker names and the client cannot see is
      // drift, and it comes straight back with force. See initTwilioClient in
      // src/twilio-client.js.
      if (!force) {
        const marker = await store.get(markerKey, { type: "json" }).catch(() => null);
        if (
          marker &&
          marker.version === TWILIO_SEED_VERSION &&
          marker.userType === resolvedType &&
          marker.plan === fingerprint
        ) {
          return Response.json({
            enabled: true,
            userType: resolvedType,
            skipped: true,
            version: TWILIO_SEED_VERSION,
            // What the last real seed created, replayed from the marker rather
            // than read back from Twilio: not reading Twilio is the point.
            conversations: marker.conversations || [],
          });
        }
      }

      // Retire whatever the old scheme left behind before seeding the real
      // threads, so nobody is holding both. A no-op for the trade pro: his plan
      // covers every persona there is a thread for, so there is nothing out of
      // plan to sweep and no marker asking for a rewrite.
      await retireStaleConversations(
        client,
        userId,
        plan,
        SEED_MARKER_BY_USER_TYPE[resolvedType] || null
      );

      // One conversation at a time was costing seconds on every single open of
      // the Messages page: this seed is not a one-off, it runs on every init,
      // and it blocks before the SDK is even allowed to connect. Each entry is
      // half a dozen REST round trips (create, fetch, participants, a message
      // check), so six of them in a chain is ~30 sequential calls to Twilio.
      // The entries are independent of each other, so nothing was being bought
      // by making them queue. Ordering still matters WITHIN a conversation, so
      // each one's history is posted in sequence, inside its own task.
      const created = await Promise.all(
        plan.map(async (entry) => {
          const convo = await ensureConversation({
            uniqueName: uniqueNameFor(userId, entry.identity),
            friendlyName: entry.friendlyName,
            attributes: entry.attributes,
            participants: [userId, entry.identity],
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
            for (const h of entry.history) {
              const author = h.from === "user" ? userId : entry.identity;
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

          return {
            sid: convo.sid,
            identity: entry.identity,
            name: entry.friendlyName,
          };
        })
      );

      // Only once the conversations are actually there. A throw on the way here
      // skips this, leaving the account unmarked and the next open seeding it
      // again, which is the direction to fail in.
      await store.setJSON(markerKey, {
        version: TWILIO_SEED_VERSION,
        userType: resolvedType,
        plan: fingerprint,
        conversations: created,
        seededAt: Date.now(),
      });

      return Response.json({
        enabled: true,
        userType: resolvedType,
        skipped: false,
        version: TWILIO_SEED_VERSION,
        conversations: created,
      });
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
