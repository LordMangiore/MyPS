import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Package,
  Lightbulb,
  UserPlus,
  DollarSign,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from './auth-context';

const ProSourceNotifications = () => {
  const { userId, loadUserData, saveUserData, homePath } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [projectList, setProjectList] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [readIds, setReadIds] = useState(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      loadUserData('projects', null),
      loadUserData('messages', null),
      loadUserData('notifications', null),
    ]).then(([p, m, n]) => {
      if (cancelled) return;
      const list = Array.isArray(p?.list)
        ? p.list
        : (p?.project ? [{ ...p.project, status: p.status || 'working', id: 'legacy' }] : []);
      setProjectList(list);
      setMessageThreads(Array.isArray(m?.threads) ? m.threads : []);
      if (Array.isArray(n?.readIds)) setReadIds(new Set(n.readIds));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persistReadIds = (next) => {
    if (!userId) return;
    saveUserData('notifications', { readIds: Array.from(next) })
      .catch((err) => console.warn('Notifications save failed:', err.message));
  };

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
    orange: '#ea580c',
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
    unreadSummary: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.red,
      marginTop: 8,
    },
    filterBar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    tabs: {
      display: 'flex',
      gap: 4,
      background: colors.gray100,
      borderRadius: 8,
      padding: 4,
      overflowX: 'auto',
      maxWidth: '100%',
    },
    tab: (isActive) => ({
      padding: '8px 16px',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      border: 'none',
      cursor: 'pointer',
      background: isActive ? '#fff' : 'transparent',
      color: isActive ? colors.darkBlue : colors.gray500,
      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    }),
    markReadBtn: {
      padding: '8px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    notificationList: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      overflow: 'hidden',
    },
    notificationCard: (isUnread) => ({
      display: 'flex',
      gap: 16,
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray100}`,
      background: isUnread ? '#fafbff' : '#fff',
      borderLeft: isUnread ? `3px solid ${colors.darkBlue}` : '3px solid transparent',
      textDecoration: 'none',
      color: 'inherit',
      transition: 'background 0.1s ease',
    }),
    iconCircle: (bg) => ({
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),
    notifContent: {
      flex: 1,
      minWidth: 0,
    },
    notifTitle: (isUnread) => ({
      fontSize: 14,
      fontWeight: isUnread ? 600 : 500,
      color: colors.gray900,
      marginBottom: 4,
    }),
    notifDesc: {
      fontSize: 13,
      color: colors.gray500,
      lineHeight: 1.4,
    },
    notifMeta: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
      flexShrink: 0,
    },
    notifTime: {
      fontSize: 12,
      color: colors.gray400,
      whiteSpace: 'nowrap',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: colors.red,
    },
    emptyState: {
      padding: 64,
      textAlign: 'center',
      color: colors.gray400,
    },
  };

  const fmtTs = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today - that) / 86400000);
    if (diff === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Synthesize notifications from projects + messages, then merge in any
  // read flags we've persisted.
  const computedNotifications = useMemo(() => {
    const items = [];

    messageThreads.forEach((t) => {
      const last = t.messages?.[t.messages.length - 1];
      if (!last || last.isMe) return;
      const id = `msg:${t.id}:${last.id || last.timestamp}`;
      items.push({
        id,
        type: 'message',
        Icon: MessageCircle,
        iconColor: colors.darkBlue,
        iconBg: '#dbeafe',
        title: `New message from ${t.name}`,
        description: last.text,
        ts: last.timestamp || 0,
        link: '/messages',
      });
    });

    projectList.forEach((p) => {
      if (p.archived) return;
      const baseId = `proj:${p.id}`;
      if (p.status === 'complete') {
        items.push({
          id: `${baseId}:complete`,
          type: 'project',
          Icon: CheckCircle,
          iconColor: colors.green,
          iconBg: '#dcfce7',
          title: `Project marked complete: ${p.name}`,
          description: 'Punch list closed. Final invoices and warranty docs are ready to share.',
          ts: p.updatedAt || 0,
          link: `/projects/${p.id}`,
        });
      } else if (p.status === 'published') {
        items.push({
          id: `${baseId}:published`,
          type: 'project',
          Icon: Lightbulb,
          iconColor: colors.green,
          iconBg: '#dcfce7',
          title: `Published to portfolio: ${p.name}`,
          description: 'This project is now visible on your public profile.',
          ts: p.updatedAt || 0,
          link: `/projects/${p.id}`,
        });
      } else {
        items.push({
          id: `${baseId}:created`,
          type: 'project',
          Icon: Lightbulb,
          iconColor: colors.darkBlue,
          iconBg: '#dbeafe',
          title: `Project created: ${p.name}`,
          description: 'Set products, photos, and a target completion date when you have a moment.',
          ts: p.createdAt || p.updatedAt || 0,
          link: `/projects/${p.id}`,
        });
      }
    });

    return items
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((item) => ({
        ...item,
        timestamp: fmtTs(item.ts),
        date: fmtTs(item.ts),
        read: readIds.has(item.id),
      }));
  }, [projectList, messageThreads, readIds]);

  const markAsRead = (id) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    persistReadIds(next);
  };

  const markAllRead = () => {
    const next = new Set(readIds);
    computedNotifications.forEach((n) => next.add(n.id));
    setReadIds(next);
    persistReadIds(next);
  };

  const LEGACY_NOTIFICATIONS = [
    {
      id: 1,
      type: 'message',
      Icon: MessageCircle,
      iconColor: colors.darkBlue,
      iconBg: '#dbeafe',
      title: 'New message from Kim Marks',
      description: 'Hi Suzie! The tile samples for the Wilson project are ready for pickup at the showroom.',
      timestamp: '10:32 AM',
      date: 'Today',
      read: false,
      link: '/messages',
    },
    {
      id: 2,
      type: 'project',
      Icon: Lightbulb,
      iconColor: colors.green,
      iconBg: '#dcfce7',
      title: 'Project update: Beans Kitchen Remodel',
      description: 'Kim Marks added a comment to the project.',
      timestamp: '9:15 AM',
      date: 'Today',
      read: false,
      link: '/project',
    },
    {
      id: 3,
      type: 'order',
      Icon: Package,
      iconColor: colors.orange,
      iconBg: '#fff7ed',
      title: 'Order EC099016 shipped',
      description: 'Shaw Endura Plus LVP for the Beans Kitchen Remodel has shipped. Expected delivery Feb 10.',
      timestamp: 'Yesterday',
      date: 'Yesterday',
      read: false,
      link: '/orders/EC099016',
    },
    {
      id: 4,
      type: 'connection',
      Icon: UserPlus,
      iconColor: colors.darkBlue,
      iconBg: '#dbeafe',
      title: 'Connection request from James Anderson',
      description: 'James Anderson (General Contractor) wants to connect with you.',
      timestamp: 'Yesterday',
      date: 'Yesterday',
      read: true,
      link: '/connections',
    },
    {
      id: 5,
      type: 'referral',
      Icon: DollarSign,
      iconColor: colors.green,
      iconBg: '#dcfce7',
      title: 'Referral bonus earned!',
      description: "You earned a $87.84 referral bonus from Bubba Beans' flooring purchase.",
      timestamp: 'Jan 28',
      date: 'Jan 28',
      read: true,
      link: '/settings?section=referrals',
    },
    {
      id: 6,
      type: 'order',
      Icon: CheckCircle,
      iconColor: colors.green,
      iconBg: '#dcfce7',
      title: 'Estimate approved: Wilson Bathroom',
      description: 'Martha Wilson approved the estimate for the bathroom renovation project.',
      timestamp: 'Jan 27',
      date: 'Jan 27',
      read: true,
      link: '/orders/EC094964',
    },
    {
      id: 7,
      type: 'message',
      Icon: MessageCircle,
      iconColor: colors.darkBlue,
      iconBg: '#dbeafe',
      title: "New message from Ryan O'Toole",
      description: 'I can start the install on the 15th. Does that work for the client?',
      timestamp: 'Jan 27',
      date: 'Jan 27',
      read: true,
      link: '/messages',
    },
    {
      id: 8,
      type: 'project',
      Icon: Lightbulb,
      iconColor: colors.green,
      iconBg: '#dcfce7',
      title: 'New project invitation',
      description: 'You have been invited to collaborate on the "Chen Master Bath" project.',
      timestamp: 'Jan 25',
      date: 'Jan 25',
      read: true,
      link: '/project',
    },
  ];

  // computedNotifications is the live data source; LEGACY_NOTIFICATIONS is
  // kept above only as a structural reference and isn't rendered.
  const notifications = computedNotifications.length > 0
    ? computedNotifications
    : []; // empty state handled below

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'message', label: 'Messages' },
    { id: 'project', label: 'Projects' },
  ];

  const filtered = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.type === activeFilter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      <Link to={homePath} style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Notifications</h1>
        <p style={styles.pageDesc}>
          Stay up to date with messages, orders, projects, and more.
        </p>
      </div>

      <div style={styles.filterBar}>
        <div className="scrollbar-hide" style={styles.tabs}>
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              style={styles.tab(activeFilter === tab.id)}
              onClick={() => setActiveFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button style={styles.markReadBtn} onClick={markAllRead}>
          <CheckCircle size={14} /> Mark All as Read
        </button>
      </div>

      <div style={styles.notificationList}>
        {filtered.length > 0 ? (
          filtered.map(notif => (
            <Link
              key={notif.id}
              to={notif.link}
              onClick={() => markAsRead(notif.id)}
              style={styles.notificationCard(!notif.read)}
            >
              <div style={styles.iconCircle(notif.iconBg)}>
                <notif.Icon size={20} color={notif.iconColor} />
              </div>
              <div style={styles.notifContent}>
                <div style={styles.notifTitle(!notif.read)}>{notif.title}</div>
                <div style={styles.notifDesc}>{notif.description}</div>
              </div>
              <div style={styles.notifMeta}>
                <span style={styles.notifTime}>{notif.timestamp}</span>
                {!notif.read && <div style={styles.unreadDot} />}
              </div>
            </Link>
          ))
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>No notifications</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>You're all caught up!</div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default ProSourceNotifications;
