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

const seedDemoConversations = async (userId, projectIds = {}) => {
  try {
    const res = await fetch('/api/twilio-conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', userId, projectIds }),
    });
    return await res.json();
  } catch (err) {
    return { enabled: false, reason: err.message };
  }
};

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const fmtDate = (ts) => {
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

const fmtPreviewTimestamp = (ts) => {
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

const conversationToThread = async (conv, userId) => {
  // Pull attributes (we set these server-side in seed).
  let attrs = {};
  try {
    attrs = (await conv.getAttributes()) || {};
  } catch {}

  // Pull recent messages.
  let messages = [];
  try {
    const page = await conv.getMessages(50);
    messages = page.items.map((m, idx) => {
      const ts = m.dateCreated ? new Date(m.dateCreated).getTime() : Date.now();
      const isMe = m.author === userId;
      return {
        id: idx + 1,
        sender: isMe ? 'Me' : (attrs.counterpartyName || m.author),
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
    name: attrs.counterpartyName || conv.friendlyName || conv.sid,
    initials: attrs.counterpartyInitials || (attrs.counterpartyName || '??').split(' ').map(s => s[0]).join('').slice(0, 2),
    type: attrs.counterpartyType || 'tradepro',
    role: attrs.counterpartyRole || '',
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
export async function initTwilioClient({ userId, projectIds = {}, onThreadsChanged }) {
  if (!userId) return { enabled: false, reason: 'No userId' };

  const tokenInfo = await fetchTokenInfo(userId);
  if (!tokenInfo.enabled) return { enabled: false, reason: tokenInfo.reason };

  // Make sure the demo conversations exist (idempotent server-side). If the
  // underlying Twilio account can't host Conversations (e.g. test creds),
  // bail out before connecting the SDK so we cleanly fall back to blob mode.
  const seedResult = await seedDemoConversations(userId, projectIds);
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

    // Listen on multiple signals — the SDK emits both granular state changes
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

  let threads = await loadAllThreads();

  const refresh = async () => {
    threads = await loadAllThreads();
    onThreadsChanged?.(threads);
  };

  client.on('messageAdded', refresh);
  client.on('conversationAdded', refresh);
  client.on('conversationUpdated', refresh);

  const sendMessage = async (threadSid, body) => {
    const conv = await client.getConversationBySid(threadSid);
    await conv.sendMessage(body);
    await refresh();
  };

  /**
   * Open (or create) a 1:1 conversation between the current user and a
   * connection record. Returns the thread sid you can pass to sendMessage.
   * Idempotent — calling with the same connection returns the existing convo.
   */
  const startConversation = async (connection) => {
    const otherIdentity = `conn-${connection.id}`;
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
