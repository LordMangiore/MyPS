import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth-context';
import {
  Search,
  Plus,
  Filter,
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
  ChevronDown,
  Clock,
  Send,
} from 'lucide-react';

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

  const initialsFor = (name) =>
    (name || '').split(/\s+/).filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join('') || '?';

  const resetAddModal = () => {
    setShowAddModal(false);
    setAddModalStep('search');
    setAddModalEmail('');
    setResolvedUser(null);
    setAddError('');
    setInviteMessage('');
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
    const existing = await loadUserData('connections', null);
    const list = Array.isArray(existing?.list) ? existing.list : [];
    // De-dupe by email to keep the list clean if the user repeats the flow.
    const filtered = record.email
      ? list.filter((c) => (c.email || '').toLowerCase() !== record.email.toLowerCase())
      : list;
    const id = (filtered.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
    const newRecord = { id, addedAt: Date.now(), ...record };
    const next = [...filtered, newRecord];
    await saveUserData('connections', { list: next });
    setConnections(next);
    return newRecord;
  };

  const confirmFoundUser = async () => {
    if (!resolvedUser) return;
    setAddModalBusy(true);
    try {
      await persistNewConnection({
        name: resolvedUser.name,
        initials: initialsFor(resolvedUser.name),
        role: resolvedUser.role,
        type: resolvedUser.type,
        email: resolvedUser.email,
        phone: resolvedUser.phone,
        location: resolvedUser.address,
        businessName: resolvedUser.businessName,
        userId: resolvedUser.userId,
        status: 'connected',
        projects: null,
      });

      // If the user added a personal message, kick off a Twilio conversation
      // between the two identities and post the message as the first turn.
      const msg = inviteMessage.trim();
      if (msg && userId && resolvedUser.userId) {
        try {
          await fetch('/api/twilio-conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              userId,
              otherIdentity: resolvedUser.userId,
              friendlyName: resolvedUser.name,
              attributes: {
                counterpartyName: resolvedUser.name,
                counterpartyInitials: initialsFor(resolvedUser.name),
                counterpartyRole: resolvedUser.role,
                counterpartyType: resolvedUser.type,
                origin: 'connection-invite',
              },
            }),
          }).then((r) => r.json()).then(async (data) => {
            if (data?.sid) {
              await fetch('/api/twilio-conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'post',
                  conversationSid: data.sid,
                  identity: userId,
                  body: msg,
                }),
              });
            }
          });
        } catch (err) {
          console.warn('Failed to post invite message:', err.message);
        }
      }

      setAddModalStep('success');
    } catch (err) {
      setAddError(err.message || 'Could not add connection');
    } finally {
      setAddModalBusy(false);
    }
  };

  const sendInvite = async () => {
    setAddModalBusy(true);
    try {
      // Save the pending connection so it shows up immediately in the list.
      const placeholderName = addModalEmail.split('@')[0];
      await persistNewConnection({
        name: placeholderName,
        initials: initialsFor(placeholderName),
        role: 'Pending invitation',
        type: 'tradepro',
        email: addModalEmail.trim(),
        phone: '',
        location: '',
        status: 'invited',
        projects: null,
      });

      // Fire the actual email with the personal message attached.
      try {
        await fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: addModalEmail.trim(),
            fromName: userName || 'A trade pro',
            message: inviteMessage.trim(),
          }),
        });
      } catch (err) {
        console.warn('Invitation email failed:', err.message);
      }
      setAddModalStep('success');
    } catch (err) {
      setAddError(err.message || 'Could not send invitation');
    } finally {
      setAddModalBusy(false);
    }
  };
  const [resendingId, setResendingId] = useState(null);
  const [resentIds, setResentIds] = useState(() => new Set());
  const resendInvite = async (connection) => {
    if (!connection?.email) return;
    setResendingId(connection.id);
    try {
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: connection.email,
          fromName: userName || 'A trade pro',
          message: '',
        }),
      });
      setResentIds((prev) => new Set([...prev, connection.id]));
    } catch (err) {
      console.warn('Resend invite failed:', err.message);
    } finally {
      setResendingId(null);
    }
  };

  const [pendingRequests, setPendingRequests] = useState([
    {
      id: 101,
      name: 'Mike Johnson',
      initials: 'MJ',
      role: 'General Contractor',
      type: 'tradepro',
      email: 'mike.johnson@builds.com',
      message: 'Hi! I worked with Ryan O\'Toole on a project and he recommended connecting.',
    },
    {
      id: 102,
      name: 'Lisa Park',
      initials: 'LP',
      role: 'Homeowner',
      type: 'client',
      email: 'lisa.park@email.com',
      message: 'Looking for a designer for my kitchen remodel project.',
    },
  ]);

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
    filterBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
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

  const FALLBACK_CONNECTIONS = [
    {
      id: 1,
      name: 'Bubba Beans',
      initials: 'BB',
      role: 'Homeowner',
      type: 'client',
      email: 'bubba.beans@email.com',
      phone: '(314) 555-0123',
      location: 'St. Louis, MO',
      projects: 2,
    },
    {
      id: 2,
      name: 'Martha Wilson',
      initials: 'MW',
      role: 'Homeowner',
      type: 'client',
      email: 'martha.wilson@email.com',
      phone: '(314) 555-0456',
      location: 'Clayton, MO',
      projects: 1,
    },
    {
      id: 3,
      name: 'Ryan O\'Toole',
      initials: 'RO',
      role: 'Flooring Installer',
      type: 'tradepro',
      email: 'ryan@otooleinstalls.com',
      phone: '(314) 555-0789',
      location: 'St. Charles, MO',
      projects: 5,
    },
    {
      id: 4,
      name: 'Kim Marks',
      initials: 'KM',
      role: 'Account Manager',
      type: 'prosource',
      email: 'kim.marks@prosource.com',
      phone: '(314) 282-4798',
      location: 'ProSource of St. Louis',
      projects: null,
    },
    {
      id: 5,
      name: 'James Anderson',
      initials: 'JA',
      role: 'General Contractor',
      type: 'tradepro',
      email: 'james@andersonbuilds.com',
      phone: '(314) 555-1234',
      location: 'Chesterfield, MO',
      projects: 3,
    },
    {
      id: 6,
      name: 'Sarah Chen',
      initials: 'SC',
      role: 'Homeowner',
      type: 'client',
      email: 'sarah.chen@email.com',
      phone: '(314) 555-5678',
      location: 'Ladue, MO',
      projects: 1,
    },
    {
      id: 7,
      name: 'Heather Yager',
      initials: 'HY',
      role: 'Designer',
      type: 'prosource',
      email: 'heather.yager@prosource.com',
      phone: '(314) 282-4798',
      location: 'ProSource of St. Louis',
      projects: null,
    },
    {
      id: 8,
      name: 'Mike Torres',
      initials: 'MT',
      role: 'Tile Installer',
      type: 'tradepro',
      email: 'mike@torrestile.com',
      phone: '(314) 555-9012',
      location: 'Kirkwood, MO',
      projects: 4,
    },
  ];

  const [connections, setConnections] = useState(FALLBACK_CONNECTIONS);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('connections', null).then((stored) => {
      if (cancelled) return;
      if (Array.isArray(stored?.list) && stored.list.length > 0) {
        setConnections(stored.list);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Sent invites — connections the user invited that haven't accepted yet.
  // Surfaced both on "All" (with a Pending badge) and on the Pending tab.
  const sentInvites = connections.filter(c => c.status === 'invited');

  const tabs = [
    { id: 'all', label: 'All Connections', icon: Users, count: 12 },
    { id: 'clients', label: 'Clients', icon: Home, count: 6 },
    { id: 'tradepros', label: 'Trade Pros', icon: Briefcase, count: 4 },
    { id: 'prosource', label: 'ProSource', icon: MapPin, count: 2 },
    { id: 'pending', label: 'Pending', icon: UserPlus, count: pendingRequests.length + sentInvites.length, highlight: (pendingRequests.length + sentInvites.length) > 0 },
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

  const searchedConnections = searchQuery
    ? filteredConnections.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredConnections;

  const searchedPending = activeTab === 'pending' && searchQuery
    ? pendingRequests.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingRequests;

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

      {/* Search + Filter + Add */}
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
        <button className="whitespace-nowrap shrink-0" style={styles.filterBtn}>
          <Filter size={16} /> Filter
        </button>
        <button className="whitespace-nowrap shrink-0" style={styles.btnPrimary} onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} /> Add
        </button>
      </div>

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
                    onClick={() => setPendingRequests(prev => prev.filter(r => r.id !== request.id))}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: colors.darkBlue,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setPendingRequests(prev => prev.filter(r => r.id !== request.id))}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#fff',
                      color: colors.gray700,
                      border: `1px solid ${colors.gray300}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
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
        {searchedConnections.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Users size={48} color={colors.gray300} />
            </div>
            <div style={styles.emptyTitle}>No connections found</div>
            <div style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search terms' : 'Add your first connection to get started'}
            </div>
            <button style={styles.btnPrimary}>
              <UserPlus size={16} /> Add Connection
            </button>
          </div>
        ) : (
          searchedConnections.map(connection => {
            const isInvited = connection.status === 'invited';
            const wasResent = resentIds.has(connection.id);
            const isResending = resendingId === connection.id;
            return (
            <div
              key={connection.id}
              style={{
                ...styles.connectionCard,
                ...(isInvited ? { background: '#fffbeb', borderStyle: 'dashed' } : {}),
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={styles.cardHeader}>
                <div style={{ ...styles.avatar(connection.type), opacity: isInvited ? 0.6 : 1 }}>
                  {connection.initials}
                </div>
                <div style={styles.cardInfo}>
                  <Link to="/profile" style={{ ...styles.connectionName, textDecoration: 'none', color: 'inherit' }}>{connection.name}</Link>
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
                        onClick={() => setOpenDropdownId(null)}
                      >
                        <Trash2 size={14} /> Remove Connection
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
                {isInvited ? (
                  <span style={styles.projectCount}>Invite sent</span>
                ) : connection.projects !== null ? (
                  <span style={styles.projectCount}>
                    <span style={styles.projectCountNum}>{connection.projects}</span> shared project{connection.projects !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span style={styles.projectCount}>ProSource Team Member</span>
                )}
                <div style={styles.cardActions}>
                  {isInvited ? (
                    <button
                      onClick={() => resendInvite(connection)}
                      disabled={isResending || wasResent}
                      style={{
                        ...styles.actionBtn,
                        opacity: isResending || wasResent ? 0.6 : 1,
                        cursor: isResending || wasResent ? 'default' : 'pointer',
                      }}
                    >
                      <Send size={12} />
                      {wasResent ? 'Resent' : isResending ? 'Sending…' : 'Resend invite'}
                    </button>
                  ) : (
                    <Link to="/messages" style={{ ...styles.actionBtn, textDecoration: 'none' }}>
                      <MessageCircle size={12} /> Message
                    </Link>
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
                {addModalStep === 'success' ? 'Request Sent!' : 'Add Connection'}
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
                    Sent as the first message of your conversation with them.
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
                  background: '#dcfce7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <UserPlus size={28} color={colors.green} />
                </div>
                <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 24 }}>
                  {resolvedUser ? (
                    <>You're now connected with <strong>{resolvedUser.name}</strong>. They appear in your connections, project team picker, and messaging.</>
                  ) : (
                    <>Invitation sent to <strong>{addModalEmail}</strong>. They'll get an email with a signup link, and once they accept they'll show up as a connected member here.</>
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
