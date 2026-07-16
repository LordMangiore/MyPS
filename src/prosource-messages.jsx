import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from './auth-context';
import {
  initTwilioClient,
  identityForConnection,
  demoContactForSlug,
  fmtDate,
  fmtPreviewTimestamp,
} from './twilio-client';

const ProSourceMessages = () => {
  const { loadUserData, saveUserData, userId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThread, setSelectedThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  // 'twilio' once Twilio Conversations is up; 'blob' is the fallback that
  // persists threads to ps-user-data. Probed on mount.
  const [transport, setTransport] = useState('blob');
  // 'loading' until we know which transport we're on and have real threads —
  // otherwise mock threads flash and then hard-swap under the user.
  const [status, setStatus] = useState('loading');
  const [sendError, setSendError] = useState('');
  const [notice, setNotice] = useState('');
  // Thread sid -> true while a demo contact is composing a reply.
  const [typingSid, setTypingSid] = useState(null);
  const twilioRef = useRef(null);
  const messagesEndRef = useRef(null);

  const colors = {
    red: '#BA0C2F',
    darkBlue: '#003087',
    lightBlue: '#6CACE4',
    green: '#07542E',
    gray100: '#f5f5f5',
    gray200: '#e5e5e5',
    gray300: '#d4d4d4',
    gray400: '#a3a3a3',
    gray500: '#737373',
    gray700: '#404040',
    gray900: '#171717',
  };

  const styles = {
    wrapper: {
      background: '#fafafa',
      minHeight: '100vh',
      fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    container: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '32px 24px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      color: colors.darkBlue,
      fontSize: 14,
      fontWeight: 500,
      textDecoration: 'none',
      marginBottom: 24,
    },
    pageHeader: {
      marginBottom: 24,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: 700,
      color: colors.gray900,
      marginBottom: 8,
    },
    pageDesc: {
      fontSize: 14,
      color: colors.gray500,
      lineHeight: 1.6,
    },
    chatContainer: {
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      overflow: 'hidden',
      height: 'calc(100vh - 180px)',
      minHeight: 500,
      background: '#fff',
    },
    threadList: {
      borderRight: `1px solid ${colors.gray200}`,
      flexDirection: 'column',
      overflow: 'hidden',
    },
    searchWrapper: {
      padding: 16,
      borderBottom: `1px solid ${colors.gray200}`,
    },
    searchInput: {
      width: '100%',
      padding: '10px 14px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
    },
    threadScroll: {
      flex: 1,
      overflowY: 'auto',
    },
    threadItem: (isSelected, isUnread) => ({
      display: 'flex',
      gap: 12,
      padding: '14px 16px',
      cursor: 'pointer',
      borderBottom: `1px solid ${colors.gray100}`,
      background: isSelected ? '#e3f2fd' : isUnread ? '#fafbff' : '#fff',
      borderLeft: isUnread ? `3px solid ${colors.red}` : '3px solid transparent',
      transition: 'background 0.1s ease',
    }),
    avatar: (type) => ({
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: type === 'prosource'
        ? `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.darkBlue} 100%)`
        : type === 'tradepro'
        ? `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.green} 100%)`
        : colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: type === 'client' ? colors.gray500 : '#fff',
      fontWeight: 600,
      fontSize: 14,
      flexShrink: 0,
    }),
    threadInfo: {
      flex: 1,
      minWidth: 0,
    },
    threadHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    threadName: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
    },
    threadTime: {
      fontSize: 11,
      color: colors.gray400,
      flexShrink: 0,
    },
    threadRole: {
      fontSize: 12,
      color: colors.gray500,
      marginBottom: 4,
    },
    threadPreview: {
      fontSize: 13,
      color: colors.gray500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: colors.red,
      flexShrink: 0,
      marginLeft: 8,
    },
    conversationPanel: {
      flexDirection: 'column',
      overflow: 'hidden',
    },
    convHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray200}`,
    },
    convHeaderName: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
    },
    convHeaderRole: {
      fontSize: 13,
      color: colors.gray500,
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    dateDivider: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.gray400,
      margin: '8px 0',
    },
    messageRow: (isMe) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMe ? 'flex-end' : 'flex-start',
      width: '100%',
    }),
    messageBubble: (isMe) => ({
      maxWidth: '75%',
      padding: '10px 14px',
      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      background: isMe ? colors.darkBlue : '#fff',
      color: isMe ? '#fff' : colors.gray900,
      border: isMe ? 'none' : `1px solid ${colors.gray200}`,
      fontSize: 14,
      lineHeight: 1.5,
      boxShadow: isMe ? '0 1px 2px rgba(0,48,135,0.15)' : '0 1px 2px rgba(0,0,0,0.04)',
      wordBreak: 'break-word',
    }),
    messageTime: (isMe) => ({
      fontSize: 11,
      color: colors.gray400,
      marginTop: 4,
      textAlign: isMe ? 'right' : 'left',
    }),
    inputBar: {
      display: 'flex',
      gap: 8,
      padding: '12px 20px',
      borderTop: `1px solid ${colors.gray200}`,
      alignItems: 'center',
    },
    messageInput: {
      flex: 1,
      padding: '10px 14px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
    },
    banner: (kind) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      marginBottom: kind === 'notice' ? 16 : 0,
      borderTop: kind === 'error' ? `1px solid ${colors.gray200}` : 'none',
      border: kind === 'notice' ? `1px solid ${kind === 'error' ? '#fecaca' : '#fed7aa'}` : 'none',
      borderRadius: kind === 'notice' ? 8 : 0,
      background: kind === 'error' ? '#fef2f2' : '#fff7ed',
      color: kind === 'error' ? '#991b1b' : '#9a3412',
      fontSize: 13,
    }),
    bannerClose: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
      padding: 2,
    },
    sendBtn: {
      padding: '10px 16px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 14,
      fontWeight: 500,
    },
    emptyState: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.gray400,
      gap: 12,
    },
  };

  // No mock threads: an account with no conversations shows a real empty
  // state. Blob mode gets its seeded threads from the server (seed.mjs).
  const [threads, setThreads] = useState([]);

  // Try Twilio Conversations first. If the backend reports `enabled: false`
  // (no API key, test creds, etc.) silently fall back to the blob-backed
  // messaging we already had working.
  useEffect(() => {
    if (!userId) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');

    (async () => {
      // Look up the user's project IDs so seeded conversations can reference
      // them via attributes.
      const projects = await loadUserData('projects', null);
      const list = Array.isArray(projects?.list) ? projects.list : [];
      const projectIds = {
        working: list.find((p) => p.status === 'working')?.id || null,
        complete: list.find((p) => p.status === 'complete')?.id || null,
        published: list.find((p) => p.status === 'published')?.id || null,
      };

      const result = await initTwilioClient({
        userId,
        projectIds,
        onThreadsChanged: (next) => {
          if (cancelled) return;
          setThreads(next);
        },
        onDemoTyping: (sid, isTyping) => {
          if (cancelled) return;
          setTypingSid(isTyping ? sid : null);
        },
      }).catch((err) => ({ enabled: false, reason: err.message }));

      if (cancelled) return;

      if (result.enabled) {
        twilioRef.current = result;
        setTransport('twilio');
        setThreads(result.threads);
        setStatus('ready');
        return;
      }

      // Blob fallback path.
      setTransport('blob');
      const stored = await loadUserData('messages', null);
      if (cancelled) return;
      if (Array.isArray(stored?.threads)) setThreads(stored.threads);
      setStatus('ready');
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persistThreads = (next) => {
    if (transport === 'twilio' || !userId) return; // Twilio is the source of truth
    saveUserData('messages', { threads: next })
      .catch((err) => console.warn('Messages save failed:', err.message));
  };

  /**
   * Mirror Twilio threads into the `messages` blob.
   *
   * Twilio stays the source of truth for the chat UI, but the Notifications
   * page and the dashboard activity feed read ONLY this blob — so with Twilio
   * on they'd otherwise show stale seed data or nothing at all. Write a
   * blob-shaped copy (exactly the shape seed.mjs writes) so those surfaces keep
   * working, without either of them needing to know Twilio exists.
   */
  const lastMirrorRef = useRef('');
  useEffect(() => {
    if (transport !== 'twilio' || !userId || status !== 'ready') return;
    if (!threads.length) return;

    // Strip `_conv` — it's a live SDK object and would blow up JSON.stringify.
    const mirror = threads.map((t) => ({
      id: t.id,
      sid: t.sid,
      connectionId: t.connectionId ?? null,
      projectId: t.projectId ?? null,
      name: t.name,
      initials: t.initials,
      type: t.type,
      role: t.role,
      lastMessage: t.lastMessage,
      timestamp: t.timestamp,
      unread: t.unread,
      updatedAt: t.updatedAt,
      messages: (t.messages || []).map((m) => ({
        id: m.id,
        sender: m.sender,
        isMe: m.isMe,
        text: m.text,
        time: m.time,
        date: m.date,
        timestamp: m.timestamp,
      })),
    }));

    const serialized = JSON.stringify({ threads: mirror });
    if (serialized === lastMirrorRef.current) return; // nothing changed
    lastMirrorRef.current = serialized;

    saveUserData('messages', { threads: mirror })
      .catch((err) => console.warn('Messages mirror failed:', err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, transport, userId, status]);

  // Mark the active thread as read once it's open.
  useEffect(() => {
    if (!selectedThread) return;
    const target = threads.find((t) => t.id === selectedThread);
    if (!target?.unread) return;
    if (transport === 'twilio') {
      twilioRef.current?.markRead?.(selectedThread);
      return;
    }
    const next = threads.map((t) => (t.id === selectedThread ? { ...t, unread: false } : t));
    setThreads(next);
    persistThreads(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread]);

  const sendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !selectedThread) return;
    setSendError('');

    if (transport === 'twilio') {
      const pending = messageInput;
      setMessageInput('');
      try {
        await twilioRef.current.sendMessage(selectedThread, text);
      } catch (err) {
        // Put the text back so the user doesn't lose what they typed, and
        // actually tell them — this used to be console.error only.
        setMessageInput(pending);
        setSendError(`Message not sent: ${err.message}. Check your connection and try again.`);
      }
      return;
    }

    // Blob mode. Store a real numeric timestamp: the literal 'Today' string
    // never ages, and notifications/activity sort it to epoch 0.
    const ts = Date.now();
    const time = new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const next = threads.map((t) => {
      if (t.id !== selectedThread) return t;
      const lastId = (t.messages || []).reduce((m, x) => Math.max(m, x.id || 0), 0);
      return {
        ...t,
        lastMessage: text,
        timestamp: fmtPreviewTimestamp(ts),
        unread: false,
        updatedAt: ts,
        messages: [
          ...(t.messages || []),
          {
            id: lastId + 1,
            sender: 'Me',
            isMe: true,
            text,
            time,
            date: fmtDate(ts),
            timestamp: ts,
          },
        ],
      };
    });
    setThreads(next);
    persistThreads(next);
    setMessageInput('');
  };

  // -------- Start new conversation --------
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('connections', null).then((stored) => {
      if (cancelled) return;
      if (Array.isArray(stored?.list)) setConnections(stored.list);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startConversationWith = async (connection) => {
    setNewConvoOpen(false);
    setNotice('');

    if (transport === 'twilio' && twilioRef.current?.startConversation) {
      try {
        const sid = await twilioRef.current.startConversation(connection);
        setSelectedThread(sid);
      } catch (err) {
        // Was a raw alert(). Inline notice instead.
        setNotice(err.message);
      }
      return;
    }

    // Blob fallback: append a new local thread if one doesn't already exist
    // for this connection. Match on name too — the seeded blob threads predate
    // connectionId, and without this the demo contacts get a second, empty
    // thread the first time you message them from the connections page.
    const existing = threads.find(
      (t) => t.connectionId === connection.id || t.name === connection.name
    );
    if (existing) {
      setSelectedThread(existing.id);
      return;
    }
    const nextId = threads.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;
    const newThread = {
      id: nextId,
      connectionId: connection.id,
      name: connection.name,
      initials: connection.initials,
      type: connection.type,
      role: connection.role,
      lastMessage: '',
      timestamp: '',
      unread: false,
      messages: [],
    };
    const next = [newThread, ...threads];
    setThreads(next);
    persistThreads(next);
    setSelectedThread(nextId);
  };

  /**
   * Deep links. Two shapes, both land on the right conversation:
   *
   *   ?connection=<id>  — from the connections page. Resolved through the
   *                       identity contract, creating the thread if needed.
   *   ?thread=<slug>    — legacy dashboard chat bubbles ("kim"/"heather"/...).
   *                       Ids are sids/numbers so the slug could never match a
   *                       thread id; map the slug to the demo contact instead.
   *
   * Runs once per param value, and only after threads have actually loaded —
   * otherwise we'd resolve against an empty list and create a duplicate.
   */
  const deepLinkRef = useRef('');
  useEffect(() => {
    if (status !== 'ready') return;

    const connectionParam = searchParams.get('connection');
    const threadParam = searchParams.get('thread');
    if (!connectionParam && !threadParam) return;

    const key = `${connectionParam || ''}|${threadParam || ''}`;
    if (deepLinkRef.current === key) return;

    // ?connection= needs the connections list to resolve an identity; wait for
    // it rather than giving up (it loads in a parallel effect).
    if (connectionParam && connections.length === 0) return;
    deepLinkRef.current = key;

    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('connection');
      next.delete('thread');
      setSearchParams(next, { replace: true });
    };

    (async () => {
      if (connectionParam) {
        const connection = connections.find(
          (c) => String(c.id) === String(connectionParam)
        );
        if (!connection) {
          setNotice("That connection isn't in your list.");
          clearParam();
          return;
        }
        // startConversationWith already handles both transports, the identity
        // contract, and the "invitation pending" case.
        await startConversationWith(connection);
        clearParam();
        return;
      }

      // Legacy ?thread=<slug>.
      const contact = demoContactForSlug(threadParam);
      if (!contact) {
        // 'john'/'jane' on the dashboard are placeholder people who exist in no
        // dataset. Say so rather than silently dead-ending on a blank panel.
        setNotice(
          "That contact isn't set up for messaging yet. Pick a conversation below."
        );
        clearParam();
        return;
      }

      const match = threads.find(
        (t) =>
          t.counterpartyIdentity === contact.identity ||
          t.name === contact.name // blob mode threads carry no identity
      );
      if (match) {
        setSelectedThread(match.id);
      } else {
        const connection = connections.find((c) => c.name === contact.name);
        if (connection) await startConversationWith(connection);
        else setNotice(`No conversation with ${contact.name} yet.`);
      }
      clearParam();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, searchParams, threads, connections]);

  const filteredThreads = useMemo(
    () =>
      threads.filter((t) =>
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [threads, searchQuery]
  );

  const activeThread = threads.find(t => t.id === selectedThread);

  // Keep the newest message (and the typing bubble) in view.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages?.length, typingSid]);

  return (
    <div style={styles.wrapper}>
    {/* Keyframes for the init spinner — inline styles can't express these. */}
    <style>{'@keyframes ps-spin { to { transform: rotate(360deg); } }'}</style>
    <div style={styles.container}>
      <Link to="/settings" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div style={{ ...styles.pageHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={styles.pageTitle}>Messages</h1>
          <p style={styles.pageDesc}>
            Communicate with your clients, trade pros, and ProSource team members.
          </p>
        </div>
        <button
          onClick={() => setNewConvoOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 16px',
            background: colors.darkBlue, color: '#fff',
            border: 'none', borderRadius: 6,
            fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >+ New Message</button>
      </div>

      {notice && (
        <div style={styles.banner('notice')}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{notice}</span>
          <button onClick={() => setNotice('')} style={styles.bannerClose} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading: transport is still being probed. Showing mock threads here is
          what used to make them flash and then hard-swap. */}
      {status === 'loading' ? (
        <div style={{ ...styles.chatContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: colors.gray500 }}>
            <Loader2 size={28} style={{ animation: 'ps-spin 1s linear infinite' }} />
            <div style={{ fontSize: 14 }}>Loading your conversations…</div>
          </div>
        </div>
      ) : threads.length === 0 ? (
        /* True empty state — this account genuinely has no conversations. */
        <div style={{ ...styles.chatContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: colors.gray500, textAlign: 'center', padding: 24 }}>
            <MessageCircle size={48} style={{ color: colors.gray300 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.gray900 }}>No conversations yet</div>
            <div style={{ fontSize: 14, maxWidth: 340, lineHeight: 1.6 }}>
              Start a conversation with your account manager, a client, or a trade pro to see it here.
            </div>
            <button
              onClick={() => setNewConvoOpen(true)}
              style={{
                marginTop: 4, padding: '10px 16px', background: colors.darkBlue,
                color: '#fff', border: 'none', borderRadius: 6, fontSize: 14,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >+ New Message</button>
          </div>
        </div>
      ) : (
      <div style={styles.chatContainer} className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
        {/* Thread List */}
        <div style={styles.threadList} className={`${selectedThread ? 'hidden md:flex' : 'flex'}`}>
          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Search conversations..."
              style={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={styles.threadScroll}>
            {filteredThreads.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: colors.gray500, fontSize: 13 }}>
                No conversations match “{searchQuery}”.
              </div>
            )}
            {filteredThreads.map(thread => (
              <div
                key={thread.id}
                style={styles.threadItem(selectedThread === thread.id, thread.unread)}
                onClick={() => setSelectedThread(thread.id)}
              >
                <div style={styles.avatar(thread.type)}>{thread.initials}</div>
                <div style={styles.threadInfo}>
                  <div style={styles.threadHeader}>
                    <span style={styles.threadName} className="truncate">{thread.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={styles.threadTime}>{thread.timestamp}</span>
                      {thread.unread && <div style={styles.unreadDot} />}
                    </div>
                  </div>
                  <div style={styles.threadRole}>{thread.role}</div>
                  <div style={styles.threadPreview}>{thread.lastMessage}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation Panel */}
        <div style={styles.conversationPanel} className={`${selectedThread ? 'flex' : 'hidden md:flex'} min-w-0`}>
          {activeThread ? (
            <>
              <div style={styles.convHeader}>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="md:hidden flex items-center gap-1 bg-transparent border-0 cursor-pointer p-1 -ml-1"
                  style={{ color: colors.darkBlue, fontSize: 14, fontWeight: 500 }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div style={styles.avatar(activeThread.type)}>{activeThread.initials}</div>
                <div className="min-w-0">
                  <div style={styles.convHeaderName} className="truncate">{activeThread.name}</div>
                  <div style={styles.convHeaderRole} className="truncate">{activeThread.role}</div>
                </div>
              </div>

              <div style={styles.messagesArea}>
                {(activeThread.messages || []).length === 0 && (
                  <div style={{ margin: 'auto', textAlign: 'center', color: colors.gray400, fontSize: 13 }}>
                    No messages yet — say hello.
                  </div>
                )}
                {(activeThread.messages || []).map((msg, i) => {
                  const showDate = i === 0 || activeThread.messages[i - 1].date !== msg.date;
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && <div style={styles.dateDivider}>{msg.date}</div>}
                      <div style={styles.messageRow(msg.isMe)}>
                        <div style={styles.messageBubble(msg.isMe)}>{msg.text}</div>
                        <div style={styles.messageTime(msg.isMe)}>{msg.time}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {/* The demo contact is composing. The reply itself arrives over
                    the websocket like any other message. */}
                {typingSid === activeThread.sid && (
                  <div style={styles.messageRow(false)}>
                    <div style={{ ...styles.messageBubble(false), color: colors.gray500, fontStyle: 'italic' }}>
                      {activeThread.name.split(' ')[0]} is typing…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {sendError && (
                <div style={styles.banner('error')}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{sendError}</span>
                  <button onClick={() => setSendError('')} style={styles.bannerClose} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div style={styles.inputBar} className="min-w-0">
                <input
                  type="text"
                  placeholder="Type a message..."
                  style={styles.messageInput}
                  className="min-w-0"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                />
                <button
                  style={styles.sendBtn}
                  className="flex-shrink-0"
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                >
                  <Send size={16} /> <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              <MessageCircle size={48} />
              <div style={{ fontSize: 16, fontWeight: 500 }}>Select a conversation</div>
              <div style={{ fontSize: 14 }}>Choose a thread from the left to view messages</div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>

    {/* New Conversation picker */}
    {newConvoOpen && (
      <div
        onClick={() => setNewConvoOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, zIndex: 1000,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 12,
            width: '100%', maxWidth: 460,
            display: 'flex', flexDirection: 'column',
            maxHeight: '80vh',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.gray200}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: colors.gray900, margin: 0 }}>Start a conversation</h2>
            <button onClick={() => setNewConvoOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500 }}>
              <ArrowLeft size={18} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>
          <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
            {connections.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: colors.gray500, fontSize: 14 }}>
                You don't have any connections yet. Add some from{' '}
                <Link to="/connections" style={{ color: colors.darkBlue }}>your connections list</Link>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {connections.map((c) => {
                  // Identity contract: no demoIdentity and no userId means this
                  // person was invited but never joined — there is nobody to
                  // deliver to, so don't offer a thread that can't exist.
                  const messageable = !!identityForConnection(c);
                  return (
                    <button
                      key={c.id}
                      onClick={() => messageable && startConversationWith(c)}
                      disabled={!messageable}
                      title={messageable ? undefined : `${c.name} hasn't accepted their invitation yet`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 10, border: `1px solid ${colors.gray200}`,
                        borderRadius: 8, background: '#fff',
                        cursor: messageable ? 'pointer' : 'not-allowed',
                        opacity: messageable ? 1 : 0.55,
                        textAlign: 'left', fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { if (!messageable) return; e.currentTarget.style.background = '#f8faff'; e.currentTarget.style.borderColor = colors.darkBlue; }}
                      onMouseLeave={(e) => { if (!messageable) return; e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = colors.gray200; }}
                    >
                      <div style={styles.avatar(c.type)}>{c.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: colors.gray900, fontSize: 14, marginBottom: 2 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: colors.gray500 }}>{c.role}</div>
                      </div>
                      {!messageable && (
                        <span style={{ fontSize: 11, color: colors.gray500, background: colors.gray100, padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>
                          Invitation pending
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default ProSourceMessages;
