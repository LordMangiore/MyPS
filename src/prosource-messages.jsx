import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  MessageCircle,
  Send,
  Paperclip,
} from 'lucide-react';
import { useAuth } from './auth-context';
import { initTwilioClient } from './twilio-client';

const ProSourceMessages = () => {
  const { loadUserData, saveUserData, userId } = useAuth();
  const [selectedThread, setSelectedThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  // 'twilio' once Twilio Conversations is up; 'blob' is the fallback that
  // persists threads to ps-user-data. Probed on mount.
  const [transport, setTransport] = useState('blob');
  const twilioRef = useRef(null);

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
    attachBtn: {
      background: 'none',
      border: 'none',
      color: colors.gray400,
      cursor: 'pointer',
      padding: 4,
      display: 'flex',
      alignItems: 'center',
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

  const DEFAULT_THREADS = [
    {
      id: 1,
      name: 'Kim Marks',
      initials: 'KM',
      type: 'prosource',
      role: 'Account Manager',
      lastMessage: 'Hi Suzie! The tile samples for the Wilson project are ready for pickup at the showroom.',
      timestamp: '10:32 AM',
      unread: true,
      messages: [
        { id: 1, sender: 'Kim Marks', isMe: false, text: 'Hi Suzie! Just wanted to let you know the Shaw LVP samples came in.', time: '9:15 AM', date: 'Today' },
        { id: 2, sender: 'Me', isMe: true, text: 'Great! Can you hold a few for the Beans kitchen project?', time: '9:45 AM', date: 'Today' },
        { id: 3, sender: 'Kim Marks', isMe: false, text: 'Absolutely! I also have the tile samples for the Wilson project ready for pickup at the showroom.', time: '10:32 AM', date: 'Today' },
      ],
    },
    {
      id: 2,
      name: 'Bubba Beans',
      initials: 'BB',
      type: 'client',
      role: 'Homeowner',
      lastMessage: 'Sounds good, I will be at the showroom Saturday morning.',
      timestamp: 'Yesterday',
      unread: false,
      messages: [
        { id: 1, sender: 'Me', isMe: true, text: 'Hi Bubba, wanted to share some flooring options for your kitchen remodel.', time: '2:00 PM', date: 'Jan 28' },
        { id: 2, sender: 'Bubba Beans', isMe: false, text: 'Thanks Suzie! Those look great. When can I see them in person?', time: '3:15 PM', date: 'Jan 28' },
        { id: 3, sender: 'Me', isMe: true, text: 'The samples are at the ProSource showroom now. Want to stop by this weekend?', time: '3:30 PM', date: 'Jan 28' },
        { id: 4, sender: 'Bubba Beans', isMe: false, text: 'Sounds good, I will be at the showroom Saturday morning.', time: '4:00 PM', date: 'Jan 28' },
      ],
    },
    {
      id: 3,
      name: "Ryan O'Toole",
      initials: 'RO',
      type: 'tradepro',
      role: 'Flooring Installer',
      lastMessage: 'I can start the install on the 15th. Does that work for the client?',
      timestamp: 'Jan 27',
      unread: true,
      messages: [
        { id: 1, sender: 'Me', isMe: true, text: 'Hey Ryan, got a new flooring install for the Beans kitchen. Are you available mid-February?', time: '11:00 AM', date: 'Jan 27' },
        { id: 2, sender: "Ryan O'Toole", isMe: false, text: 'I can start the install on the 15th. Does that work for the client?', time: '1:30 PM', date: 'Jan 27' },
      ],
    },
    {
      id: 4,
      name: 'Sarah Chen',
      initials: 'SC',
      type: 'client',
      role: 'Homeowner',
      lastMessage: 'Thank you for the estimate! We will review and get back to you.',
      timestamp: 'Jan 25',
      unread: false,
      messages: [
        { id: 1, sender: 'Me', isMe: true, text: 'Hi Sarah, I put together the estimate for your master bathroom. Take a look when you get a chance.', time: '10:00 AM', date: 'Jan 25' },
        { id: 2, sender: 'Sarah Chen', isMe: false, text: 'Thank you for the estimate! We will review and get back to you.', time: '11:45 AM', date: 'Jan 25' },
      ],
    },
    {
      id: 5,
      name: 'Heather Yager',
      initials: 'HY',
      type: 'prosource',
      role: 'Designer',
      lastMessage: 'I uploaded the room visualization for the Chen bathroom. Let me know what you think!',
      timestamp: 'Jan 22',
      unread: false,
      messages: [
        { id: 1, sender: 'Heather Yager', isMe: false, text: 'I uploaded the room visualization for the Chen bathroom. Let me know what you think!', time: '3:00 PM', date: 'Jan 22' },
      ],
    },
  ];

  const [threads, setThreads] = useState(DEFAULT_THREADS);

  // Try Twilio Conversations first. If the backend reports `enabled: false`
  // (no API key, test creds, etc.) silently fall back to the blob-backed
  // messaging we already had working.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

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
      }).catch((err) => ({ enabled: false, reason: err.message }));

      if (cancelled) return;

      if (result.enabled) {
        twilioRef.current = result;
        setTransport('twilio');
        setThreads(result.threads);
        return;
      }

      // Blob fallback path.
      setTransport('blob');
      const stored = await loadUserData('messages', null);
      if (cancelled) return;
      if (stored?.threads) setThreads(stored.threads);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persistThreads = (next) => {
    if (transport === 'twilio' || !userId) return; // Twilio is the source of truth
    saveUserData('messages', { threads: next })
      .catch((err) => console.warn('Messages save failed:', err.message));
  };

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

    if (transport === 'twilio') {
      try {
        await twilioRef.current.sendMessage(selectedThread, text);
        setMessageInput('');
      } catch (err) {
        console.error('Twilio send failed:', err);
      }
      return;
    }

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const date = 'Today';
    const next = threads.map((t) => {
      if (t.id !== selectedThread) return t;
      const lastId = t.messages.reduce((m, x) => Math.max(m, x.id || 0), 0);
      return {
        ...t,
        lastMessage: text,
        timestamp: time,
        unread: false,
        messages: [
          ...t.messages,
          { id: lastId + 1, sender: 'Me', isMe: true, text, time, date },
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

    if (transport === 'twilio' && twilioRef.current?.startConversation) {
      try {
        const sid = await twilioRef.current.startConversation(connection);
        setSelectedThread(sid);
      } catch (err) {
        alert(`Could not start conversation: ${err.message}`);
      }
      return;
    }

    // Blob fallback: append a new local thread if one doesn't already exist
    // for this connection.
    const existing = threads.find((t) => t.connectionId === connection.id);
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

  const filteredThreads = threads.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeThread = threads.find(t => t.id === selectedThread);

  return (
    <div style={styles.wrapper}>
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
                {activeThread.messages.map((msg, i) => {
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
              </div>

              <div style={styles.inputBar} className="min-w-0">
                <button style={styles.attachBtn}>
                  <Paperclip size={18} />
                </button>
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
                {connections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => startConversationWith(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 10, border: `1px solid ${colors.gray200}`,
                      borderRadius: 8, background: '#fff', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8faff'; e.currentTarget.style.borderColor = colors.darkBlue; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = colors.gray200; }}
                  >
                    <div style={styles.avatar(c.type)}>{c.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: colors.gray900, fontSize: 14, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: colors.gray500 }}>{c.role}</div>
                    </div>
                  </button>
                ))}
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
