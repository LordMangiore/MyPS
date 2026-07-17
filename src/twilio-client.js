/**
 * Twilio Conversations Client wrapper for the demo.
 *
 * Why a wrapper rather than using @twilio/conversations directly:
 *   • Lazy-load the SDK so the bundle stays slim if Twilio isn't enabled.
 *   • Probe the /api/twilio-token endpoint first; if it returns
 *     `{ enabled: false }` (test creds, missing API key, etc.) we skip the
 *     SDK entirely so the UI cleanly falls back to its blob-backed mode.
 *   • Normalize messages and threads to the same shape the existing UI uses
 *     (id/name/initials/type/role/lastMessage/timestamp/unread/messages[])
 *     so the swap is a single state source change, not a UI rewrite.
 */

/**
 * The seeded demo contacts. These identities exist server-side in
 * netlify/functions/twilio-conversations.mjs (DEMO_PARTICIPANTS) and in
 * netlify/functions/ai-reply.mjs (PERSONAS). Mirrored here so the client can
 *   (a) recognise when the other side of a conversation is a scripted contact
 *       rather than a real person, and
 *   (b) resolve the dashboard's legacy `?thread=<slug>` deep links.
 */
export const DEMO_CONTACTS = {
  kim: { identity: 'demo-kim-marks', name: 'Kim Marks' },
  denise: { identity: 'demo-denise-okafor', name: 'Denise Okafor' },
  bubba: { identity: 'demo-bubba-beans', name: 'Bubba Beans' },
  ryan: { identity: 'demo-ryan-otoole', name: "Ryan O'Toole" },
  sarah: { identity: 'demo-sarah-chen', name: 'Sarah Chen' },
  heather: { identity: 'demo-heather-yager', name: 'Heather Yager' },
};

const DEMO_IDENTITY_SET = new Set(
  Object.values(DEMO_CONTACTS).map((c) => c.identity)
);

/** True only for the seeded contacts we're allowed to speak for. */
export const isDemoIdentity = (identity) => DEMO_IDENTITY_SET.has(identity);

/** Resolve a legacy dashboard `?thread=kim` slug to a demo contact. */
export const demoContactForSlug = (slug) =>
  DEMO_CONTACTS[String(slug || '').trim().toLowerCase()] || null;

// Compat shim. Seeded connection records are growing `demoIdentity` fields, but
// until every record carries one we can still recognise the five seeded demo
// contacts by name. Checked LAST, so a real `demoIdentity`/`userId` always wins.
const DEMO_IDENTITY_BY_NAME = Object.fromEntries(
  Object.values(DEMO_CONTACTS).map((c) => [c.name.toLowerCase(), c.identity])
);

/**
 * THE identity resolver: the single source of truth for "who is this
 * connection, in Twilio terms?". Every conversation lookup and creation goes
 * through this, so the same person always maps to exactly one conversation.
 *
 *   seeded demo contact     -> connection.demoIdentity  ("demo-kim-marks")
 *   real signed-in user     -> connection.userId        ("ps-jane@acme.com")
 *   invited, not yet joined -> null (NOT messageable, "Invitation pending")
 *
 * Previously this was `conn-${connection.id}` here but `resolvedUser.userId` in
 * the connections invite flow, so the same person produced two conversations.
 */
export function identityForConnection(connection) {
  if (!connection) return null;
  if (connection.demoIdentity) return connection.demoIdentity;
  if (connection.userId) return connection.userId;
  const byName = DEMO_IDENTITY_BY_NAME[String(connection.name || '').trim().toLowerCase()];
  return byName || null;
}

/** Convenience for the UI: can we open a thread with this person at all? */
export const isMessageable = (connection) => !!identityForConnection(connection);

let cachedSdk = null;
const loadSdk = async () => {
  if (cachedSdk) return cachedSdk;
  const mod = await import('@twilio/conversations');
  // The SDK ships as CJS; Vite exposes it via `default`. Be defensive against
  // both shapes so we keep working if a future build promotes named exports.
  cachedSdk = mod.Client ? mod : (mod.default || mod);
  return cachedSdk;
};

const fetchTokenInfo = async (userId) => {
  try {
    const res = await fetch(`/api/twilio-token?userId=${encodeURIComponent(userId)}`);
    return await res.json();
  } catch {
    return { enabled: false, reason: 'Token endpoint unreachable' };
  }
};

