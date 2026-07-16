import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth-context';
import {
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  UserPlus,
  Users,
  Briefcase,
  Home,
  Trash2,
  MessageCircle,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';

/**
 * Identity contract (shared across WP9/WP7 — do not diverge):
 *   connection.demoIdentity → a seeded demo contact  → messageable
 *   connection.userId       → a real signed-in user  → messageable
 *   neither                 → invited, not yet joined → NOT messageable
 *
 * Messaging is deliberately decoupled: a messageable connection links to
 * /messages?connection=<id> and the messaging surface resolves the conversation
 * (creating it if needed). This file never talks to Twilio.
 */
const isMessageable = (c) => Boolean(c?.demoIdentity || c?.userId);

const ProSourceConnections = () => {
  const { userId, userEmail, userName, loadUserData, saveUserData } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  // 'search' → enter email · 'found' → resolved a ProSource user · 'invite'
  // → not yet a user, offer to send email invitation · 'success' → final ack.
  const [addModalStep, setAddModalStep] = useState('search');
  const [addModalEmail, setAddModalEmail] = useState('');
  const [addModalBusy, setAddModalBusy] = useState(false);
  const [resolvedUser, setResolvedUser] = useState(null);
  const [addError, setAddError] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  // What the invite endpoint actually did — drives an honest success screen.
  const [inviteResult, setInviteResult] = useState(null);

  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [actionError, setActionError] = useState('');
  const [requestBusyId, setRequestBusyId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  // Connections and incoming requests live in the same `connections` blob and
  // load in one round trip. The endpoint seeds the demo's incoming requests on
  // first read, so there is no hardcoded component-side fallback data.
  useEffect(() => {
    if (!userId) { setDataLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/connection-requests?userId=${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load connections');
        setConnections(Array.isArray(data.list) ? data.list : []);
        setPendingRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (err) {
        if (!cancelled) setActionError(err.message || 'Failed to load connections');
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  /** Read the whole connections blob so writes never drop sibling keys. */
  const readConnectionsBlob = async () => {
    const stored = await loadUserData('connections', null);
    return stored && typeof stored === 'object' ? stored : {};
  };

  /** Write a new list, preserving `requests`/`requestsSeeded` in the same blob. */
  const writeConnectionsList = async (base, next) => {
    await saveUserData('connections', { ...base, list: next });
    setConnections(next);
  };

  const initialsFor = (name) =>
    (name || '').split(/\s+/).filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join('') || '?';

  const resetAddModal = () => {
    setShowAddModal(false);
    setAddModalStep('search');
    setAddModalEmail('');
    setResolvedUser(null);
    setAddError('');
    setInviteMessage('');
    setInviteResult(null);
  };

  const lookupEmail = async () => {
    const email = addModalEmail.trim();
    if (!email || !email.includes('@')) {
      setAddError('Enter a valid email address.');
      return;
    }
    setAddError('');
    setAddModalBusy(true);
    try {
      const res = await fetch(`/api/lookup-user?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.found) {
        setResolvedUser(data.user);
        setAddModalStep('found');
      } else {
        setResolvedUser(null);
        setAddModalStep('invite');
      }
    } catch (err) {
      setAddError(err.message || 'Lookup failed');
    } finally {
      setAddModalBusy(false);
    }
  };

  const persistNewConnection = async (record) => {
    const base = await readConnectionsBlob();
    const list = Array.isArray(base.list) ? base.list : [];
    // De-dupe by email to keep the list clean if the user repeats the flow.
    const filtered = record.email
      ? list.filter((c) => (c.email || '').toLowerCase() !== record.email.toLowerCase())
      : list;
    const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newRecord = { id, addedAt: Date.now(), ...record };
    const next = [...filtered, newRecord];
    await writeConnectionsList(base, next);
    return newRecord;
  };

  const confirmFoundUser = async () => {
    if (!resolvedUser) return;
    setAddModalBusy(true);
    try {
      const note = inviteMessage.trim();
      await persistNewConnection({
        name: resolvedUser.name,
        initials: initialsFor(resolvedUser.name),
        role: resolvedUser.role,
        type: resolvedUser.type,
        email: resolvedUser.email,
        phone: resolvedUser.phone,
        location: resolvedUser.address,
        businessName: resolvedUser.businessName,
        // Real ProSource user → messageable per the identity contract.
        userId: resolvedUser.userId,
        status: 'connected',
        // Real type/role drives the card label; a brand-new connection genuinely
        // has zero shared projects, which is not the same as "ProSource staff".
        projects: 0,
        // The personal note is persisted WITH the connection rather than pushed
        // through Twilio from here (messaging owns that transport). Messaging
        // picks it up when it resolves /messages?connection=<id>.
        ...(note ? { introMessage: note, introMessageFrom: 'me', introMessageAt: Date.now() } : {}),
      });

      setAddModalStep('success');
    } catch (err) {
      setAddError(err.message || 'Could not add connection');
    } finally {
      setAddModalBusy(false);
    }
  };

  const sendInvite = async () => {
    setAddModalBusy(true);
    setAddError('');
    try {
      const email = addModalEmail.trim();
      const note = inviteMessage.trim();

      // Ask the server to record + (try to) send, then report what it actually did.
      let result;
      try {
        const res = await fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: email,
            fromName: userName || 'A trade pro',
            fromUserId: userId || null,
            message: note,
          }),
        });
        const data = await res.json().catch(() => ({}));
        result = res.ok
          ? data
          : { emailSent: false, reason: 'send-failed', error: data.error || `HTTP ${res.status}` };
      } catch (err) {
        result = { emailSent: false, reason: 'request-failed', error: err.message };
      }

      // Record the invite locally too, so the pending card survives a reload.
      const placeholderName = email.split('@')[0];
      await persistNewConnection({
        name: placeholderName,
        initials: initialsFor(placeholderName),
        role: 'Invitation pending',
        type: 'tradepro',
        email,
        phone: '',
        location: '',
        status: 'invited',
        projects: null,
        inviteToken: result.token || null,
        inviteEmailSent: Boolean(result.emailSent),
        invitedAt: Date.now(),
        ...(note ? { introMessage: note, introMessageFrom: 'me', introMessageAt: Date.now() } : {}),
      });

      setInviteResult(result);
      setAddModalStep('success');
    } catch (err) {
      setAddError(err.message || 'Could not record invitation');
    } finally {
      setAddModalBusy(false);
    }
  };

  const [resendingId, setResendingId] = useState(null);
  const [resendResults, setResendResults] = useState({});
  const resendInvite = async (connection) => {
    if (!connection?.email) return;
    setResendingId(connection.id);
    setActionError('');
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: connection.email,
          fromName: userName || 'A trade pro',
          fromUserId: userId || null,
          message: connection.introMessage || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      const emailSent = Boolean(res.ok && data.emailSent);
      setResendResults((prev) => ({ ...prev, [connection.id]: { emailSent, reason: data.reason } }));

      // Persist the real outcome so the card still tells the truth after reload.
      const base = await readConnectionsBlob();
      const list = Array.isArray(base.list) ? base.list : connections;
      const next = list.map((c) =>
        String(c.id) === String(connection.id)
          ? { ...c, inviteEmailSent: emailSent, inviteToken: data.token || c.inviteToken || null, invitedAt: Date.now() }
          : c
      );
      await writeConnectionsList(base, next);
    } catch (err) {
      setResendResults((prev) => ({ ...prev, [connection.id]: { emailSent: false, error: err.message } }));
    } finally {
      setResendingId(null);
    }
  };

  /** Accept or decline an incoming request. The server owns the transition:
   *  accepting removes the request AND appends a real connection. */
  const respondToRequest = async (request, action) => {
    setRequestBusyId(request.id);
    setActionError('');
    try {
      const res = await fetch('/api/connection-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, requestId: request.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not ${action} this request`);
      setPendingRequests(Array.isArray(data.requests) ? data.requests : []);
      setConnections(Array.isArray(data.list) ? data.list : []);
    } catch (err) {
      setActionError(err.message || `Could not ${action} this request`);
    } finally {
      setRequestBusyId(null);
    }
  };

  const removeConnection = async (connection) => {
    setRemovingId(connection.id);
    setOpenDropdownId(null);
    setActionError('');
    try {
      const base = await readConnectionsBlob();
      const list = Array.isArray(base.list) ? base.list : connections;
      const next = list.filter((c) => String(c.id) !== String(connection.id));
      await writeConnectionsList(base, next);
    } catch (err) {
      setActionError(err.message || 'Could not remove connection');
    } finally {
      setRemovingId(null);
    }
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
      cursor: 'pointer',
    },
    pageHeader: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 32,
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
      maxWidth: 600,
    },
    btnPrimary: {
      padding: '12px 20px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    },
    btnOutline: {
      padding: '10px 16px',
      background: '#fff',
      color: colors.darkBlue,
      border: `1px solid ${colors.darkBlue}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    },
    searchFilterRow: {
      display: 'flex',
      gap: 12,
      marginBottom: 24,
    },
    searchInput: {
      flex: 1,
      padding: '10px 14px 10px 40px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
    },
    searchWrapper: {
      position: 'relative',
      flex: 1,
    },
    searchIcon: {
      position: 'absolute',
      left: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      color: colors.gray400,
    },
    tabs: {
      display: 'flex',
      gap: 4,
      marginBottom: 24,
      borderBottom: `1px solid ${colors.gray200}`,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
    },
    tab: (isActive) => ({
      padding: '12px 20px',
      background: 'none',
      border: 'none',
      borderBottom: isActive ? `2px solid ${colors.darkBlue}` : '2px solid transparent',
      color: isActive ? colors.darkBlue : colors.gray500,
      fontSize: 14,
      fontWeight: isActive ? 600 : 400,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: -1,
    }),
    tabCount: {
      background: colors.gray200,
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
    },
    connectionsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 16,
    },
    connectionCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      padding: 20,
      transition: 'box-shadow 0.2s ease',
    },
    cardHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 16,
    },
    avatar: (type) => {
      let gradient;
      switch (type) {
        case 'client':
          gradient = `linear-gradient(135deg, #86efac 0%, ${colors.green} 100%)`;
          break;
        case 'tradepro':
          gradient = `linear-gradient(135deg, #fca5a5 0%, ${colors.red} 100%)`;
          break;
        case 'prosource':
          gradient = `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.darkBlue} 100%)`;
          break;
        default:
          gradient = colors.gray300;
      }
      return {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 18,
        fontWeight: 600,
        flexShrink: 0,
      };
    },
    cardInfo: {
      flex: 1,
    },
    connectionName: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    connectionRole: {
      fontSize: 13,
      color: colors.gray500,
      marginBottom: 8,
    },
    roleBadge: (type) => {
      let bgColor, textColor;
      switch (type) {
        case 'client':
          bgColor = '#dcfce7';
          textColor = colors.green;
          break;
        case 'tradepro':
          bgColor = '#fee2e2';
          textColor = colors.red;
          break;
        case 'prosource':
          bgColor = '#dbeafe';
          textColor = colors.darkBlue;
          break;
        default:
          bgColor = colors.gray100;
          textColor = colors.gray700;
      }
      return {
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        background: bgColor,
        color: textColor,
      };
    },
    pendingBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      background: '#fef3c7',
      color: '#92400e',
    },
    moreBtn: {
      background: 'none',
      border: 'none',
      padding: 4,
      cursor: 'pointer',
      color: colors.gray400,
    },
    contactInfo: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginBottom: 16,
      paddingBottom: 16,
      borderBottom: `1px solid ${colors.gray100}`,
    },
    contactItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      color: colors.gray700,
    },
    contactIcon: {
      color: colors.gray400,
      flexShrink: 0,
    },
    projectsInfo: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    projectCount: {
      fontSize: 13,
      color: colors.gray500,
    },
    projectCountNum: {
      fontWeight: 600,
      color: colors.darkBlue,
    },
    cardActions: {
      display: 'flex',
      gap: 8,
    },
    actionBtn: {
      padding: '6px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 12,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    emptyState: {
      padding: 64,
      textAlign: 'center',
      background: colors.gray100,
      borderRadius: 12,
      gridColumn: '1 / -1',
    },
    emptyIcon: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.gray500,
      marginBottom: 20,
    },
    statsRow: {
      gap: 16,
      marginBottom: 32,
    },
    statsRowClass: 'grid grid-cols-2 md:grid-cols-4 gap-4',
    statCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      padding: 20,
      textAlign: 'center',
    },
    statNumber: {
      fontSize: 32,
      fontWeight: 700,
      color: colors.darkBlue,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.gray500,
    },
  };

  // Sent invites — connections the user invited that haven't accepted yet.
  // Surfaced both on "All" (with a Pending badge) and on the Pending tab.
  const sentInvites = connections.filter(c => c.status === 'invited');

  // Counts are derived from the real list — never hardcoded.
  const counts = useMemo(() => ({
    all: connections.length,
    clients: connections.filter(c => c.type === 'client').length,
    tradepros: connections.filter(c => c.type === 'tradepro').length,
    prosource: connections.filter(c => c.type === 'prosource').length,
  }), [connections]);

  const pendingCount = pendingRequests.length + sentInvites.length;

  const tabs = [
    { id: 'all', label: 'All Connections', icon: Users, count: counts.all },
    { id: 'clients', label: 'Clients', icon: Home, count: counts.clients },
    { id: 'tradepros', label: 'Trade Pros', icon: Briefcase, count: counts.tradepros },
    { id: 'prosource', label: 'ProSource', icon: MapPin, count: counts.prosource },
    { id: 'pending', label: 'Pending', icon: UserPlus, count: pendingCount, highlight: pendingCount > 0 },
  ];

  // For pending tab, surface sent invites in the connections grid. Received
  // requests render in their own grid below.
  const filteredConnections = activeTab === 'pending'
    ? sentInvites
    : activeTab === 'all'
      ? connections
      : connections.filter(c => {
          if (activeTab === 'clients') return c.type === 'client';
          if (activeTab === 'tradepros') return c.type === 'tradepro';
          if (activeTab === 'prosource') return c.type === 'prosource';
          return true;
        });

  const matches = (person, q) =>
    (person.name || '').toLowerCase().includes(q) ||
    (person.role || '').toLowerCase().includes(q) ||
    (person.email || '').toLowerCase().includes(q);

  const searchedConnections = searchQuery
    ? filteredConnections.filter(c => matches(c, searchQuery.toLowerCase()))
    : filteredConnections;

  const searchedPending = activeTab === 'pending' && searchQuery
    ? pendingRequests.filter(r => matches(r, searchQuery.toLowerCase()))
    : pendingRequests;

  /** Real type/role drives this label — not a `projects === null` guess. */
  const renderRelationship = (connection) => {
    if (connection.status === 'invited') {
      return (
        <span style={styles.projectCount}>
          {connection.inviteEmailSent ? 'Invitation emailed' : 'Invite recorded · no email sent'}
        </span>
      );
    }
    if (connection.type === 'prosource') {
      return <span style={styles.projectCount}>ProSource Team Member</span>;
    }
    if (typeof connection.projects === 'number') {
      return (
        <span style={styles.projectCount}>
          <span style={styles.projectCountNum}>{connection.projects}</span>
          {' '}shared project{connection.projects !== 1 ? 's' : ''}
        </span>
      );
    }
    return <span style={styles.projectCount}>No shared projects</span>;
  };


  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      {/* Back Link */}
      <Link to="/settings" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* Page Header */}
      <div style={styles.pageHeader}>
        <div className="flex-1 min-w-0">
          <h1 style={styles.pageTitle}>Connections</h1>
          <p style={styles.pageDesc}>
            Manage your network of clients, subcontractors, and ProSource team members.
            Add connections to quickly invite them to projects.
          </p>
        </div>
      </div>

      {/* Search + Add. (The old "Filter" button was a no-op and removed: the
          tabs already filter by type and the search box covers name/role/email.) */}
      <div className="flex flex-wrap gap-2 mb-6 items-stretch">
        <div className="flex-1 min-w-[200px]" style={{ position: 'relative' }}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name, role, or email..."
            style={{ ...styles.searchInput, width: '100%', boxSizing: 'border-box' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="whitespace-nowrap shrink-0" style={styles.btnPrimary} onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} /> Add
        </button>
      </div>

      {actionError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          background: '#fef2f2', border: `1px solid ${colors.red}`,
          borderRadius: 6, fontSize: 13, color: colors.red,
        }}>
          <AlertCircle size={15} /> {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="scrollbar-hide" style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={styles.tab(activeTab === tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
            <span style={{
              ...styles.tabCount,
              ...(tab.highlight && {
                background: colors.red,
                color: '#fff',
              }),
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Pending Requests Grid */}
      {activeTab === 'pending' && (
        <div style={styles.connectionsGrid}>
          {searchedPending.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <UserPlus size={48} color={colors.gray300} />
              </div>
              <div style={styles.emptyTitle}>No pending requests</div>
              <div style={styles.emptyText}>
                When someone sends you a connection request, it will appear here.
              </div>
            </div>
          ) : (
            searchedPending.map(request => (
              <div
                key={request.id}
                style={styles.connectionCard}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.avatar(request.type)}>
                    {request.initials}
                  </div>
                  <div style={styles.cardInfo}>
                    <div style={styles.connectionName}>{request.name}</div>
                    <div style={styles.connectionRole}>{request.role}</div>
                    <span style={styles.roleBadge(request.type)}>
                      {request.type === 'client' ? 'Client' :
                       request.type === 'tradepro' ? 'Trade Pro' : 'ProSource'}
                    </span>
                  </div>
                </div>

                <div style={styles.contactInfo}>
                  <div style={styles.contactItem}>
                    <Mail size={14} style={styles.contactIcon} />
                    {request.email}
                  </div>
                  {request.message && (
                    <div style={{
                      fontSize: 13,
                      color: colors.gray500,
                      fontStyle: 'italic',
                      padding: '8px 12px',
                      background: colors.gray100,
                      borderRadius: 6,
                      marginTop: 4,
                    }}>
                      "{request.message}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => respondToRequest(request, 'accept')}
                    disabled={requestBusyId === request.id}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: colors.darkBlue,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: requestBusyId === request.id ? 'wait' : 'pointer',
                      opacity: requestBusyId === request.id ? 0.7 : 1,
                    }}
                  >
                    {requestBusyId === request.id ? 'Working…' : 'Accept'}
                  </button>
                  <button
                    onClick={() => respondToRequest(request, 'decline')}
                    disabled={requestBusyId === request.id}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#fff',
                      color: colors.gray700,
                      border: `1px solid ${colors.gray300}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: requestBusyId === request.id ? 'wait' : 'pointer',
                      opacity: requestBusyId === request.id ? 0.7 : 1,
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Connections Grid (also renders sent invites on the Pending tab) */}
      {(activeTab !== 'pending' || sentInvites.length > 0) && (
      <>
      {activeTab === 'pending' && (
        <div style={{
          fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
          color: colors.gray500, letterSpacing: 0.5, margin: '8px 0 12px',
        }}>
          Sent invitations · {sentInvites.length}
        </div>
      )}
      <div style={styles.connectionsGrid}>
        {!dataLoaded ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyText}>Loading your connections…</div>
          </div>
        ) : searchedConnections.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Users size={48} color={colors.gray300} />
            </div>
            <div style={styles.emptyTitle}>No connections found</div>
            <div style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search terms' : 'Add your first connection to get started'}
            </div>
            {!searchQuery && (
              <button style={styles.btnPrimary} onClick={() => setShowAddModal(true)}>
                <UserPlus size={16} /> Add Connection
              </button>
            )}
          </div>
        ) : (
          searchedConnections.map(connection => {
            // An invite I sent that nobody has accepted yet — drives the card
            // chrome (dashed/amber) and the Resend action.
            const isInvited = connection.status === 'invited';
            // Per the identity contract: no demoIdentity and no userId means
            // there is no one on the other end to message yet.
            const canMessage = isMessageable(connection);
            const resendResult = resendResults[connection.id];
            const isResending = resendingId === connection.id;
            const isRemoving = removingId === connection.id;
            return (
            <div
              key={connection.id}
              style={{
                ...styles.connectionCard,
                ...(isInvited ? { background: '#fffbeb', borderStyle: 'dashed' } : {}),
                ...(isRemoving ? { opacity: 0.5 } : {}),
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={styles.cardHeader}>
                <div style={{ ...styles.avatar(connection.type), opacity: isInvited ? 0.6 : 1 }}>
                  {connection.initials}
                </div>
                <div style={styles.cardInfo}>
                  {/* Not a link: /profile always renders the same demo pro
                      regardless of who you click. Per-user profiles are WP11 —
                      until that route exists, a link here would lie. */}
                  <div style={styles.connectionName}>{connection.name}</div>
                  <div style={styles.connectionRole}>
                    {isInvited ? 'Awaiting their response' : connection.role}
                  </div>
                  {isInvited ? (
                    <span style={styles.pendingBadge}>
                      <Clock size={11} /> Pending invite
                    </span>
                  ) : (
                    <span style={styles.roleBadge(connection.type)}>
                      {connection.type === 'client' ? 'Client' :
                       connection.type === 'tradepro' ? 'Trade Pro' : 'ProSource'}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    style={styles.moreBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === connection.id ? null : connection.id);
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {openDropdownId === connection.id && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      background: '#fff',
                      border: `1px solid ${colors.gray200}`,
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 10,
                      minWidth: 180,
                      padding: '4px 0',
                    }}>
                      <button
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: colors.red,
                          fontWeight: 500,
                        }}
                        onClick={() => removeConnection(connection)}
                        disabled={isRemoving}
                      >
                        <Trash2 size={14} /> {isInvited ? 'Cancel invitation' : 'Remove Connection'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.contactInfo}>
                {connection.email && (
                  <div style={styles.contactItem}>
                    <Mail size={14} style={styles.contactIcon} />
                    {connection.email}
                  </div>
                )}
                {connection.phone && (
                  <div style={styles.contactItem}>
                    <Phone size={14} style={styles.contactIcon} />
                    {connection.phone}
                  </div>
                )}
                {connection.location && (
                  <div style={styles.contactItem}>
                    <MapPin size={14} style={styles.contactIcon} />
                    {connection.location}
                  </div>
                )}
              </div>

              <div style={styles.projectsInfo}>
                {renderRelationship(connection)}
                <div style={styles.cardActions}>
                  {isInvited ? (
                    <button
                      onClick={() => resendInvite(connection)}
                      disabled={isResending}
                      style={{
                        ...styles.actionBtn,
                        opacity: isResending ? 0.6 : 1,
                        cursor: isResending ? 'default' : 'pointer',
                      }}
                    >
                      <Send size={12} />
                      {isResending
                        ? 'Sending…'
                        : resendResult
                          ? (resendResult.emailSent ? 'Email resent' : 'Re-recorded · no email')
                          : 'Resend invite'}
                    </button>
                  ) : canMessage ? (
                    // Hand-off: messaging resolves this connection id to the right
                    // conversation (creating it if needed). We never touch Twilio.
                    <Link
                      to={`/messages?connection=${encodeURIComponent(connection.id)}`}
                      style={{ ...styles.actionBtn, textDecoration: 'none' }}
                    >
                      <MessageCircle size={12} /> Message
                    </Link>
                  ) : (
                    <span style={{ ...styles.actionBtn, cursor: 'default', color: colors.gray500 }}>
                      <Clock size={12} /> Invitation pending
                    </span>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div
          onClick={resetAddModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.gray200}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.gray900, margin: 0 }}>
                {addModalStep !== 'success'
                  ? 'Add Connection'
                  : resolvedUser
                    ? 'Connected'
                    : inviteResult?.emailSent
                      ? 'Invitation Sent'
                      : 'Invitation Recorded'}
              </h2>
              <button
                onClick={resetAddModal}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.gray500, padding: 4,
                }}
              >
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            {/* Step 1: enter an email */}
            {addModalStep === 'search' && (
              <div style={{ padding: 24 }}>
                <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 16 }}>
                  Enter their email. If they're already on ProSource we'll connect you;
                  otherwise we'll send them an invitation to sign up.
                </p>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: colors.gray700, marginBottom: 6, display: 'block' }}>
                    Email address
                  </label>
                  <input
                    autoFocus
                    type="email"
                    placeholder="name@email.com"
                    value={addModalEmail}
                    onChange={(e) => { setAddModalEmail(e.target.value); setAddError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') lookupEmail(); }}
                    style={{
                      width: '100%', padding: '12px 14px',
                      border: `1px solid ${addError ? colors.red : colors.gray300}`,
                      borderRadius: 6, fontSize: 14, outline: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  {addError && <div style={{ fontSize: 12, color: colors.red, marginTop: 6 }}>{addError}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setAddModalEmail(userEmail || ''); setAddError(''); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: colors.darkBlue, fontSize: 13, fontWeight: 500,
                      padding: 0, fontFamily: 'inherit',
                    }}
                  >Use my own email</button>
                  <button
                    onClick={lookupEmail}
                    disabled={!addModalEmail.trim() || addModalBusy}
                    style={{
                      padding: '10px 22px',
                      background: addModalEmail.trim() ? colors.darkBlue : colors.gray300,
                      color: '#fff', border: 'none', borderRadius: 6,
                      fontSize: 14, fontWeight: 600,
                      cursor: addModalEmail.trim() && !addModalBusy ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      opacity: addModalBusy ? 0.7 : 1,
                    }}
                  >{addModalBusy ? 'Looking up…' : 'Continue →'}</button>
                </div>
              </div>
            )}

            {/* Found User Step — resolved a real ProSource member */}
            {addModalStep === 'found' && resolvedUser && (
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 13, color: colors.green, fontWeight: 500, marginBottom: 12 }}>
                  ✓ Found on ProSource
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: 16, background: colors.gray100, borderRadius: 8,
                  marginBottom: 16,
                }}>
                  <div style={styles.avatar(resolvedUser.type)}>{initialsFor(resolvedUser.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{resolvedUser.name}</div>
                    <div style={{ fontSize: 13, color: colors.gray500 }}>
                      {[resolvedUser.role, resolvedUser.businessName].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ fontSize: 12, color: colors.gray400, marginTop: 2 }}>{resolvedUser.email}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: colors.gray700, marginBottom: 6, display: 'block' }}>
                    Add a personal note <span style={{ color: colors.gray500, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    placeholder={`Hi ${(resolvedUser.name || '').split(' ')[0] || 'there'}, I'd love to connect about…`}
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: `1px solid ${colors.gray300}`, borderRadius: 6,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div style={{ fontSize: 11, color: colors.gray500, marginTop: 4 }}>
                    Saved as the opening message of your conversation with them.
                  </div>
                </div>
                {addError && <div style={{ fontSize: 12, color: colors.red, marginBottom: 12 }}>{addError}</div>}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => { setAddModalStep('search'); setAddError(''); }}
                    disabled={addModalBusy}
                    style={{
                      flex: 1, padding: '12px',
                      background: '#fff', color: colors.gray700,
                      border: `1px solid ${colors.gray300}`, borderRadius: 6,
                      fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >Back</button>
                  <button
                    onClick={confirmFoundUser}
                    disabled={addModalBusy}
                    style={{
                      flex: 1, padding: '12px',
                      background: colors.darkBlue, color: '#fff',
                      border: 'none', borderRadius: 6,
                      fontSize: 14, fontWeight: 600,
                      cursor: addModalBusy ? 'wait' : 'pointer',
                      fontFamily: 'inherit', opacity: addModalBusy ? 0.7 : 1,
                    }}
                  >{addModalBusy ? 'Connecting…' : 'Connect & send'}</button>
                </div>
              </div>
            )}

            {/* Invite Step — email isn't a ProSource user yet */}
            {addModalStep === 'invite' && (
              <div style={{ padding: 24 }}>
                <div style={{
                  padding: 16, background: '#fef9c3', borderRadius: 8,
                  marginBottom: 16, fontSize: 13, color: '#854d0e',
                }}>
                  <strong>{addModalEmail}</strong> isn't on ProSource yet.
                </div>
                <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 14 }}>
                  We'll email them an invitation to sign up. Once they accept, they'll
                  show up as a connected member here.
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: colors.gray700, marginBottom: 6, display: 'block' }}>
                    Add a personal note <span style={{ color: colors.gray500, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    placeholder="Hi! I'd like to connect with you on ProSource…"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: `1px solid ${colors.gray300}`, borderRadius: 6,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div style={{ fontSize: 11, color: colors.gray500, marginTop: 4 }}>
                    Included in the invitation email they receive.
                  </div>
                </div>
                {addError && <div style={{ fontSize: 12, color: colors.red, marginBottom: 12 }}>{addError}</div>}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => { setAddModalStep('search'); setAddError(''); }}
                    disabled={addModalBusy}
                    style={{
                      flex: 1, padding: '12px',
                      background: '#fff', color: colors.gray700,
                      border: `1px solid ${colors.gray300}`, borderRadius: 6,
                      fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >Back</button>
                  <button
                    onClick={sendInvite}
                    disabled={addModalBusy}
                    style={{
                      flex: 1, padding: '12px',
                      background: colors.darkBlue, color: '#fff',
                      border: 'none', borderRadius: 6,
                      fontSize: 14, fontWeight: 600,
                      cursor: addModalBusy ? 'wait' : 'pointer',
                      fontFamily: 'inherit', opacity: addModalBusy ? 0.7 : 1,
                    }}
                  >{addModalBusy ? 'Sending…' : 'Send Invitation'}</button>
                </div>
              </div>
            )}

            {/* Success Step */}
            {addModalStep === 'success' && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: resolvedUser || inviteResult?.emailSent ? '#dcfce7' : '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  {resolvedUser || inviteResult?.emailSent
                    ? <UserPlus size={28} color={colors.green} />
                    : <AlertCircle size={28} color="#92400e" />}
                </div>
                <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 24 }}>
                  {resolvedUser ? (
                    <>You're now connected with <strong>{resolvedUser.name}</strong>. They appear in your connections, project team picker, and messaging.
                      {inviteMessage.trim() && ' Your note is saved as the opening message of your conversation.'}</>
                  ) : inviteResult?.emailSent ? (
                    <>Invitation emailed to <strong>{addModalEmail}</strong>. Once they sign up and accept, they'll show up as a connected member here.</>
                  ) : (
                    <>
                      <strong>No email was sent.</strong>{' '}
                      {inviteResult?.reason === 'email-not-configured'
                        ? 'Email delivery is not configured in this environment (no RESEND_API_KEY), so nothing was delivered to '
                        : 'The email failed to send, so nothing was delivered to '}
                      <strong>{addModalEmail}</strong>.
                      <br /><br />
                      The invitation itself <strong>was recorded</strong>
                      {inviteResult?.token ? ' with a real invite token' : ''} and{' '}
                      <strong>{addModalEmail.split('@')[0]}</strong> now shows in your list as a pending
                      invite{inviteMessage.trim() ? ', along with your note' : ''}. They stay pending until they join.
                      {inviteResult?.error && (
                        <><br /><span style={{ fontSize: 12, color: colors.red }}>{inviteResult.error}</span></>
                      )}
                    </>
                  )}
                </p>
                <button
                  onClick={resetAddModal}
                  style={{
                    padding: '12px 32px',
                    background: colors.darkBlue, color: '#fff',
                    border: 'none', borderRadius: 6,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default ProSourceConnections;
