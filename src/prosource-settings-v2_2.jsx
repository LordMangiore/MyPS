import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from './auth-context';
import {
  Home,
  Lightbulb,
  FileText,
  ShoppingCart,
  Handshake,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Camera,
  Check,
  X,
  ArrowLeft,
  Tag,
  Search
} from 'lucide-react';
import AppointmentModal from './prosource-appointment-modal';
import Select from './components/Select';

// ProSource Brand Colors from source
const colors = {
  red: '#BA0C2F',
  redHover: '#9a0a27',
  darkBlue: '#003087',
  lightBlue: '#6CACE4',
  green: '#07542E',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

// Small icon-button used next to team members to open a direct-message thread.
// Has its own hover state so the four instances across the dashboard stay in sync.
function ChatBubbleLink({ to, title }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1px solid ${hovered ? colors.darkBlue : colors.gray200}`,
        background: hovered ? '#f0f5ff' : '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <MessageCircle size={16} color={hovered ? colors.darkBlue : colors.gray500} />
    </Link>
  );
}

// This component is designed to work INSIDE the existing ProSource dashboard layout
// It replaces the content in .col-dashboard-content while keeping the existing header and sidebar
export default function ProSourceSettingsRedesign() {
  const {
    isNewUser,
    userName,
    showroom,
    accountManager,
    userId,
    userEmail,
    profile,
    saveProfile,
    loadUserData,
  } = useAuth();

  // Personal info editor state: seeded from the saved profile, edits flushed
  // back via saveProfile.
  const [personalInfo, setPersonalInfo] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    phone: profile?.phone || '',
    businessName: profile?.business?.name || '',
  });
  const [personalInfoDirty, setPersonalInfoDirty] = useState(false);
  const [personalInfoSaving, setPersonalInfoSaving] = useState(false);
  const [personalInfoSavedAt, setPersonalInfoSavedAt] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setPersonalInfo((prev) => ({
      firstName: prev.firstName || profile.firstName || '',
      lastName: prev.lastName || profile.lastName || '',
      phone: prev.phone || profile.phone || '',
      businessName: prev.businessName || profile.business?.name || '',
    }));
  }, [profile]);

  const updatePersonalInfo = (patch) => {
    setPersonalInfo((prev) => ({ ...prev, ...patch }));
    setPersonalInfoDirty(true);
    setPersonalInfoSavedAt(null);
  };

  const savePersonalInfo = async () => {
    setPersonalInfoSaving(true);
    try {
      await saveProfile({
        firstName: personalInfo.firstName.trim(),
        lastName: personalInfo.lastName.trim(),
        phone: personalInfo.phone.trim(),
        business: {
          ...(profile?.business || {}),
          name: personalInfo.businessName.trim(),
        },
      });
      setPersonalInfoDirty(false);
      setPersonalInfoSavedAt(Date.now());
    } catch (err) {
      alert(`Could not save personal info: ${err.message}`);
    } finally {
      setPersonalInfoSaving(false);
    }
  };
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'dashboard';
  const [projectsList, setProjectsList] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [appointmentsRefreshKey, setAppointmentsRefreshKey] = useState(0);


  // Pull the user's projects + message threads + appointments so the dashboard
  // activity feed, project/message counts, and team panel reflect real data.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      loadUserData('projects', null),
      loadUserData('messages', null),
      loadUserData('appointments', null),
    ]).then(([p, m, a]) => {
      if (cancelled) return;
      const list = Array.isArray(p?.list)
        ? p.list
        : (p?.project ? [{ ...p.project, status: p.status || 'working', archived: !!p.archived, id: 'legacy' }] : []);
      setProjectsList(list);
      setMessageThreads(Array.isArray(m?.threads) ? m.threads : []);
      // Only keep appointments booked recently, dropping the obviously stale ones.
      const appts = Array.isArray(a?.list) ? a.list : [];
      const cutoff = Date.now() - 30 * 86400000;
      setUpcomingAppointments(
        appts
          .filter((x) => x.status !== 'cancelled' && (x.bookedAt || 0) > cutoff)
          .sort((x, y) => (x.bookedAt || 0) - (y.bookedAt || 0))
      );
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, appointmentsRefreshKey]);

  // Synthesize activity items from the data we have. Each item carries a
  // sortable timestamp so the feed stays current as projects/threads change.
  const activityItems = useMemo(() => {
    const items = [];
    projectsList.forEach((p) => {
      if (p.archived) return;
      if (p.status === 'complete') {
        items.push({
          ts: p.updatedAt || 0,
          text: 'Marked complete:',
          target: p.name,
          to: `/projects/${p.id}`,
          link: 'View project →',
        });
      } else if (p.status === 'published') {
        items.push({
          ts: p.updatedAt || 0,
          text: 'Published to your portfolio:',
          target: p.name,
          to: `/projects/${p.id}`,
          link: 'View project →',
        });
      } else {
        items.push({
          ts: p.createdAt || p.updatedAt || 0,
          text: 'New project created:',
          target: p.name,
          to: `/projects/${p.id}`,
          link: 'View project →',
        });
      }
    });
    messageThreads.forEach((t) => {
      const last = t.messages?.[t.messages.length - 1];
      if (!last || last.isMe) return; // only show inbound messages as activity
      items.push({
        ts: last.timestamp || t.updatedAt || 0,
        text: `${t.name} sent you a message:`,
        target: last.text,
        to: '/messages',
        link: 'View thread →',
      });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [projectsList, messageThreads]);

  const formatActivityDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [commFrequency, setCommFrequency] = useState('Weekly');
  const [referralShowroom, setReferralShowroom] = useState('jackson');
  const [acceptingLeads, setAcceptingLeads] = useState(true);
  const [expandedYear, setExpandedYear] = useState(2024);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentBtnHover, setAppointmentBtnHover] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [userSaved, setUserSaved] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    access: 'full'
  });

  // Welcome modal - shows for new users from onboarding or if not dismissed
  const [tipSlide, setTipSlide] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    if (isNewUser) return true;
    return !localStorage.getItem('prosource_welcome_dismissed');
  });

  const dismissWelcome = () => {
    localStorage.setItem('prosource_welcome_dismissed', 'true');
    setShowWelcomeModal(false);
  };

  // For demo: reset welcome modal
  const resetWelcomeModal = () => {
    localStorage.removeItem('prosource_welcome_dismissed');
    setShowWelcomeModal(true);
  };

  // Styles
  const styles = {
    // Outer wrapper - full width background if needed
    wrapper: {
      fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#fafafa',
      minHeight: '100vh',
    },
    // Inner container - constrained width with padding (matches prod layout)
    container: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '24px 24px 48px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      color: colors.darkBlue,
      fontSize: 14,
      fontWeight: 500,
      textDecoration: 'none',
      marginBottom: 16,
    },
    // Top welcome bar (replaces the scattered header widgets)
    welcomeBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 0',
      borderBottom: `1px solid ${colors.gray200}`,
      marginBottom: 24,
    },
    welcomeLeft: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    pageTitle: {
      fontSize: 24,
      fontWeight: 600,
      color: colors.gray900,
      margin: 0,
    },
    pageSubtitle: {
      fontSize: 14,
      color: colors.gray500,
      margin: 0,
    },
    // Content cards
    card: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      marginBottom: 24,
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '16px 24px',
      borderBottom: `1px solid ${colors.gray200}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
      margin: 0,
    },
    cardBody: {
      padding: 24,
    },
    // Form elements
    formRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: 20,
      marginBottom: 20,
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: colors.gray500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    input: {
      padding: '12px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'inherit',
      transition: 'border-color 0.15s ease',
    },
    select: {
      padding: '12px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'inherit',
      background: '#fff',
      cursor: 'pointer',
    },
    textarea: {
      padding: '12px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'inherit',
      minHeight: 100,
      resize: 'vertical',
    },
    // Buttons
    btnPrimary: {
      padding: '12px 24px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
    btnOutline: {
      padding: '12px 24px',
      background: 'transparent',
      color: colors.gray700,
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
    },
    btnSmall: {
      padding: '8px 16px',
      fontSize: 13,
    },
    btnDanger: {
      padding: '12px 24px',
      background: 'transparent',
      color: colors.red,
      border: `1px solid ${colors.red}`,
      borderRadius: 4,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
    },
    // Toggle switch
    toggle: (isOn) => ({
      width: 48,
      height: 26,
      borderRadius: 13,
      background: isOn ? colors.green : colors.gray300,
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background 0.2s ease',
    }),
    toggleKnob: (isOn) => ({
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: 3,
      left: isOn ? 25 : 3,
      transition: 'left 0.2s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }),
    // Settings row
    settingRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      background: colors.gray100,
      borderRadius: 6,
      marginBottom: 12,
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 14,
      fontWeight: 500,
      color: colors.gray900,
      marginBottom: 4,
    },
    settingDesc: {
      fontSize: 13,
      color: colors.gray500,
    },
    // Project styles
    projectsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 20,
    },
    projectCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      padding: 20,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      position: 'relative',
    },
    projectCardHover: {
      borderColor: colors.darkBlue,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
    projectStatus: (status) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: status === 'working' ? '#e3f2fd' : status === 'completed' ? '#e8f5e9' : '#fff3cd',
      color: status === 'working' ? colors.darkBlue : status === 'completed' ? colors.green : '#856404',
      marginBottom: 12,
    }),
    projectName: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    projectMeta: {
      fontSize: 13,
      color: colors.gray500,
      marginBottom: 4,
    },
    projectBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      background: colors.red,
      color: '#fff',
      fontSize: 11,
      fontWeight: 600,
    },
    projectArrow: {
      position: 'absolute',
      right: 20,
      top: '50%',
      transform: 'translateY(-50%)',
      color: colors.gray300,
      fontSize: 20,
    },
    createProjectCard: {
      background: colors.gray100,
      border: `2px dashed ${colors.gray300}`,
      borderRadius: 8,
      padding: 32,
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.15s ease',
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottom: `1px solid ${colors.gray200}`,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      margin: 0,
    },
    searchBox: {
      display: 'flex',
      gap: 12,
      marginBottom: 32,
    },
    searchInput: {
      flex: 1,
      padding: '12px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 14,
    },
    // Table styles
    table: {
      width: '100%',
      minWidth: 720,
      borderCollapse: 'collapse',
    },
    tableHeader: {
      background: '#fff',
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: 12,
      fontWeight: 600,
      color: colors.gray500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: `1px solid ${colors.gray200}`,
    },
    td: {
      padding: '16px',
      fontSize: 14,
      color: colors.gray700,
      borderBottom: `1px solid ${colors.gray200}`,
    },
    statusBadge: (type) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      background: type === 'active' ? '#e8f5e9' : '#fff3cd',
      color: type === 'active' ? colors.green : '#856404',
    }),
    accessBadge: (type) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      background: type === 'full' ? '#e3f2fd' : '#fff3cd',
      color: type === 'full' ? colors.darkBlue : '#856404',
    }),
    // Danger zone
    dangerZone: {
      border: `1px solid #f5c6cb`,
      borderRadius: 8,
      padding: 24,
      background: '#fff5f5',
    },
    dangerTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.red,
      marginBottom: 8,
    },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Back Link - show on sub-pages */}
        {activeSection !== 'dashboard' && (
          <Link to="/settings" style={styles.backLink}>
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
        )}

        {/* Welcome Bar - replaces scattered header widgets */}
        <div style={styles.welcomeBar}>
        <div style={styles.welcomeLeft}>
          <h1 style={styles.pageTitle}>
            {activeSection === 'dashboard' ? `Welcome, ${userName || 'there'}.` :
             activeSection === 'projects' ? 'My Projects' :
             activeSection === 'referrals' ? 'Referral Bonus'
             : activeSection === 'account' ? 'Account Settings'
             : activeSection === 'team' ? 'Manage Users'
             : 'Settings'}
          </h1>
          <p style={styles.pageSubtitle}>
            {activeSection === 'dashboard'
              ? 'Your ProSource workspace.'
              : activeSection === 'projects'
              ? 'Take your projects online with myProSource. Collaborate with clients and publish completed work.'
              : activeSection === 'referrals'
              ? 'Track your referral bonuses from client purchases'
              : activeSection === 'account'
              ? 'Manage your login, notifications, and preferences'
              : 'Manage team access and permissions'}
          </p>
        </div>
        {/* Demo: Reset welcome modal button */}
        {activeSection === 'dashboard' && !showWelcomeModal && (
          <button
            onClick={resetWelcomeModal}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${colors.gray300}`,
              borderRadius: 6,
              fontSize: 12,
              color: colors.gray500,
              cursor: 'pointer',
            }}
          >
            Demo: Show Welcome
          </button>
        )}
      </div>


      {/* DASHBOARD SECTION */}
      {activeSection === 'dashboard' && (
        <div>
          {/* Welcome Modal for New Accounts */}
          {showWelcomeModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}>
              <div style={{
                background: '#fff',
                borderRadius: 16,
                width: '100%',
                maxWidth: 520,
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}>
                {/* Blue Header */}
                <div style={{
                  background: colors.darkBlue,
                  padding: '24px',
                  color: '#fff',
                  position: 'relative',
                }}>
                  <button
                    onClick={dismissWelcome}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <X size={16} />
                  </button>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    Welcome to ProSource!
                  </div>
                </div>

                {/* Account Manager Message (pulled from CRM lookup at signup) */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                    {accountManager?.photoUrl ? (
                      <img
                        src={accountManager.photoUrl}
                        alt={accountManager?.name || 'Account manager'}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: `2px solid ${colors.lightBlue}`,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: accountManager?.photoColor || colors.lightBlue,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 18,
                          border: `2px solid ${colors.lightBlue}`,
                          flexShrink: 0,
                        }}
                        aria-label={accountManager?.name || 'Account manager'}
                      >
                        {accountManager?.initials || 'PS'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: colors.gray900 }}>
                        {accountManager?.name || 'Your ProSource team'}
                      </div>
                      <div style={{ fontSize: 13, color: colors.gray500 }}>
                        {(accountManager?.title || 'Account Manager') + ' • ' + (showroom?.name || 'ProSource')}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14,
                    color: colors.gray700,
                    lineHeight: 1.6,
                    background: colors.gray100,
                    padding: 14,
                    borderRadius: 8,
                  }}>
                    {`"Hi ${userName || 'there'}! I'm your dedicated account manager${showroom?.name ? ` at ${showroom.name}` : ''}. I'm here to help you find products, get pricing, and make the most of your membership. Reach out anytime!"`}
                  </div>
                </div>

                {/* Quick Tips */}
                <div style={{ padding: '0 24px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray900, marginBottom: 12 }}>
                    Here's what you can do:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { icon: '🛒', text: 'Browse products with member pricing' },
                      { icon: '📋', text: 'Create estimates and place orders' },
                      { icon: '👥', text: 'Connect with clients and share projects' },
                      { icon: '📅', text: 'Schedule showroom appointments' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        <span style={{ fontSize: 13, color: colors.gray700 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Get Started Button */}
                <div style={{ padding: '0 24px 24px' }}>
                  <button
                    onClick={dismissWelcome}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      background: colors.darkBlue,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
            {/* Left Column - Quick Access */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Estimates & Orders Card */}
                <Link
                  to="/orders"
                  onMouseEnter={() => setHoveredCard('orders')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: hoveredCard === 'orders' ? colors.darkBlue : '#fff',
                    border: `1px solid ${hoveredCard === 'orders' ? colors.darkBlue : colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    transform: hoveredCard === 'orders' ? 'translateY(-2px)' : 'none',
                    boxShadow: hoveredCard === 'orders' ? '0 4px 12px rgba(0,48,135,0.2)' : 'none',
                  }}>
                  <FileText size={28} color={hoveredCard === 'orders' ? '#fff' : colors.darkBlue} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: hoveredCard === 'orders' ? '#fff' : colors.gray900 }}>Estimates & Orders</div>
                    <div style={{ fontSize: 13, color: hoveredCard === 'orders' ? 'rgba(255,255,255,0.8)' : colors.gray500, marginBottom: 12 }}>Track open orders and view history</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: hoveredCard === 'orders' ? '#fff' : colors.darkBlue }}>View orders →</span>
                  </div>
                </Link>

                {/* My Projects Card */}
                <Link
                  to="/projects"
                  onMouseEnter={() => setHoveredCard('projects')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: hoveredCard === 'projects' ? colors.darkBlue : '#fff',
                    border: `1px solid ${hoveredCard === 'projects' ? colors.darkBlue : colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    transform: hoveredCard === 'projects' ? 'translateY(-2px)' : 'none',
                    boxShadow: hoveredCard === 'projects' ? '0 4px 12px rgba(0,48,135,0.2)' : 'none',
                  }}
                >
                  <Lightbulb size={28} color={hoveredCard === 'projects' ? '#fff' : colors.darkBlue} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: hoveredCard === 'projects' ? '#fff' : colors.gray900 }}>My Projects</div>
                    <div style={{ fontSize: 13, color: hoveredCard === 'projects' ? 'rgba(255,255,255,0.8)' : colors.gray500, marginBottom: 12 }}>Track open projects and view history</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 13, color: hoveredCard === 'projects' ? '#fff' : colors.darkBlue, fontWeight: 500 }}>View projects →</span>
                    </div>
                  </div>
                </Link>

                {/* Connections Card */}
                <Link
                  to="/connections"
                  onMouseEnter={() => setHoveredCard('connections')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: hoveredCard === 'connections' ? colors.darkBlue : '#fff',
                    border: `1px solid ${hoveredCard === 'connections' ? colors.darkBlue : colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    transform: hoveredCard === 'connections' ? 'translateY(-2px)' : 'none',
                    boxShadow: hoveredCard === 'connections' ? '0 4px 12px rgba(0,48,135,0.2)' : 'none',
                  }}>
                  <Handshake size={28} color={hoveredCard === 'connections' ? '#fff' : colors.darkBlue} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: hoveredCard === 'connections' ? '#fff' : colors.gray900 }}>Connections</div>
                    <div style={{ fontSize: 13, color: hoveredCard === 'connections' ? 'rgba(255,255,255,0.8)' : colors.gray500, marginBottom: 12 }}>The people that make projects happen</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 13, color: hoveredCard === 'connections' ? '#fff' : colors.darkBlue, fontWeight: 500 }}>Add connection →</span>
                    </div>
                  </div>
                </Link>

                {/* Saved Carts Card */}
                <Link
                  to="/carts"
                  onMouseEnter={() => setHoveredCard('carts')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: hoveredCard === 'carts' ? colors.darkBlue : '#fff',
                    border: `1px solid ${hoveredCard === 'carts' ? colors.darkBlue : colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    transform: hoveredCard === 'carts' ? 'translateY(-2px)' : 'none',
                    boxShadow: hoveredCard === 'carts' ? '0 4px 12px rgba(0,48,135,0.2)' : 'none',
                  }}>
                  <ShoppingCart size={28} color={hoveredCard === 'carts' ? '#fff' : colors.darkBlue} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: hoveredCard === 'carts' ? '#fff' : colors.gray900 }}>Saved Carts</div>
                    <div style={{ fontSize: 13, color: hoveredCard === 'carts' ? 'rgba(255,255,255,0.8)' : colors.gray500, marginBottom: 12 }}>View and manage your saved carts</div>
                    <span style={{ fontSize: 13, color: hoveredCard === 'carts' ? '#fff' : colors.darkBlue, fontWeight: 500 }}>My Carts →</span>
                  </div>
                </Link>
              </div>

              {/* Activity Feed */}
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your Activity</h3>
                <div style={{
                  background: '#fff',
                  border: `1px solid ${colors.gray200}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  {activityItems.length === 0 ? (
                    <div style={{ padding: 24, fontSize: 14, color: colors.gray500, textAlign: 'center' }}>
                      No recent activity yet. Create a project or chat with your account manager to see updates here.
                    </div>
                  ) : (
                    activityItems.map((item, i, arr) => (
                      <div
                        key={i}
                        style={{
                          padding: 16,
                          borderBottom: i < arr.length - 1 ? `1px solid ${colors.gray100}` : 'none',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14, color: colors.gray900, marginBottom: 4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.45,
                          }}
                        >
                          {item.text} {item.target && <strong>{item.target}</strong>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>{formatActivityDate(item.ts)}</span>
                          <Link to={item.to} style={{ fontSize: 13, color: colors.darkBlue, fontWeight: 500, textDecoration: 'none' }}>{item.link}</Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Tips, Team & Leads */}
            <div>
              {/* Tips / Shop / Promos Carousel */}
              {(() => {
                const slides = [
                  {
                    title: 'Shop Products',
                    bg: '#e8f0fe',
                    icon: <Search size={32} color={colors.darkBlue} style={{ marginBottom: 12 }} />,
                    heading: 'Browse 50,000+ products',
                    sub: 'Member pricing on flooring, cabinets & countertops',
                    linkText: 'Shop Now →',
                    linkTo: '/shop',
                  },
                  {
                    title: 'Promos',
                    bg: '#fef3c7',
                    icon: <Tag size={32} color="#92400e" style={{ marginBottom: 12 }} />,
                    heading: 'Spring Flooring Event',
                    sub: 'Save up to 30% on select hardwood & LVP through April',
                    linkText: 'View Promos →',
                    linkTo: '/shop',
                  },
                  {
                    title: 'Tips & Resources',
                    bg: '#e3f2fd',
                    icon: <Home size={32} color={colors.darkBlue} style={{ marginBottom: 12 }} />,
                    heading: 'Create your first room visualization',
                    sub: 'Get to know your benefits',
                    linkText: 'Learn More →',
                    linkTo: null,
                  },
                ];
                const slide = slides[tipSlide];
                return (
                  <div style={{
                    background: '#fff',
                    border: `1px solid ${colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 24,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.gray900, margin: 0 }}>{slide.title}</h3>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setTipSlide((tipSlide + slides.length - 1) % slides.length)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            border: `1px solid ${colors.gray300}`, background: '#fff',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><ChevronLeft size={16} /></button>
                        <button
                          onClick={() => setTipSlide((tipSlide + 1) % slides.length)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            border: `1px solid ${colors.gray300}`, background: '#fff',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><ChevronRight size={16} /></button>
                      </div>
                    </div>
                    <div style={{ padding: 20, background: slide.bg, borderRadius: 8 }}>
                      {slide.icon}
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>{slide.heading}</div>
                      <div style={{ fontSize: 13, color: colors.gray500, marginBottom: 12 }}>{slide.sub}</div>
                      {slide.linkTo ? (
                        <Link to={slide.linkTo} style={{ fontSize: 13, color: colors.darkBlue, fontWeight: 500, textDecoration: 'none' }}>{slide.linkText}</Link>
                      ) : (
                        <a style={{ fontSize: 13, color: colors.darkBlue, fontWeight: 500, cursor: 'pointer' }}>{slide.linkText}</a>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                      {slides.map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setTipSlide(i)}
                          style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: i === tipSlide ? colors.darkBlue : colors.gray300,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Your ProSource Team */}
              <div style={{
                background: '#fff',
                border: `1px solid ${colors.gray200}`,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: colors.gray900 }}>Your ProSource Team</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&fit=crop&crop=face"
                      alt="Kim Marks"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${colors.lightBlue}`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>Kim Marks</div>
                      <div style={{ fontSize: 12, color: colors.gray500 }}>Account Manager • ProSource of St. Louis</div>
                    </div>
                    <ChatBubbleLink to="/messages?thread=kim" title="Message Kim Marks" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=96&h=96&fit=crop&crop=face"
                      alt="Heather Yager"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${colors.lightBlue}`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>Heather Yager</div>
                      <div style={{ fontSize: 12, color: colors.gray500 }}>Design Consultant • ProSource of St. Louis</div>
                    </div>
                    <ChatBubbleLink to="/messages?thread=heather" title="Message Heather Yager" />
                  </div>
                </div>
                <button
                  onClick={() => setAppointmentModalOpen(true)}
                  onMouseEnter={() => setAppointmentBtnHover(true)}
                  onMouseLeave={() => setAppointmentBtnHover(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: 16,
                    border: `1px solid ${colors.darkBlue}`,
                    borderRadius: 6,
                    background: appointmentBtnHover ? colors.darkBlue : '#fff',
                    color: appointmentBtnHover ? '#fff' : colors.darkBlue,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}>Make an Appointment</button>
              </div>

              {/* Upcoming Appointments (only when the user has booked) */}
              {upcomingAppointments.length > 0 && (
                <div style={{
                  background: '#fff',
                  border: `1px solid ${colors.gray200}`,
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 16,
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: colors.gray900 }}>
                    Upcoming Appointments
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {upcomingAppointments.slice(0, 3).map((appt) => (
                      <div key={appt.id} style={{
                        display: 'flex',
                        gap: 12,
                        padding: 12,
                        background: '#f8faff',
                        border: `1px solid #dbeafe`,
                        borderRadius: 8,
                      }}>
                        <div style={{
                          minWidth: 48,
                          textAlign: 'center',
                          padding: '4px 0',
                          background: colors.darkBlue,
                          color: '#fff',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          <div style={{ fontSize: 10, opacity: 0.9 }}>{appt.day}</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{(appt.date || '').replace(/^[A-Za-z]+ /, '')}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray900 }}>
                            {appt.time} with {appt.person}
                          </div>
                          <div style={{ fontSize: 12, color: colors.gray500, marginTop: 2 }}>
                            {appt.personRole} · {appt.showroom}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Your Team Members */}
              <div style={{
                background: '#fff',
                border: `1px solid ${colors.gray200}`,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.gray900, margin: 0 }}>Your Team Members</h3>
                  <Link
                    to="/settings?section=team"
                    style={{ fontSize: 13, color: colors.darkBlue, textDecoration: 'none', fontWeight: 500 }}
                  >
                    Manage →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: colors.gray200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.gray500,
                      fontWeight: 600,
                    }}>JD</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>John Doe</div>
                      <div style={{ fontSize: 12, color: colors.gray500 }}>Project Manager</div>
                    </div>
                    <ChatBubbleLink to="/messages?thread=john" title="Message John Doe" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: colors.gray200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.gray500,
                      fontWeight: 600,
                    }}>JS</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>Jane Smith</div>
                      <div style={{ fontSize: 12, color: colors.gray500 }}>Assistant</div>
                    </div>
                    <ChatBubbleLink to="/messages?thread=jane" title="Message Jane Smith" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MY PROJECTS SECTION */}
      {activeSection === 'projects' && (
        <div>
          {/* Search Bar + Create Button */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              placeholder="Search by client or project name..."
              className="flex-1 min-w-[200px]"
              style={styles.searchInput}
            />
            <button className="whitespace-nowrap shrink-0" style={{ ...styles.btnPrimary, background: colors.green }}>
              + New Project
            </button>
          </div>

          {/* Working Projects */}
          <div style={{ marginTop: 8 }}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Working Projects</h3>
              <Select
                value="recent"
                onChange={() => {}}
                options={[
                  { value: 'recent', label: 'Most Recent' },
                  { value: 'alpha', label: 'Alphabetical' },
                  { value: 'oldest', label: 'Oldest First' },
                ]}
                size="sm"
                className="min-w-[160px]"
              />
            </div>
            
            <div style={styles.projectsGrid}>
              {[
                { name: 'retrest', notifications: 3, updated: '12/18/2025', status: 'working' },
                { name: '2566', notifications: 3, updated: '11/20/2025', status: 'working' },
                { name: '2011', notifications: 3, updated: '11/20/2025', status: 'working' },
                { name: 'Bathroom Remodel - Cromwell', notifications: 5, updated: '10/30/2025', status: 'working' },
              ].map((project, i) => (
                <Link
                  to="/project"
                  key={i}
                  style={{ ...styles.projectCard, textDecoration: 'none', color: 'inherit' }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = colors.darkBlue;
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = colors.gray200;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.projectStatus(project.status)}>Working</div>
                  <div style={styles.projectName}>
                    {project.name}
                    {project.notifications > 0 && (
                      <span style={styles.projectBadge}>{project.notifications}</span>
                    )}
                  </div>
                  <div style={styles.projectMeta}>Project Owner: Suzie Q Snowflake</div>
                  <div style={styles.projectMeta}>Last Updated: {project.updated}</div>
                  <div style={styles.projectArrow}>›</div>
                </Link>
              ))}
            </div>
            
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button style={styles.btnOutline}>Load More Working Projects</button>
            </div>
          </div>

          {/* Completed Projects */}
          <div style={{ marginTop: 40 }}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Completed Projects</h3>
            </div>
            
            <div style={styles.projectsGrid}>
              {[
                { name: 'AL Test 2.11', updated: '8/16/2025', status: 'completed' },
                { name: 'AL Test 12/13', updated: '8/12/2025', status: 'completed' },
                { name: 'Test 20250729', updated: '7/29/2025', status: 'completed' },
                { name: 'AL Test 12/11', updated: '6/14/2025', status: 'completed' },
                { name: 'Add to Cart', updated: '6/7/2025', status: 'completed' },
              ].map((project, i) => (
                <Link
                  to="/project"
                  key={i}
                  style={{ ...styles.projectCard, textDecoration: 'none', color: 'inherit' }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = colors.darkBlue;
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = colors.gray200;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.projectStatus(project.status)}>Completed</div>
                  <div style={styles.projectName}>{project.name}</div>
                  <div style={styles.projectMeta}>Project Owner: Suzie Q Snowflake</div>
                  <div style={styles.projectMeta}>Last Updated: {project.updated}</div>
                  <div style={styles.projectArrow}>›</div>
                </Link>
              ))}
            </div>
            
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button style={styles.btnOutline}>Load More Completed Projects</button>
            </div>
          </div>

          {/* Published Projects */}
          <div style={{ marginTop: 40 }}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Published Projects</h3>
            </div>
            
            <div style={{
              padding: 48,
              textAlign: 'center',
              background: '#fff',
              borderRadius: 8,
              border: `1px solid ${colors.gray200}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Camera size={48} color={colors.gray400} /></div>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Published Projects Yet</h4>
              <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 20 }}>
                When you complete a job, publish photos and details to inspire and attract new clients.
              </p>
              <button style={styles.btnPrimary}>Publish Your First Project</button>
            </div>
          </div>
        </div>
      )}

      {/* REFERRAL BONUS SECTION */}
      {activeSection === 'referrals' && (
        <div>
          {/* Year-to-date Summary */}
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
            style={{ background: colors.darkBlue, borderRadius: 12, padding: 20, color: '#fff' }}
          >
            <div>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Calendar Year-to-Date</div>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>$615.88</div>
            </div>
            <div className="w-full sm:w-auto">
              <label style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, display: 'block' }}>Showroom</label>
              <Select
                value={referralShowroom}
                onChange={setReferralShowroom}
                options={[
                  { value: 'jackson', label: 'ProSource of Jackson, MS' },
                  { value: 'stlouis', label: 'ProSource of St. Louis' },
                ]}
                className="w-full sm:min-w-[220px]"
                fullWidth
              />
            </div>
          </div>

          <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 24 }}>
            This section shows your referral bonuses earned for client purchases. As a ProSource member, 
            you earn a referral bonus for purchases made by your clients.
          </p>

          {/* Yearly Breakdown */}
          {[
            {
              year: 2024,
              total: 615.88,
              months: [
                { month: 'January', amount: null, orders: [] },
                { month: 'February', amount: 87.84, orders: [
                  { order: 'EC099016', client: 'Bubba Beans', product: 'Shaw Endura Plus LVP', amount: 87.84 },
                ] },
                { month: 'March', amount: null, orders: [] },
                { month: 'April', amount: 87.84, orders: [
                  { order: 'EC099042', client: 'Sarah Chen', product: 'Mohawk RevWood Select', amount: 52.10 },
                  { order: 'EC099043', client: 'Martha Wilson', product: 'Daltile Keystones Tile', amount: 35.74 },
                ] },
                { month: 'May', amount: 87.84, orders: [
                  { order: 'EC099058', client: 'Bubba Beans', product: 'MSI Calacatta Laza Quartz', amount: 87.84 },
                ] },
                { month: 'June', amount: 87.84, orders: [
                  { order: 'EC099071', client: 'Martha Wilson', product: 'Shaw Floorte Pro LVP', amount: 87.84 },
                ] },
                { month: 'July', amount: 87.84, orders: [
                  { order: 'EC099085', client: 'Sarah Chen', product: 'Emser Tile Borigni', amount: 45.20 },
                  { order: 'EC099086', client: 'Bubba Beans', product: 'Shaw Bellera Carpet', amount: 42.64 },
                ] },
                { month: 'August', amount: null, orders: [] },
                { month: 'September', amount: 87.84, orders: [
                  { order: 'EC099102', client: 'Martha Wilson', product: 'Mohawk SolidTech LVP', amount: 87.84 },
                ] },
                { month: 'October', amount: null, orders: [] },
                { month: 'November', amount: null, orders: [] },
                { month: 'December', amount: 87.84, orders: [
                  { order: 'EC099130', client: 'Bubba Beans', product: 'Shaw Inspiring Design Carpet', amount: 87.84 },
                ] },
              ]
            },
            {
              year: 2023,
              total: 615.88,
              months: [
                { month: 'January', amount: null, orders: [] },
                { month: 'February', amount: 87.84, orders: [
                  { order: 'EC098901', client: 'Bubba Beans', product: 'Shaw Epic Hardwood', amount: 87.84 },
                ] },
                { month: 'March', amount: null, orders: [] },
                { month: 'April', amount: 87.84, orders: [
                  { order: 'EC098920', client: 'Sarah Chen', product: 'Daltile Perpetuo Tile', amount: 87.84 },
                ] },
                { month: 'May', amount: 87.84, orders: [
                  { order: 'EC098935', client: 'Martha Wilson', product: 'Mohawk UltraStrand Carpet', amount: 87.84 },
                ] },
                { month: 'June', amount: 87.84, orders: [
                  { order: 'EC098948', client: 'Bubba Beans', product: 'Shaw Floorte Plus LVP', amount: 87.84 },
                ] },
                { month: 'July', amount: 87.84, orders: [
                  { order: 'EC098960', client: 'Sarah Chen', product: 'MSI Premium Natural Quartz', amount: 87.84 },
                ] },
                { month: 'August', amount: null, orders: [] },
                { month: 'September', amount: 87.84, orders: [
                  { order: 'EC098980', client: 'Martha Wilson', product: 'Shaw Exquisite Hardwood', amount: 87.84 },
                ] },
                { month: 'October', amount: null, orders: [] },
                { month: 'November', amount: null, orders: [] },
                { month: 'December', amount: 87.84, orders: [
                  { order: 'EC098999', client: 'Bubba Beans', product: 'Mohawk RevWood Plus', amount: 87.84 },
                ] },
              ]
            },
            { year: 2022, total: 87.84, months: [] },
          ].map((yearData) => (
            <div
              key={yearData.year}
              style={{
                background: '#fff',
                border: `1px solid ${colors.gray200}`,
                borderRadius: 8,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              {/* Year Header */}
              <button
                onClick={() => {
                  setExpandedYear(expandedYear === yearData.year ? null : yearData.year);
                  setSelectedMonth(null);
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: expandedYear === yearData.year ? `1px solid ${colors.gray200}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: colors.gray900
                  }}>
                    {yearData.year}:
                  </span>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: colors.green
                  }}>
                    ${yearData.total.toFixed(2)}
                  </span>
                </div>
                <span style={{
                  color: colors.gray500,
                  transform: expandedYear === yearData.year ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                }}>
                  <ChevronDown size={20} />
                </span>
              </button>

              {/* Monthly Breakdown */}
              {expandedYear === yearData.year && yearData.months.length > 0 && (
                <div style={{ padding: '16px 20px' }}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {yearData.months.map((monthData, i) => {
                      const monthKey = `${yearData.year}-${i}`;
                      const isSelected = selectedMonth === monthKey;
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (monthData.amount) {
                              setSelectedMonth(isSelected ? null : monthKey);
                            }
                          }}
                          style={{
                            padding: 12,
                            background: isSelected ? colors.darkBlue : colors.gray100,
                            borderRadius: 6,
                            textAlign: 'center',
                            cursor: monthData.amount ? 'pointer' : 'default',
                            border: isSelected ? `2px solid ${colors.darkBlue}` : '2px solid transparent',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{
                            fontSize: 12,
                            color: isSelected ? 'rgba(255,255,255,0.8)' : colors.gray500,
                            marginBottom: 4
                          }}>
                            {monthData.month.slice(0, 3)}
                          </div>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: isSelected ? '#fff' : monthData.amount ? colors.green : colors.gray400,
                          }}>
                            {monthData.amount ? `$${monthData.amount.toFixed(2)}` : '--'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detail panel for selected month - renders outside the grid for proper full-width */}
                  {selectedMonth && selectedMonth.startsWith(`${yearData.year}-`) && (() => {
                    const monthIndex = parseInt(selectedMonth.split('-')[1]);
                    const monthData = yearData.months[monthIndex];
                    if (!monthData || !monthData.amount) return null;
                    return (
                      <div style={{
                        background: colors.gray100,
                        borderRadius: 8,
                        padding: 16,
                        marginTop: 12,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray900, marginBottom: 12 }}>
                          {monthData.month} {yearData.year} · {monthData.orders.length} order{monthData.orders.length !== 1 ? 's' : ''}
                        </div>
                        {monthData.orders.map((order, oi) => (
                          <Link
                            key={oi}
                            to={`/orders/${order.order}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              background: '#fff',
                              borderRadius: 6,
                              marginBottom: oi < monthData.orders.length - 1 ? 8 : 0,
                              textDecoration: 'none',
                              color: 'inherit',
                              border: `1px solid ${colors.gray200}`,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: colors.darkBlue }}>{order.order}</div>
                              <div style={{ fontSize: 12, color: colors.gray500 }}>{order.client} · {order.product}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: colors.green, flexShrink: 0, marginLeft: 12 }}>
                              +${order.amount.toFixed(2)}
                            </div>
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ACCOUNT SETTINGS SECTION */}
      {activeSection === 'account' && (
        <div>
          {/* Personal Information */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Personal Information</h3>
              {personalInfoSavedAt && !personalInfoDirty && (
                <span style={{ fontSize: 13, color: colors.green, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Saved
                </span>
              )}
            </div>
            <div style={{ ...styles.cardBody, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: colors.gray700, fontWeight: 500 }}>
                First name
                <input
                  type="text"
                  value={personalInfo.firstName}
                  onChange={(e) => updatePersonalInfo({ firstName: e.target.value })}
                  style={{ padding: '10px 12px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: colors.gray700, fontWeight: 500 }}>
                Last name
                <input
                  type="text"
                  value={personalInfo.lastName}
                  onChange={(e) => updatePersonalInfo({ lastName: e.target.value })}
                  style={{ padding: '10px 12px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: colors.gray700, fontWeight: 500 }}>
                Cell phone
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(e) => updatePersonalInfo({ phone: e.target.value })}
                  placeholder="(314) 555-0000"
                  style={{ padding: '10px 12px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: colors.gray700, fontWeight: 500 }}>
                Business name
                <input
                  type="text"
                  value={personalInfo.businessName}
                  onChange={(e) => updatePersonalInfo({ businessName: e.target.value })}
                  style={{ padding: '10px 12px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={savePersonalInfo}
                disabled={!personalInfoDirty || personalInfoSaving}
                style={{
                  padding: '10px 20px',
                  background: personalInfoDirty ? colors.darkBlue : colors.gray300,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: personalInfoDirty && !personalInfoSaving ? 'pointer' : 'not-allowed',
                  opacity: personalInfoSaving ? 0.7 : 1,
                }}
              >
                {personalInfoSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Login & Security */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Login & Security</h3>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Email Address</div>
                  <div style={styles.settingDesc}>{userEmail || 'No email on file'}</div>
                </div>
                <button style={{ ...styles.btnOutline, ...styles.btnSmall }}>Change</button>
              </div>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Password</div>
                  <div style={styles.settingDesc}>••••••••••••</div>
                </div>
                <button style={{ ...styles.btnOutline, ...styles.btnSmall }}>Update</button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Notification Preferences</h3>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Email Notifications</div>
                  <div style={styles.settingDesc}>Receive order status updates to your email address</div>
                </div>
                <button
                  onClick={() => setNotifyEmail(!notifyEmail)}
                  style={styles.toggle(notifyEmail)}
                >
                  <div style={styles.toggleKnob(notifyEmail)} />
                </button>
              </div>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>SMS Text Notifications</div>
                  <div style={styles.settingDesc}>Receive updates via text message (standard rates may apply)</div>
                </div>
                <button
                  onClick={() => setNotifySms(!notifySms)}
                  style={styles.toggle(notifySms)}
                >
                  <div style={styles.toggleKnob(notifySms)} />
                </button>
              </div>
            </div>
          </div>

          {/* Communication Frequency */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Communication Frequency</h3>
            </div>
            <div style={styles.cardBody}>
              <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 16 }}>
                How often would you like product updates sent to your email?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {['Daily', 'Weekly', 'Monthly'].map(freq => (
                  <button
                    key={freq}
                    onClick={() => setCommFrequency(freq)}
                    style={{
                      padding: '10px 24px',
                      border: `1px solid ${commFrequency === freq ? colors.darkBlue : colors.gray300}`,
                      borderRadius: 4,
                      background: commFrequency === freq ? colors.darkBlue : '#fff',
                      color: commFrequency === freq ? '#fff' : colors.gray700,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ProSource Leads */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>ProSource Leads</h3>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Receive Client Referrals</div>
                  <div style={styles.settingDesc}>
                    Get matched with potential clients who use ProSource. Your account manager will refer 
                    homeowners looking for trade professionals like you.
                  </div>
                </div>
                <button
                  onClick={() => setAcceptingLeads(!acceptingLeads)}
                  style={styles.toggle(acceptingLeads)}
                >
                  <div style={styles.toggleKnob(acceptingLeads)} />
                </button>
              </div>
              {acceptingLeads && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 16, 
                  background: '#e8f5e9', 
                  borderRadius: 6,
                  fontSize: 14,
                  color: colors.green,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Check size={18} /> You are currently accepting leads. Your account manager may contact you with potential client referrals.
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div style={styles.dangerZone}>
            <div style={styles.dangerTitle}>Deactivate Account</div>
            <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 16 }}>
              Permanently deactivate your account. This will hide your profile and stop all notifications.
            </p>
            <button style={styles.btnDanger}>Deactivate Account</button>
          </div>
        </div>
      )}

      {/* TEAM MANAGEMENT SECTION */}
      {activeSection === 'team' && (
        <div>
          {/* Success Notice */}
          {userSaved && (
            <div style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Check size={20} color={colors.green} />
              <div>
                <div style={{ fontWeight: 600, color: colors.green, marginBottom: 2 }}>Invitation Sent!</div>
                <div style={{ fontSize: 13, color: colors.gray700 }}>
                  An email has been sent to the new user with instructions to activate their account.
                </div>
              </div>
              <button
                onClick={() => setUserSaved(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500 }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Add User Button */}
          <div className="flex justify-stretch sm:justify-end mb-6">
            <button
              onClick={() => setAddUserModalOpen(true)}
              className="w-full sm:w-auto whitespace-nowrap"
              style={styles.btnPrimary}
            >
              + Add New User
            </button>
          </div>

          {/* Existing Users */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Existing Users</h3>
            </div>

            {(() => {
              const users = [
                { initials: 'JB', name: 'Jim Biggs', email: 'bigtimeremodeling@proton.me', access: 'view', accessLabel: 'View Only', status: 'active', statusLabel: 'Accepted' },
              ];
              return (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden">
                    {users.map((u, i) => (
                      <div
                        key={u.email}
                        className="p-4"
                        style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.gray200}` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: colors.lightBlue, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: 14, flexShrink: 0,
                          }}>{u.initials}</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate" style={{ color: colors.gray900 }}>{u.name}</div>
                            <div className="text-sm truncate" style={{ color: colors.gray500 }}>{u.email}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span style={styles.accessBadge(u.access)}>{u.accessLabel}</span>
                          <span style={styles.statusBadge(u.status)}>{u.statusLabel}</span>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 whitespace-nowrap" style={{ ...styles.btnOutline, ...styles.btnSmall, justifyContent: 'center' }}>Edit</button>
                          <button className="flex-1 whitespace-nowrap" style={{ ...styles.btnDanger, ...styles.btnSmall, justifyContent: 'center' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead style={styles.tableHeader}>
                        <tr>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Access Level</th>
                          <th style={styles.th}>Email</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.email}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: '50%',
                                  background: colors.lightBlue, color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 600, fontSize: 13,
                                }}>{u.initials}</div>
                                <span style={{ fontWeight: 500 }}>{u.name}</span>
                              </div>
                            </td>
                            <td style={styles.td}><span style={styles.accessBadge(u.access)}>{u.accessLabel}</span></td>
                            <td style={styles.td}>{u.email}</td>
                            <td style={styles.td}><span style={styles.statusBadge(u.status)}>{u.statusLabel}</span></td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{ ...styles.btnOutline, ...styles.btnSmall }}>Edit</button>
                                <button style={{ ...styles.btnDanger, ...styles.btnSmall }}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      </div> {/* End container */}

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={appointmentModalOpen}
        onClose={() => {
          setAppointmentModalOpen(false);
          setAppointmentsRefreshKey((k) => k + 1);
        }}
        isLoggedIn={true}
      />

      {/* Add User Modal */}
      {addUserModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: 520,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.gray200}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.gray900, margin: 0 }}>Add New User</h2>
              <button
                onClick={() => setAddUserModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500, padding: 4 }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 20 }}>
                Add team members to view orders and estimates. They'll receive an email to activate their account.
              </p>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>First Name</label>
                  <input
                    type="text"
                    placeholder="Enter first name"
                    style={styles.input}
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Last Name</label>
                  <input
                    type="text"
                    placeholder="Enter last name"
                    style={styles.input}
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    style={styles.input}
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    style={styles.input}
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Role</label>
                  <Select
                    value={newUser.role}
                    onChange={(v) => setNewUser({ ...newUser, role: v })}
                    placeholder="Select a role"
                    options={[
                      { value: 'accounting', label: 'Accounting' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'marketing', label: 'Marketing' },
                      { value: 'project_manager', label: 'Project Manager' },
                      { value: 'other', label: 'Other' },
                    ]}
                    fullWidth
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Level of Access</label>
                  <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="modalAccess"
                        checked={newUser.access === 'full'}
                        onChange={() => setNewUser({ ...newUser, access: 'full' })}
                      /> Full Access
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="modalAccess"
                        checked={newUser.access === 'view'}
                        onChange={() => setNewUser({ ...newUser, access: 'view' })}
                      /> View Only
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${colors.gray200}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}>
              <button
                onClick={() => setAddUserModalOpen(false)}
                style={styles.btnOutline}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAddUserModalOpen(false);
                  setUserSaved(true);
                  setNewUser({ firstName: '', lastName: '', email: '', phone: '', role: '', access: 'full' });
                }}
                style={styles.btnPrimary}
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