/**
 * Ask the server for this user's demo conversations.
 *
 * `userType` says which world to seed: a member (trade pro, homeowner) gets the
 * six demo personas, an account manager gets her own members. It is optional and
 * omitted when unknown, because the server resolves it from the userId anyway
 * and its answer is the better one: the session only carries a copy of what the
 * server already knows. Passing it is for the caller that has it to hand.
 *
 * `force` tells the server to ignore its seed marker and do the work. Only sent
 * from the drift check in initTwilioClient, which is the one place that can see
 * the marker is wrong.
 *
 * Returns the server's reply, which carries `skipped: true` when the marker
 * answered and nothing was actually verified against Twilio.
 */
const seedDemoConversations = async (userId, projectIds = {}, userType, force = false) => {
  try {
    const res = await fetch('/api/twilio-conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'seed',
        userId,
        projectIds,
        ...(userType ? { userType } : {}),
        ...(force ? { force: true } : {}),
      }),
    });
    return await res.json();
  } catch (err) {
    return { enabled: false, reason: err.message };
  }
};

/**
 * Ask the shared persona service for an in-character reply.
 *
 * `/api/ai-reply` is the contract, but its [[redirects]] entry in netlify.toml
 * is still landing. Netlify always serves functions at /.netlify/functions/<name>
 * regardless of redirects, so fall back to that path on a 404 rather than
 * silently dropping the reply. Once the redirect ships the first call succeeds
 * and the fallback never fires.
 */
const AI_REPLY_PATHS = ['/api/ai-reply', '/.netlify/functions/ai-reply'];
let aiReplyPath = null;

const fetchAiReply = async ({ identity, message, history, context }) => {
  const payload = JSON.stringify({
    identity,
    message,
    history,
    surface: 'messages',
    ...(context ? { context } : {}),
  });
  const paths = aiReplyPath ? [aiReplyPath] : AI_REPLY_PATHS;

  for (const path of paths) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.status === 404) continue; // redirect not live yet, try direct path
      const data = await res.json();
      // `source` is "ai" or "canned" (key missing / API blip). Both are valid
      // replies and must be treated identically. Neither is surfaced in the UI.
      if (data?.reply) {
        aiReplyPath = path; // remember the path that worked
        return data.reply;
      }
      return null;
    } catch {
      // try the next candidate path
    }
  }
  return null;
};

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const fmtDate = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const fmtPreviewTimestamp = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return fmtTime(ts);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Who is on the other side of this conversation, as a Twilio identity?
 *
 * Prefer the `counterpartyIdentity` attribute we now stamp server-side, but
 * fall back to parsing it out of the uniqueName (`ps-${userId}__${identity}`)
 * so conversations created before that attribute existed still resolve.
 */
const counterpartyIdentityOf = (conv, userId, attrs) => {
  if (attrs?.counterpartyIdentity) return attrs.counterpartyIdentity;
  const uniqueName = conv?.uniqueName || '';
  const marker = `ps-${userId}__`;
  if (uniqueName.startsWith(marker)) return uniqueName.slice(marker.length);
  return null;
};

/**
 * Who is on the other side of this conversation, FROM THIS USER'S SIDE?
 *
 * The flat `counterparty*` attributes name one fixed side, decided by whoever
 * seeded the conversation. That is right for a member's threads with the demo
 * personas, where nobody else is ever subscribed, and wrong for a thread between
 * two real accounts: the account manager's seed describes Justin, so Justin
 * signing in would find a thread called "Justin Reyes" with his own name printed
 * over Tessa's messages.
 *
 * `parties` is a per-identity map, so each side resolves the other from the same
 * attributes. Conversations without one (every member thread, and anything
 * seeded before this) fall through to the flat fields and are unchanged.
 */
const counterpartyOf = (conv, userId, attrs) => {
  const parties = attrs?.parties;
  if (parties && typeof parties === 'object') {
    const identity = Object.keys(parties).find((id) => id !== userId);
    if (identity) return { identity, ...parties[identity] };
  }
  return {
    identity: counterpartyIdentityOf(conv, userId, attrs),
    name: attrs?.counterpartyName,
    initials: attrs?.counterpartyInitials,
    role: attrs?.counterpartyRole,
    type: attrs?.counterpartyType,
  };
};

const conversationToThread = async (conv, userId) => {
  // Pull attributes (we set these server-side in seed).
  let attrs = {};
  try {
    attrs = (await conv.getAttributes()) || {};
  } catch {}

  const other = counterpartyOf(conv, userId, attrs);

  // Pull recent messages.
  let messages = [];
  try {
    const page = await conv.getMessages(50);
    messages = page.items.map((m, idx) => {
      const ts = m.dateCreated ? new Date(m.dateCreated).getTime() : Date.now();
      const isMe = m.author === userId;
      return {
        id: idx + 1,
        sender: isMe ? 'Me' : (other.name || m.author),
        isMe,
        text: m.body || '',
        time: fmtTime(ts),
        date: fmtDate(ts),
        timestamp: ts,
      };
    });
  } catch {}

  const last = messages[messages.length - 1];
  const lastTs = last?.timestamp || (conv.dateUpdated ? new Date(conv.dateUpdated).getTime() : Date.now());

  let unread = false;
  try {
    const u = await conv.getUnreadMessagesCount();
    unread = (u || 0) > 0;
  } catch {}

  return {
    id: conv.sid,
    sid: conv.sid,
    projectId: attrs.projectId || null,
    counterpartyIdentity: other.identity,
    connectionId: attrs.connectionId ?? null,
    name: other.name || conv.friendlyName || conv.sid,
    initials: other.initials || (other.name || '??').split(' ').map(s => s[0]).join('').slice(0, 2),
    type: other.type || 'tradepro',
    role: other.role || '',
    lastMessage: last?.text || '',
    timestamp: fmtPreviewTimestamp(lastTs),
    unread,
    updatedAt: lastTs,
    messages,
    _conv: conv,
  };
};

/**
 * Initialize a Twilio Conversations client for this user.
 * Returns { enabled, client, threads, sendMessage, markRead } or { enabled: false }.
 */
export async function initTwilioClient({
  userId,
  projectIds = {},
  // Optional. See seedDemoConversations: the server resolves this from the
  // userId when it isn't supplied, so a caller that doesn't have it to hand
  // still gets the right world seeded.
  userType,
  onThreadsChanged,
  onDemoTyping,
}) {
  if (!userId) return { enabled: false, reason: 'No userId' };

  const tokenInfo = await fetchTokenInfo(userId);
  if (!tokenInfo.enabled) return { enabled: false, reason: tokenInfo.reason };

  // Make sure the demo conversations exist (idempotent server-side). If the
  // underlying Twilio account can't host Conversations (e.g. test creds),
  // bail out before connecting the SDK so we cleanly fall back to blob mode.
  const seedResult = await seedDemoConversations(userId, projectIds, userType);
  if (seedResult.enabled === false) {
    return { enabled: false, reason: seedResult.reason };
  }

  const { Client } = await loadSdk();
  const client = new Client(tokenInfo.token);

  await new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn) => (...args) => { if (done) return; done = true; fn(...args); };
    const ok = finish(resolve);
    const fail = finish((msg) => reject(new Error(msg)));

    // Listen on multiple signals. The SDK emits both granular state changes
    // and convenience events. Whichever fires first wins.
    client.on('initialized', () => ok());
    client.on('initFailed', (info) => fail(info?.error?.message || 'initFailed'));
    client.on('stateChanged', (state) => {
      if (state === 'initialized') ok();
      else if (state === 'failed' || state === 'denied') fail(`Twilio client state: ${state}`);
    });

    // Safety timeout so a stuck SDK doesn't permanently freeze the messages
    // page on the loading state. Falls back to blob mode after 8s.
    setTimeout(() => fail('Twilio init timed out'), 8000);
  });

  const loadAllThreads = async () => {
    const subs = await client.getSubscribedConversations();
    let all = [...subs.items];
    let page = subs;
    while (page.hasNextPage) {
      page = await page.nextPage();
      all = all.concat(page.items);
    }
    const threads = await Promise.all(all.map((c) => conversationToThread(c, userId)));
    threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return threads;
  };

  // Which conversations the server says this user's seed created. On the skip
  // path the server replays these from its marker without looking at Twilio, so
  // this is precisely the claim the marker is making and the claim we are about
  // to check for free.
  const seededIdentities = (seedResult.conversations || [])
    .map((c) => c?.identity)
    .filter(Boolean);

  /**
   * How many of the seeded conversations we are not actually subscribed to.
   * Zero is the healthy answer.
   *
   * By identity rather than by count: a thread the user started by hand from
   * Connections is a real conversation and pads the count, so counting alone
   * would let a missing seeded thread hide behind one the user opened
   * themselves. Comparing identities cannot be fooled that way, and a user with
   * MORE threads than the seed made is simply healthy.
   *
   * When the server told us nothing about what it seeded (a marker written
   * before this field existed), fall back to the emptiness check this replaced.
   */
  const missingSeededCount = (loaded) => {
    if (!seededIdentities.length) return loaded.length ? 0 : 1;
    const have = new Set(loaded.map((t) => t.counterpartyIdentity).filter(Boolean));
    return seededIdentities.filter((id) => !have.has(id)).length;
  };

  const loadThreadsSettled = async () => {
    let loaded = await loadAllThreads();
    // The client can report an empty or partial conversation list for a beat
    // after 'initialized' while the initial sync is still landing. Observed
    // live: the page rendered a false "No conversations yet" on a fast reload.
    // Retry briefly before believing what we see. Costs nothing once everything
    // has arrived, because then there is nothing missing to wait for.
    for (let attempt = 0; attempt < 6 && missingSeededCount(loaded); attempt++) {
      await new Promise((r) => setTimeout(r, 400));
      loaded = await loadAllThreads();
    }
    return loaded;
  };

  let threads = await loadThreadsSettled();

  // The way back from a lying marker.
  //
  // The server skips its seed on a version marker, which it has to trust blind:
  // checking it against Twilio would cost exactly the round trips the marker
  // exists to save. Here it is free. We are subscribed to this user's
  // conversations already, so we can just look, and a seeded conversation that
  // is not among them, against a marker swearing it was created, is drift: the
  // blob survived something the conversations did not (deleted in the Twilio
  // console, a different Conversations service, an account swap). Left alone it
  // is a Messages page missing threads that no amount of reloading repairs,
  // which is exactly the trap the old re-seed-every-time was paying to avoid.
  //
  // Gated on `skipped` on purpose. If the server really did do the work and a
  // conversation still is not here, seeding harder will not help: that is Twilio
  // failing, not a stale marker, and the honest fallback is what we have rather
  // than a loop.
  const missing = missingSeededCount(threads);
  if (missing && seedResult.skipped) {
    console.warn(
      `Twilio seed marker claims ${seededIdentities.length} conversation(s), ${missing} did not arrive: reseeding.`
    );
    const forced = await seedDemoConversations(userId, projectIds, userType, true);
    if (forced.enabled !== false) threads = await loadThreadsSettled();
  }

  const refresh = async () => {
    threads = await loadAllThreads();
    onThreadsChanged?.(threads);
  };

  client.on('messageAdded', refresh);
  client.on('conversationAdded', refresh);
  client.on('conversationUpdated', refresh);
  // Fires for each conversation as the initial sync completes. Without this a
  // late sync leaves the UI stuck on whatever the first (possibly empty) load saw.
  client.on('conversationJoined', refresh);
  client.on('conversationLeft', refresh);

  // ---- Token refresh -------------------------------------------------------
  // Access tokens carry a 1h TTL (netlify/functions/lib/twilio.mjs). Without
  // this the websocket silently drops mid-demo and messaging just stops. The
  // SDK warns ~3min before expiry, and fires tokenExpired if we miss that.
  const renewToken = async () => {
    try {
      const info = await fetchTokenInfo(userId);
      if (info?.enabled && info.token) {
        await client.updateToken(info.token);
      } else {
        console.warn('Twilio token refresh: endpoint returned no token', info?.reason);
      }
    } catch (err) {
      console.warn('Twilio token refresh failed:', err.message);
    }
  };
  client.on('tokenAboutToExpire', renewToken);
  client.on('tokenExpired', renewToken);

  /**
   * Make a seeded demo contact answer.
   *
   * The demo identities are fixed strings with no client behind them, so they
   * never reply on their own. When the member posts into one of their threads we
   * ask /api/ai-reply for an in-character line and post it back authored as that
   * demo identity. It then arrives over the same websocket as any other message,
   * so the member watches it land in real time. Nothing is faked client-side.
   *
   * Anti-loop / safety, in order:
   *   1. only ever called from sendMessage (a user-authored send), never from an
   *      inbound message event, so a reply can't trigger another reply;
   *   2. isDemoIdentity() gates on the five seeded contacts, so real user-to-user
   *      conversations never auto-reply;
   *   3. the reply is authored as `identity` (the demo contact), never as userId.
   */
  const maybeDemoReply = async (thread, userText) => {
    const identity = thread?.counterpartyIdentity;
    if (!isDemoIdentity(identity)) return; // real people answer for themselves

    // Oldest-first recent turns, from the demo contact's point of view:
    // the member is "user", the persona's own past lines are "them".
    const history = (thread.messages || [])
      .slice(-12)
      .map((m) => ({ from: m.isMe ? 'user' : 'them', body: m.text }))
      .filter((h) => h.body);

    onDemoTyping?.(thread.sid, true);
    try {
      // ai-reply is not streaming and takes a beat; that latency IS most of the
      // human-ish pause. Only top it up to a floor so replies never feel instant.
      const startedAt = Date.now();
      const reply = await fetchAiReply({
        identity,
        message: userText,
        history,
        context: thread.projectName ? { projectName: thread.projectName } : undefined,
      });
      if (!reply) return;

      const MIN_PAUSE = 1400;
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PAUSE) {
        await new Promise((r) => setTimeout(r, MIN_PAUSE - elapsed));
      }

      const res = await fetch('/api/twilio-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post',
          conversationSid: thread.sid,
          identity, // authored as the demo contact, never as the member
          body: reply,
        }),
      });
      // fetch doesn't throw on a 4xx/5xx, so check explicitly. Otherwise a
      // rejected post is indistinguishable from a delivered one.
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `post failed (${res.status})`);
      }
      // No refresh() here: the post fans out over the websocket and the
      // messageAdded listener picks it up, exactly like a real participant.
    } catch (err) {
      console.warn('Demo reply failed:', err.message);
    } finally {
      onDemoTyping?.(thread.sid, false);
    }
  };

  const sendMessage = async (threadSid, body) => {
    const conv = await client.getConversationBySid(threadSid);
    await conv.sendMessage(body);
    await refresh();

    // Fire-and-forget so the member's own message renders immediately. Errors
    // are swallowed inside maybeDemoReply, because a missing reply must never make the
    // member's send look like it failed.
    const thread = threads.find((t) => t.sid === threadSid);
    if (thread) maybeDemoReply(thread, body);
  };

  /**
   * Open (or create) a 1:1 conversation between the current user and a
   * connection record. Returns the thread sid you can pass to sendMessage.
   * Idempotent: calling with the same connection returns the existing convo,
   * because the identity resolver and the server's uniqueName are both derived
   * from the counterparty's real identity rather than the local connection row.
   */
  const startConversation = async (connection) => {
    const otherIdentity = identityForConnection(connection);
    if (!otherIdentity) {
      throw new Error(
        `${connection?.name || 'This person'} hasn't joined yet. Their invitation is still pending.`
      );
    }

    // If we already hold a thread with this identity, reuse it rather than
    // asking the server to resolve it again.
    const existing = threads.find((t) => t.counterpartyIdentity === otherIdentity);
    if (existing) return existing.sid;

    const res = await fetch('/api/twilio-conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        userId,
        otherIdentity,
        friendlyName: connection.name,
        attributes: {
          counterpartyName: connection.name,
          counterpartyInitials: connection.initials,
          counterpartyRole: connection.role,
          counterpartyType: connection.type,
          counterpartyIdentity: otherIdentity,
          connectionId: connection.id,
        },
      }),
    });
    const data = await res.json();
    if (!data.sid) throw new Error(data.error || 'Failed to start conversation');
    await refresh();
    return data.sid;
  };

  const markRead = async (threadSid) => {
    try {
      const conv = await client.getConversationBySid(threadSid);
      await conv.setAllMessagesRead();
    } catch {}
  };

  return {
    enabled: true,
    client,
    threads,
    refresh,
    sendMessage,
    markRead,
    startConversation,
  };
}
