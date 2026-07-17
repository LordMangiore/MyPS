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
  Search,
  Mail,
  AlertCircle
} from 'lucide-react';
import AppointmentModal from './prosource-appointment-modal';
import Select from './components/Select';
import { normalizeStored } from './project-model';

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

/**
 * What a profile that has never touched notification settings means.
 * Applied on read, so records written before `notificationPrefs` existed keep
 * working and simply adopt these until the user changes something.
 */
const DEFAULT_NOTIFICATION_PREFS = {
  email: true,
  sms: false,
  frequency: 'Weekly',
  acceptingLeads: true,
};

/** Project cards shown per status group before "Load More" adds another page. */
const PROJECT_PAGE_SIZE = 6;

/** Initials from a display name, for the avatar treatment used app-wide. */
const initialsFor = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || '?';

// Small icon-button used next to team members to open a direct-message thread.
// Has its own hover state so the instances across the dashboard stay in sync.
//
// `to` may be a router path or a mailto: URL. Only a real connection can be
// messaged in-app (`/messages?connection=<id>`), so people we know by name but
// hold no connection record for get a mailto instead of a chat bubble that
// dead-ends. Both destinations are real; the icon says which one you're getting.
function ContactLink({ to, title, icon: Icon = MessageCircle }) {
  const [hovered, setHovered] = useState(false);
  const style = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: `1px solid ${hovered ? colors.darkBlue : colors.gray200}`,
    background: hovered ? '#f0f5ff' : '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  };
  const inner = <Icon size={16} color={hovered ? colors.darkBlue : colors.gray500} />;
  const handlers = {
    title,
    'aria-label': title,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style,
  };
  if (String(to).startsWith('mailto:')) {
    return <a href={to} {...handlers}>{inner}</a>;
  }
  return <Link to={to} {...handlers}>{inner}</Link>;
}

/** Round-avatar with initials. The photo-free treatment used across the app. */
function Avatar({ name, initials, color, size = 48 }) {
  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || colors.lightBlue,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: Math.round(size / 3.2),
        border: `2px solid ${colors.lightBlue}`,
        flexShrink: 0,
      }}
    >
      {initials || initialsFor(name)}
    </div>
  );
}

/**
 * Referral bonuses: DEMO DATA, and that is the end of the story.
 *
 * There is no referral feed to read from and there is never going to be one, so
 * these are literals keyed by the real showroom ids the account carries
 * (`showrooms[n].id` from useAuth). A showroom with no entry here renders an
 * honest empty state rather than borrowing another showroom's numbers.
 *
 * St. Louis is the established showroom; Chicago opened later, so it earns less
 * and its history starts in 2023. Switching showrooms has to visibly move the
 * numbers, otherwise the selector is decoration.
 *
 * The "All Showrooms" total is NOT a literal: see `sumShowroomYears`.
 */
const REFERRAL_DEMO_DATA = {
  'st-louis': [
    {
      year: 2024,
      months: [
        { month: 'January', orders: [] },
        { month: 'February', orders: [
          { order: 'EC099016', client: 'Bubba Beans', product: 'Shaw Endura Plus LVP', amount: 87.84 },
        ] },
        { month: 'March', orders: [] },
        { month: 'April', orders: [
          { order: 'EC099042', client: 'Sarah Chen', product: 'Mohawk RevWood Select', amount: 52.10 },
          { order: 'EC099043', client: 'Martha Wilson', product: 'Daltile Keystones Tile', amount: 35.74 },
        ] },
        { month: 'May', orders: [
          { order: 'EC099058', client: 'Bubba Beans', product: 'MSI Calacatta Laza Quartz', amount: 87.84 },
        ] },
        { month: 'June', orders: [
          { order: 'EC099071', client: 'Martha Wilson', product: 'Shaw Floorte Pro LVP', amount: 87.84 },
        ] },
        { month: 'July', orders: [
          { order: 'EC099085', client: 'Sarah Chen', product: 'Emser Tile Borigni', amount: 45.20 },
          { order: 'EC099086', client: 'Bubba Beans', product: 'Shaw Bellera Carpet', amount: 42.64 },
        ] },
        { month: 'August', orders: [] },
        { month: 'September', orders: [
          { order: 'EC099102', client: 'Martha Wilson', product: 'Mohawk SolidTech LVP', amount: 87.84 },
        ] },
        { month: 'October', orders: [] },
        { month: 'November', orders: [] },
        { month: 'December', orders: [
          { order: 'EC099130', client: 'Bubba Beans', product: 'Shaw Inspiring Design Carpet', amount: 87.84 },
        ] },
      ],
    },
    {
      year: 2023,
      months: [
        { month: 'January', orders: [] },
        { month: 'February', orders: [
          { order: 'EC098901', client: 'Bubba Beans', product: 'Shaw Epic Hardwood', amount: 87.84 },
        ] },
        { month: 'March', orders: [] },
        { month: 'April', orders: [
          { order: 'EC098920', client: 'Sarah Chen', product: 'Daltile Perpetuo Tile', amount: 87.84 },
        ] },
        { month: 'May', orders: [
          { order: 'EC098935', client: 'Martha Wilson', product: 'Mohawk UltraStrand Carpet', amount: 87.84 },
        ] },
        { month: 'June', orders: [
          { order: 'EC098948', client: 'Bubba Beans', product: 'Shaw Floorte Plus LVP', amount: 87.84 },
        ] },
        { month: 'July', orders: [
          { order: 'EC098960', client: 'Sarah Chen', product: 'MSI Premium Natural Quartz', amount: 87.84 },
        ] },
        { month: 'August', orders: [] },
        { month: 'September', orders: [
          { order: 'EC098980', client: 'Martha Wilson', product: 'Shaw Exquisite Hardwood', amount: 87.84 },
        ] },
        { month: 'October', orders: [] },
        { month: 'November', orders: [] },
        { month: 'December', orders: [
          { order: 'EC098999', client: 'Bubba Beans', product: 'Mohawk RevWood Plus', amount: 87.84 },
        ] },
      ],
    },
    {
      year: 2022,
      months: [
        { month: 'January', orders: [] },
        { month: 'February', orders: [] },
        { month: 'March', orders: [] },
        { month: 'April', orders: [] },
        { month: 'May', orders: [] },
        { month: 'June', orders: [] },
        { month: 'July', orders: [] },
        { month: 'August', orders: [] },
        { month: 'September', orders: [] },
        { month: 'October', orders: [] },
        { month: 'November', orders: [
          { order: 'EC098712', client: 'Bubba Beans', product: 'Shaw Anso Nylon Carpet', amount: 87.84 },
        ] },
        { month: 'December', orders: [] },
      ],
    },
  ],
  // Newer showroom: fewer clients, smaller bonuses, nothing before 2023.
  chicago: [
    {
      year: 2024,
      months: [
        { month: 'January', orders: [] },
        { month: 'February', orders: [] },
        { month: 'March', orders: [
          { order: 'CH041022', client: 'Dana Whitfield', product: 'Mohawk RevWood Premier', amount: 31.15 },
        ] },
        { month: 'April', orders: [] },
        { month: 'May', orders: [
          { order: 'CH041050', client: 'Priya Raman', product: 'Daltile Volume 1.0 Tile', amount: 24.60 },
        ] },
        { month: 'June', orders: [] },
        { month: 'July', orders: [] },
        { month: 'August', orders: [
          { order: 'CH041088', client: 'Dana Whitfield', product: 'COREtec Pro Plus LVP', amount: 44.30 },
        ] },
        { month: 'September', orders: [] },
        { month: 'October', orders: [
          { order: 'CH041119', client: 'Marcus Vaughn', product: 'MSI Ostrich Grey Quartz', amount: 18.90 },
        ] },
        { month: 'November', orders: [] },
        { month: 'December', orders: [] },
      ],
    },
    {
      year: 2023,
      months: [
        { month: 'January', orders: [] },
        { month: 'February', orders: [] },
        { month: 'March', orders: [] },
        { month: 'April', orders: [] },
        { month: 'May', orders: [] },
        { month: 'June', orders: [] },
        { month: 'July', orders: [] },
        { month: 'August', orders: [] },
        { month: 'September', orders: [
          { order: 'CH040902', client: 'Priya Raman', product: 'Shaw Floorte Classic LVP', amount: 22.40 },
        ] },
        { month: 'October', orders: [] },
        { month: 'November', orders: [
          { order: 'CH040931', client: 'Marcus Vaughn', product: 'Emser Tile Cascade', amount: 16.75 },
        ] },
        { month: 'December', orders: [] },
      ],
    },
  ],
};

/** Cents-safe money add: these are dollar literals, so keep the rounding honest. */
const addMoney = (a, b) => Math.round((a + b) * 100) / 100;

/** A month's bonus is the sum of its orders. Never a separate literal that could disagree. */
const monthTotal = (m) => (m.orders || []).reduce((sum, o) => addMoney(sum, o.amount || 0), 0);

/** A year's bonus is the sum of its months. Same reason. */
const yearTotal = (y) => (y.months || []).reduce((sum, m) => addMoney(sum, monthTotal(m)), 0);

/**
 * "All Showrooms" = the per-showroom datasets summed, never its own literal.
 *
 * A hardcoded grand total drifts out of sync with its rows the moment anyone
 * edits one showroom's numbers, and then the demo shows a total that doesn't
 * equal the parts. Summing means it cannot disagree by construction.
 *
 * Merges by period: a year (or month) present for one showroom and absent for
 * another counts the missing side as zero rather than dropping the row, so
 * Chicago having no 2022 doesn't erase St. Louis's 2022. Orders are tagged with
 * the showroom they came from so the detail panel can say where each one landed.
 */
const sumShowroomYears = (datasets) => {
  const byYear = new Map();
  datasets.forEach(({ showroomName, years }) => {
    (years || []).forEach((y) => {
      if (!byYear.has(y.year)) byYear.set(y.year, new Map());
      const monthMap = byYear.get(y.year);
      (y.months || []).forEach((m) => {
        const prior = monthMap.get(m.month) || [];
        monthMap.set(
          m.month,
          prior.concat((m.orders || []).map((o) => ({ ...o, showroomName })))
        );
      });
    });
  });
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthMap]) => ({
      year,
      months: [...monthMap.entries()].map(([month, orders]) => ({ month, orders })),
    }));
};

// This component is designed to work INSIDE the existing ProSource dashboard layout
// It replaces the content in .col-dashboard-content while keeping the existing header and sidebar
export default function ProSourceSettingsRedesign() {
  const {
    isNewUser,
    userName,
    showroom,
    showrooms,
    accountManager,
    userId,
    userEmail,
    profile,
    saveProfile,
    loadUserData,
    saveUserData,
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
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [messageThreads, setMessageThreads] = useState([]);
  const [connections, setConnections] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [appointmentsRefreshKey, setAppointmentsRefreshKey] = useState(0);


  // Pull the user's projects + message threads + appointments + connections +
  // account users so the dashboard activity feed, project list, and both team
  // panels reflect real data instead of literals.
  useEffect(() => {
    // No userId means nothing to fetch, so nothing is "still loading" either.
    if (!userId) {
      setProjectsLoading(false);
      setTeamLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      loadUserData('projects', null),
      loadUserData('messages', null),
      loadUserData('appointments', null),
      loadUserData('connections', null),
      loadUserData('team', null),
    ]).then(([p, m, a, c, t]) => {
      if (cancelled) return;
      // Same normalizer the projects pages use, so a legacy blob renders here
      // exactly as it renders there (and rooms/products keep migrating on read).
      setProjectsList(normalizeStored(p));
      setProjectsLoading(false);
      setMessageThreads(Array.isArray(m?.threads) ? m.threads : []);
      setConnections(Array.isArray(c?.list) ? c.list : []);
      setTeamUsers(Array.isArray(t?.list) ? t.list : []);
      setTeamLoading(false);
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
  /**
   * Notification preferences.
   *
   * These used to be plain useState with no backend field at all, so every
   * toggle was forgotten on refresh. They now live on the profile blob under
   * `notificationPrefs` and flush through saveProfile, which shallow-merges, so
   * a profile written before this field existed simply falls back to DEFAULTS
   * and starts persisting the moment anything is touched. No reset, no
   * migration.
   */
  const [prefs, setPrefs] = useState(() => ({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(profile?.notificationPrefs || {}),
  }));
  // The profile arrives from cache at mount or from the network a moment later.
  // Hydrate from it exactly once: after that the user's edits own this state and
  // a late-arriving profile must not stomp them.
  const [prefsHydrated, setPrefsHydrated] = useState(!!profile);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSavedAt, setPrefsSavedAt] = useState(null);
  const [prefsError, setPrefsError] = useState('');

  useEffect(() => {
    if (!profile || prefsHydrated) return;
    setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(profile.notificationPrefs || {}) });
    setPrefsHydrated(true);
  }, [profile, prefsHydrated]);

  /**
   * Apply a preference change optimistically, then persist it.
   *
   * On failure the control snaps BACK to what is actually stored and says why.
   * A toggle that stays where you put it while the save failed is a lie, and
   * that lie survives until the next reload silently undoes it.
   */
  const savePrefs = async (patch) => {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setPrefsError('');
    setPrefsSaving(true);
    try {
      await saveProfile({ notificationPrefs: { ...previous, ...patch } });
      setPrefsSavedAt(Date.now());
    } catch (err) {
      setPrefs(previous);
      setPrefsSavedAt(null);
      setPrefsError(err.message || 'Could not save. Your preference was not changed.');
    } finally {
      setPrefsSaving(false);
    }
  };

  // 'auto' means "the most recent year in whatever dataset is showing", which
  // stays right when the showroom selector changes the years on offer. An
  // explicit year (or null for all-collapsed) takes over once the user clicks.
  /**
   * One status line, shown in the header of every card these preferences live
   * in. A failed save has to be visible: the whole point of this work package
   * is that these settings used to lie about being kept.
   */
  const prefsStatus = prefsSaving ? (
    <span style={{ fontSize: 13, color: colors.gray500 }}>Saving…</span>
  ) : prefsError ? (
    <span style={{ fontSize: 13, color: colors.red, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <AlertCircle size={14} /> {prefsError}
    </span>
  ) : prefsSavedAt ? (
    <span style={{ fontSize: 13, color: colors.green, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Check size={14} /> Saved
    </span>
  ) : null;

  const [expandedYear, setExpandedYear] = useState('auto');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentBtnHover, setAppointmentBtnHover] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState('');
  // What the invite ACTUALLY did, straight from the server. Never assumed.
  const [inviteResult, setInviteResult] = useState(null);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    access: 'full'
  });

  /**
   * "Your ProSource Team": the account managers of every showroom the account
   * works with, plus any ProSource staff in the connections list.
   *
   * Merged by name because Kim is both the St. Louis account manager (from the
   * showroom record) and connection #1: one person, one row, and the connection
   * id is what makes her row messageable. An account manager with no connection
   * record still shows, because a showroom always has one whether or not anyone
   * has connected to them yet.
   */
  const prosourceTeam = useMemo(() => {
    const byName = new Map();
    const add = (person) => {
      if (!person?.name) return;
      const merged = { ...(byName.get(person.name) || {}) };
      // Only defined values overwrite, so a connection record without a
      // photoColor doesn't wipe the account manager's, and a null connectionId
      // doesn't wipe a real one.
      Object.entries(person).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') merged[k] = v;
      });
      byName.set(person.name, merged);
    };

    // `showrooms` is primary-first, so the primary showroom's manager leads.
    (showrooms || []).forEach((s) => {
      const am = s?.accountManager;
      if (!am?.name) return;
      add({
        name: am.name,
        role: am.title || 'Account Manager',
        location: s.name,
        initials: am.initials,
        photoColor: am.photoColor,
        email: am.email,
      });
    });

    connections
      .filter((c) => c.type === 'prosource')
      .forEach((c) => {
        add({
          name: c.name,
          role: c.role,
          location: c.location,
          initials: c.initials,
          email: c.email,
          connectionId: c.id,
        });
      });

    return [...byName.values()];
  }, [showrooms, connections]);

  /**
   * "Your Team Members": the real people you work with, i.e. every connection
   * who is not ProSource staff (they have their own panel above). Every row
   * here holds a connection id, so every chat bubble resolves.
   */
  const teamMemberConnections = useMemo(
    () => connections.filter((c) => c.type && c.type !== 'prosource'),
    [connections]
  );

  // ---- My Projects -------------------------------------------------------
  const [projectQuery, setProjectQuery] = useState('');
  const [projectSort, setProjectSort] = useState('recent');
  // How many cards each status group is currently showing. "Load More" raises
  // the number for one group; it used to be a button that did nothing at all.
  const [visibleCounts, setVisibleCounts] = useState({});
  const visibleCount = (key) => visibleCounts[key] || PROJECT_PAGE_SIZE;

  const projectGroups = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    let list = projectsList.filter((p) => !p.archived);
    if (q) {
      // "Search by client or project name": the client is whoever is on the
      // project team, so search their names too rather than only the title.
      list = list.filter((p) =>
        [p.name, p.type, p.address, ...(p.team || []).map((m) => m.name)].some((field) =>
          String(field || '').toLowerCase().includes(q)
        )
      );
    }
    const sorted = [...list].sort((a, b) => {
      if (projectSort === 'alpha') return (a.name || '').localeCompare(b.name || '');
      if (projectSort === 'oldest') return (a.updatedAt || 0) - (b.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    const groups = { working: [], complete: [], published: [] };
    sorted.forEach((p) => {
      const key = groups[p.status] ? p.status : 'working';
      groups[key].push(p);
    });
    return groups;
  }, [projectsList, projectQuery, projectSort]);

  /** The client on a project is a real team member, not a placeholder name. */
  const projectClient = (p) =>
    (p.team || []).find((m) => m.type === 'client')?.name || null;

  const formatShortDate = (ts) => {
    if (!ts) return 'Not yet';
    try {
      return new Date(ts).toLocaleDateString('en-US');
    } catch {
      return 'Not yet';
    }
  };

  // ---- Referral bonus (demo data, see REFERRAL_DEMO_DATA) -----------------
  const referralOptions = useMemo(() => {
    const perShowroom = (showrooms || []).map((s) => ({ value: s.id, label: s.name }));
    // "All Showrooms" is only a real choice when there is more than one
    // showroom. With one it IS that showroom, so offering it is just noise.
    return perShowroom.length > 1
      ? [{ value: 'all', label: 'All Showrooms' }, ...perShowroom]
      : perShowroom;
  }, [showrooms]);

  const [referralShowroom, setReferralShowroom] = useState(null);
  // Default to the widest honest view. `showrooms` arrives with the profile, so
  // this also repairs a selection that no longer exists on the account.
  useEffect(() => {
    if (referralShowroom && referralOptions.some((o) => o.value === referralShowroom)) return;
    setReferralShowroom(referralOptions[0]?.value ?? null);
  }, [referralOptions, referralShowroom]);

  const referralYears = useMemo(() => {
    if (!referralShowroom) return [];
    if (referralShowroom === 'all') {
      return sumShowroomYears(
        (showrooms || []).map((s) => ({
          showroomName: s.name,
          years: REFERRAL_DEMO_DATA[s.id] || [],
        }))
      );
    }
    return REFERRAL_DEMO_DATA[referralShowroom] || [];
  }, [referralShowroom, showrooms]);

  // Newest year first everywhere, so [0] is the year-to-date year.
  const referralYtdYear = referralYears[0] || null;
  const openYear = expandedYear === 'auto' ? referralYtdYear?.year ?? null : expandedYear;

  // ---- Manage Users ------------------------------------------------------
  /** Write the account's user list to the `team` blob and mirror it locally. */
  const persistTeam = async (next) => {
    await saveUserData('team', { list: next });
    setTeamUsers(next);
  };

  const resetUserModal = () => {
    setAddUserModalOpen(false);
    setEditingUserId(null);
    setTeamError('');
    setNewUser({ firstName: '', lastName: '', email: '', phone: '', role: '', access: 'full' });
  };

  const openEditUser = (user) => {
    setEditingUserId(user.id);
    setTeamError('');
    setNewUser({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || '',
      access: user.access || 'full',
    });
    setAddUserModalOpen(true);
  };

  /**
   * Save the Add/Edit User modal.
   *
   * Adding sends an invitation; editing an existing user does not, because
   * changing someone's access level is not a reason to email them again.
   *
   * The invite goes through /api/send-invite, which records the invite in the
   * ps-invites store and reports whether an email actually went out. We show
   * exactly what it reports: an "Invitation Sent!" banner over a send that
   * didn't happen is the bug this replaces.
   */
  const saveUser = async () => {
    const email = newUser.email.trim();
    const firstName = newUser.firstName.trim();
    if (!firstName) {
      setTeamError('First name is required.');
      return;
    }
    if (!email.includes('@')) {
      setTeamError('A valid email address is required.');
      return;
    }
    const duplicate = teamUsers.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase() && u.id !== editingUserId
    );
    if (duplicate) {
      setTeamError('That email is already on your account.');
      return;
    }

    setTeamBusy(true);
    setTeamError('');
    try {
      const name = [firstName, newUser.lastName.trim()].filter(Boolean).join(' ');

      if (editingUserId) {
        const next = teamUsers.map((u) =>
          u.id === editingUserId
            ? {
                ...u,
                firstName,
                lastName: newUser.lastName.trim(),
                name,
                initials: initialsFor(name),
                email,
                phone: newUser.phone.trim(),
                role: newUser.role,
                access: newUser.access,
                updatedAt: Date.now(),
              }
            : u
        );
        await persistTeam(next);
        setInviteResult(null);
        resetUserModal();
        return;
      }

      // Ask the server to record the invite and (if email is configured) send
      // it, then report back what it actually managed to do.
      let result;
      try {
        const res = await fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: email,
            fromName: userName || 'A ProSource member',
            fromUserId: userId || null,
            fromBusinessName: profile?.business?.name || '',
            message: `You have been added to our ProSource account with ${
              newUser.access === 'full' ? 'full' : 'view only'
            } access.`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        result = res.ok
          ? data
          : { emailSent: false, reason: 'send-failed', error: data.error || `HTTP ${res.status}` };
      } catch (err) {
        result = { emailSent: false, reason: 'request-failed', error: err.message };
      }

      const user = {
        id: `user-${Date.now()}`,
        firstName,
        lastName: newUser.lastName.trim(),
        name,
        initials: initialsFor(name),
        email,
        phone: newUser.phone.trim(),
        role: newUser.role,
        access: newUser.access,
        // 'invited' until they actually sign in. Nothing here can make that
        // happen, so nothing here gets to call them 'active'.
        status: 'invited',
        inviteEmailSent: Boolean(result.emailSent),
        inviteToken: result.token || null,
        invitedAt: Date.now(),
      };
      await persistTeam([...teamUsers, user]);
      setInviteResult(result);
      resetUserModal();
    } catch (err) {
      setTeamError(err.message || 'Could not save this user.');
    } finally {
      setTeamBusy(false);
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Remove ${user.name || user.email} from your account?`)) return;
    setTeamBusy(true);
    setTeamError('');
    try {
      await persistTeam(teamUsers.filter((u) => u.id !== user.id));
    } catch (err) {
      setTeamError(err.message || 'Could not remove this user.');
    } finally {
      setTeamBusy(false);
    }
  };

  const ACCESS_LABEL = { full: 'Full Access', view: 'View Only' };
  const STATUS_LABEL = { active: 'Accepted', invited: 'Invited' };

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
                    // Was "Create your first room visualization" pointing at
                    // nothing, because there is no visualizer to point at.
                    // Rooms are real project entities, so this now promises the
                    // thing the app can actually do and links to where it happens.
                    title: 'Tips & Resources',
                    bg: '#e3f2fd',
                    icon: <Home size={32} color={colors.darkBlue} style={{ marginBottom: 12 }} />,
                    heading: 'Set up your first project',
                    sub: 'Add rooms, invite your client, and keep selections in one place',
                    linkText: 'Start a Project →',
                    linkTo: '/projects/new',
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
                      {/* Every slide links somewhere real. The old `linkTo: null`
                          fallback rendered a bare <a> that looked like a link and
                          did nothing, so it is gone rather than left waiting to
                          catch the next slide someone adds without a destination. */}
                      <Link to={slide.linkTo} style={{ fontSize: 13, color: colors.darkBlue, fontWeight: 500, textDecoration: 'none' }}>{slide.linkText}</Link>
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
                  {prosourceTeam.length === 0 && (
                    <div style={{ fontSize: 13, color: colors.gray500 }}>
                      Your showroom team will appear here once your account is matched to a showroom.
                    </div>
                  )}
                  {prosourceTeam.map((person) => (
                    <div key={person.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={person.name} initials={person.initials} color={person.photoColor} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{person.name}</div>
                        <div style={{ fontSize: 12, color: colors.gray500 }}>
                          {[person.role, person.location].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      {/* Messageable only with a real connection id. Otherwise
                          their real email, rather than a bubble to nowhere. */}
                      {person.connectionId != null ? (
                        <ContactLink
                          to={`/messages?connection=${person.connectionId}`}
                          title={`Message ${person.name}`}
                        />
                      ) : person.email ? (
                        <ContactLink
                          to={`mailto:${person.email}`}
                          title={`Email ${person.name}`}
                          icon={Mail}
                        />
                      ) : null}
                    </div>
                  ))}
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray900, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{appt.time} with {appt.person}</span>
                            {/* A requested time is not an agreed one, and this
                                card is the screen the member lands on straight
                                after asking for it. Without the pill the ask and
                                the confirmed seeded appointment render
                                identically, so the booking modal's "nothing is
                                booked until they confirm" would be contradicted
                                by the very next thing the member sees. */}
                            {appt.status === 'requested' && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                color: '#92400e', background: '#fef3c7',
                                padding: '2px 6px', borderRadius: 3,
                              }}>Requested</span>
                            )}
                            {appt.status === 'confirmed' && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                color: colors.green, background: '#dcfce7',
                                padding: '2px 6px', borderRadius: 3,
                              }}>Confirmed</span>
                            )}
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
                  {/* Points at /connections, which is what this panel now lists.
                      It used to point at Manage Users, a different dataset
                      entirely (people with a login on your account). That page
                      is still one click away in the account menu. */}
                  <Link
                    to="/connections"
                    style={{ fontSize: 13, color: colors.darkBlue, textDecoration: 'none', fontWeight: 500 }}
                  >
                    Manage →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {teamMemberConnections.length === 0 && (
                    <div style={{ fontSize: 13, color: colors.gray500 }}>
                      No connections yet.{' '}
                      <Link to="/connections" style={{ color: colors.darkBlue, fontWeight: 500 }}>
                        Add the clients and trade pros you work with
                      </Link>
                      {' '}and they will show up here.
                    </div>
                  )}
                  {teamMemberConnections.slice(0, 4).map((person) => (
                    <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar
                        name={person.name}
                        initials={person.initials}
                        color={person.type === 'client' ? colors.darkBlue : colors.green}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{person.name}</div>
                        <div style={{ fontSize: 12, color: colors.gray500 }}>
                          {[person.role, person.location].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      {/* ?connection=<id> is the form that actually resolves. */}
                      <ContactLink
                        to={`/messages?connection=${person.id}`}
                        title={`Message ${person.name}`}
                      />
                    </div>
                  ))}
                  {teamMemberConnections.length > 4 && (
                    <Link
                      to="/connections"
                      style={{ fontSize: 13, color: colors.darkBlue, textDecoration: 'none', fontWeight: 500 }}
                    >
                      View all {teamMemberConnections.length} connections →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MY PROJECTS SECTION */}
      {activeSection === 'projects' && (
        <div>
          {/* Search Bar + Create Button. The search filters every group below;
              "+ New Project" goes to the real create wizard. */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              placeholder="Search by client or project name..."
              className="flex-1 min-w-[200px]"
              style={styles.searchInput}
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
            />
            <Link
              to="/projects/new"
              className="whitespace-nowrap shrink-0"
              style={{ ...styles.btnPrimary, background: colors.green, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              + New Project
            </Link>
          </div>

          {projectsLoading ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 14, color: colors.gray500 }}>
              Loading your projects…
            </div>
          ) : (
            <>
              {/* One renderer for all three status groups: they only ever
                  differed by which literals they held. */}
              {[
                { key: 'working', title: 'Working Projects', sortable: true },
                { key: 'complete', title: 'Completed Projects', sortable: false },
                { key: 'published', title: 'Published Projects', sortable: false },
              ].map(({ key, title, sortable }, groupIndex) => {
                const all = projectGroups[key];
                const shown = all.slice(0, visibleCount(key));
                return (
                  <div key={key} style={{ marginTop: groupIndex === 0 ? 8 : 40 }}>
                    <div style={styles.sectionHeader}>
                      <h3 style={styles.sectionTitle}>{title}</h3>
                      {sortable && (
                        <Select
                          value={projectSort}
                          onChange={setProjectSort}
                          options={[
                            { value: 'recent', label: 'Most Recent' },
                            { value: 'alpha', label: 'Alphabetical' },
                            { value: 'oldest', label: 'Oldest First' },
                          ]}
                          size="sm"
                          className="min-w-[160px]"
                        />
                      )}
                    </div>

                    {all.length === 0 ? (
                      <div style={{
                        padding: 48,
                        textAlign: 'center',
                        background: '#fff',
                        borderRadius: 8,
                        border: `1px solid ${colors.gray200}`,
                      }}>
                        {projectQuery.trim() ? (
                          <p style={{ fontSize: 14, color: colors.gray500, margin: 0 }}>
                            No {title.toLowerCase()} match "{projectQuery.trim()}".
                          </p>
                        ) : key === 'published' ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                              <Camera size={48} color={colors.gray300} />
                            </div>
                            <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Published Projects Yet</h4>
                            <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 20 }}>
                              When you complete a job, publish photos and details to inspire and attract new clients.
                            </p>
                            {/* Publishing happens on a project, so this goes to
                                the project list rather than being a button that
                                publishes nothing. */}
                            <Link to="/projects" style={{ ...styles.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
                              Go to My Projects
                            </Link>
                          </>
                        ) : (
                          <p style={{ fontSize: 14, color: colors.gray500, margin: 0 }}>
                            Nothing here yet.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={styles.projectsGrid}>
                        {shown.map((project) => {
                          const client = projectClient(project);
                          return (
                            <Link
                              to={`/projects/${project.id}`}
                              key={project.id}
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
                              <div style={styles.projectStatus(key === 'complete' ? 'completed' : key)}>
                                {key === 'complete' ? 'Completed' : key === 'published' ? 'Published' : 'Working'}
                              </div>
                              <div style={styles.projectName}>{project.name || 'Untitled project'}</div>
                              {project.type && (
                                <div style={styles.projectMeta}>{project.type}</div>
                              )}
                              {client && (
                                <div style={styles.projectMeta}>Client: {client}</div>
                              )}
                              <div style={styles.projectMeta}>
                                Last Updated: {formatShortDate(project.updatedAt)}
                              </div>
                              <div style={styles.projectArrow}>›</div>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* Only offered when there is genuinely more to load. */}
                    {all.length > shown.length && (
                      <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <button
                          style={styles.btnOutline}
                          onClick={() =>
                            setVisibleCounts((prev) => ({
                              ...prev,
                              [key]: visibleCount(key) + PROJECT_PAGE_SIZE,
                            }))
                          }
                        >
                          Load More {title} ({all.length - shown.length} more)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
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
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
                {referralYtdYear ? `${referralYtdYear.year} Year-to-Date` : 'Calendar Year-to-Date'}
                {referralShowroom === 'all' ? ' · All Showrooms' : ''}
              </div>
              {/* Summed from the rows below, never a literal of its own, so it
                  cannot disagree with them. */}
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
                ${(referralYtdYear ? yearTotal(referralYtdYear) : 0).toFixed(2)}
              </div>
            </div>
            {/* Only a choice when there is something to choose between: one
                showroom means one dataset, so the selector is hidden. */}
            {referralOptions.length > 1 && (
              <div className="w-full sm:w-auto">
                <label style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, display: 'block' }}>Showroom</label>
                <Select
                  value={referralShowroom}
                  onChange={(v) => {
                    setReferralShowroom(v);
                    // The months on offer change with the dataset, so a month
                    // selected under the old one is meaningless under the new.
                    setSelectedMonth(null);
                    setExpandedYear('auto');
                  }}
                  options={referralOptions}
                  className="w-full sm:min-w-[220px]"
                  fullWidth
                />
              </div>
            )}
          </div>

          <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 24 }}>
            This section shows your referral bonuses earned for client purchases. As a ProSource member,
            you earn a referral bonus for purchases made by your clients.
            {referralOptions.length > 1 && ' "All Showrooms" adds up every showroom you work with.'}
          </p>

          {referralYears.length === 0 && (
            <div style={{
              padding: 48,
              textAlign: 'center',
              background: '#fff',
              borderRadius: 8,
              border: `1px solid ${colors.gray200}`,
              fontSize: 14,
              color: colors.gray500,
            }}>
              No referral bonuses recorded for this showroom yet.
            </div>
          )}

          {/* Yearly Breakdown */}
          {referralYears.map((yearData) => (
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
                  setExpandedYear(openYear === yearData.year ? null : yearData.year);
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
                  borderBottom: openYear === yearData.year ? `1px solid ${colors.gray200}` : 'none',
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
                    ${yearTotal(yearData).toFixed(2)}
                  </span>
                </div>
                <span style={{
                  color: colors.gray500,
                  transform: openYear === yearData.year ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                }}>
                  <ChevronDown size={20} />
                </span>
              </button>

              {/* Monthly Breakdown */}
              {openYear === yearData.year && yearData.months.length > 0 && (
                <div style={{ padding: '16px 20px' }}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {yearData.months.map((monthData, i) => {
                      const monthKey = `${yearData.year}-${i}`;
                      const isSelected = selectedMonth === monthKey;
                      // Derived from the month's orders, so the tile and the
                      // detail panel it opens can never disagree.
                      const total = monthTotal(monthData);
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (total) {
                              setSelectedMonth(isSelected ? null : monthKey);
                            }
                          }}
                          style={{
                            padding: 12,
                            background: isSelected ? colors.darkBlue : colors.gray100,
                            borderRadius: 6,
                            textAlign: 'center',
                            cursor: total ? 'pointer' : 'default',
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
                            color: isSelected ? '#fff' : total ? colors.green : colors.gray300,
                          }}>
                            {total ? `$${total.toFixed(2)}` : '--'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detail panel for selected month - renders outside the grid for proper full-width */}
                  {selectedMonth && selectedMonth.startsWith(`${yearData.year}-`) && (() => {
                    const monthIndex = parseInt(selectedMonth.split('-')[1]);
                    const monthData = yearData.months[monthIndex];
                    if (!monthData || !monthTotal(monthData)) return null;
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
                              <div style={{ fontSize: 12, color: colors.gray500 }}>
                                {order.client} · {order.product}
                                {/* Only worth saying when the view mixes showrooms. */}
                                {order.showroomName ? ` · ${order.showroomName}` : ''}
                              </div>
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

          {/* Login & Security.
              Both controls here used to be dead, and the password one was worse
              than dead: this app is OTP-only and has no password, so a row of
              dots above an "Update" button described an account that does not
              exist. Replaced with what is actually true about signing in.
              Changing the sign-in email is not offered because the email IS the
              account key (userId is derived from it at verify time), so it is a
              support operation, not a self-serve toggle. */}
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
              </div>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Sign-in Method</div>
                  <div style={styles.settingDesc}>
                    Email code. We send a 6 digit code to your email address each time you sign in,
                    so there is no password to remember or update.
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: colors.gray500, margin: '4px 4px 0' }}>
                Your email address is your account. To change it, contact
                {accountManager?.name ? ` ${accountManager.name}` : ' your account manager'}
                {accountManager?.email ? (
                  <> at <a href={`mailto:${accountManager.email}`} style={{ color: colors.darkBlue }}>{accountManager.email}</a></>
                ) : null}.
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Notification Preferences</h3>
              {prefsStatus}
            </div>
            <div style={styles.cardBody}>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>Email Notifications</div>
                  <div style={styles.settingDesc}>Receive order status updates to your email address</div>
                </div>
                <button
                  onClick={() => savePrefs({ email: !prefs.email })}
                  disabled={prefsSaving}
                  style={styles.toggle(prefs.email)}
                >
                  <div style={styles.toggleKnob(prefs.email)} />
                </button>
              </div>
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <div style={styles.settingTitle}>SMS Text Notifications</div>
                  <div style={styles.settingDesc}>Receive updates via text message (standard rates may apply)</div>
                </div>
                <button
                  onClick={() => savePrefs({ sms: !prefs.sms })}
                  disabled={prefsSaving}
                  style={styles.toggle(prefs.sms)}
                >
                  <div style={styles.toggleKnob(prefs.sms)} />
                </button>
              </div>
            </div>
          </div>

          {/* Communication Frequency */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Communication Frequency</h3>
              {prefsStatus}
            </div>
            <div style={styles.cardBody}>
              <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 16 }}>
                How often would you like product updates sent to your email?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {['Daily', 'Weekly', 'Monthly'].map(freq => (
                  <button
                    key={freq}
                    onClick={() => savePrefs({ frequency: freq })}
                    disabled={prefsSaving}
                    style={{
                      padding: '10px 24px',
                      border: `1px solid ${prefs.frequency === freq ? colors.darkBlue : colors.gray300}`,
                      borderRadius: 4,
                      background: prefs.frequency === freq ? colors.darkBlue : '#fff',
                      color: prefs.frequency === freq ? '#fff' : colors.gray700,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: prefsSaving ? 'wait' : 'pointer',
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
              {prefsStatus}
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
                  onClick={() => savePrefs({ acceptingLeads: !prefs.acceptingLeads })}
                  disabled={prefsSaving}
                  style={styles.toggle(prefs.acceptingLeads)}
                >
                  <div style={styles.toggleKnob(prefs.acceptingLeads)} />
                </button>
              </div>
              {prefs.acceptingLeads && (
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

          {/* Danger Zone.
              The button is gone rather than wired. Nothing in this app reads a
              "deactivated" flag, so a self-serve button could only ever set a
              field no code enforces: it would report success and leave the
              account fully working, which is a worse lie than the dead button
              it replaced. Deactivation is a real support operation, so this
              points at the person who can actually do it. */}
          <div style={styles.dangerZone}>
            <div style={styles.dangerTitle}>Deactivate Account</div>
            <p style={{ fontSize: 14, color: colors.gray500, margin: 0 }}>
              Deactivating hides your profile and stops all notifications. Your account manager
              handles this for you: contact
              {accountManager?.name ? ` ${accountManager.name}` : ' your account manager'}
              {accountManager?.email ? (
                <> at <a href={`mailto:${accountManager.email}?subject=Deactivate%20my%20account`} style={{ color: colors.red, fontWeight: 500 }}>{accountManager.email}</a></>
              ) : null}
              {showroom?.phone ? ` or call ${showroom.phone}` : ''} and they will close it.
            </p>
          </div>
        </div>
      )}

      {/* TEAM MANAGEMENT SECTION */}
      {activeSection === 'team' && (
        <div>
          {/* Invitation result.
              Reports what the server actually did. This used to be a hardcoded
              "Invitation Sent!" that fired without calling anything at all. */}
          {inviteResult && (
            <div style={{
              background: inviteResult.emailSent ? '#dcfce7' : '#fef3c7',
              border: `1px solid ${inviteResult.emailSent ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              {inviteResult.emailSent
                ? <Check size={20} color={colors.green} style={{ flexShrink: 0 }} />
                : <AlertCircle size={20} color="#92400e" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: inviteResult.emailSent ? colors.green : '#92400e', marginBottom: 2 }}>
                  {inviteResult.emailSent ? 'Invitation Sent' : 'Invitation Recorded, no email sent'}
                </div>
                <div style={{ fontSize: 13, color: colors.gray700 }}>
                  {inviteResult.emailSent ? (
                    'An email has been sent to the new user with instructions to activate their account.'
                  ) : (
                    <>
                      The user is on your account below with an invite on file
                      {inviteResult.token ? ' and a real invite token' : ''}, but no email went out
                      {inviteResult.reason === 'email-not-configured'
                        ? ' because email delivery is not configured in this environment.'
                        : '.'}
                      {inviteResult.error && (
                        <><br /><span style={{ fontSize: 12, color: colors.red }}>{inviteResult.error}</span></>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setInviteResult(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500 }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {teamError && !addUserModalOpen && (
            <div style={{
              background: '#fff5f5',
              border: `1px solid #f5c6cb`,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: colors.red,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertCircle size={16} /> {teamError}
            </div>
          )}

          {/* Add User Button */}
          <div className="flex justify-stretch sm:justify-end mb-6">
            <button
              onClick={() => {
                setEditingUserId(null);
                setTeamError('');
                setNewUser({ firstName: '', lastName: '', email: '', phone: '', role: '', access: 'full' });
                setAddUserModalOpen(true);
              }}
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

            {/* The user list is the real `team` blob now, not a literal.
                Empty is a real state: an account that has invited nobody has no
                users, and saying so beats inventing one. */}
            {teamLoading ? (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 14, color: colors.gray500 }}>
                Loading users…
              </div>
            ) : teamUsers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: colors.gray500, margin: 0 }}>
                  No other users on your account yet. Add someone to let them view your orders and estimates.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden">
                  {teamUsers.map((u, i) => (
                    <div
                      key={u.id}
                      className="p-4"
                      style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.gray200}` }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar name={u.name} initials={u.initials} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate" style={{ color: colors.gray900 }}>{u.name}</div>
                          <div className="text-sm truncate" style={{ color: colors.gray500 }}>{u.email}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span style={styles.accessBadge(u.access)}>{ACCESS_LABEL[u.access] || u.access}</span>
                        <span style={styles.statusBadge(u.status)}>{STATUS_LABEL[u.status] || u.status}</span>
                        {u.status === 'invited' && (
                          <span style={{ fontSize: 12, color: colors.gray500, alignSelf: 'center' }}>
                            {u.inviteEmailSent ? 'Invitation emailed' : 'Invite recorded · no email sent'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditUser(u)}
                          disabled={teamBusy}
                          className="flex-1 whitespace-nowrap"
                          style={{ ...styles.btnOutline, ...styles.btnSmall, justifyContent: 'center' }}
                        >Edit</button>
                        <button
                          onClick={() => removeUser(u)}
                          disabled={teamBusy}
                          className="flex-1 whitespace-nowrap"
                          style={{ ...styles.btnDanger, ...styles.btnSmall, justifyContent: 'center' }}
                        >Remove</button>
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
                      {teamUsers.map(u => (
                        <tr key={u.id}>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <Avatar name={u.name} initials={u.initials} size={36} />
                              <span style={{ fontWeight: 500 }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={styles.td}><span style={styles.accessBadge(u.access)}>{ACCESS_LABEL[u.access] || u.access}</span></td>
                          <td style={styles.td}>{u.email}</td>
                          <td style={styles.td}>
                            <span style={styles.statusBadge(u.status)}>{STATUS_LABEL[u.status] || u.status}</span>
                            {u.status === 'invited' && (
                              <div style={{ fontSize: 12, color: colors.gray500, marginTop: 4 }}>
                                {u.inviteEmailSent ? 'Invitation emailed' : 'Invite recorded · no email sent'}
                              </div>
                            )}
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => openEditUser(u)}
                                disabled={teamBusy}
                                style={{ ...styles.btnOutline, ...styles.btnSmall }}
                              >Edit</button>
                              <button
                                onClick={() => removeUser(u)}
                                disabled={teamBusy}
                                style={{ ...styles.btnDanger, ...styles.btnSmall }}
                              >Remove</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
              <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.gray900, margin: 0 }}>
                {editingUserId ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={resetUserModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500, padding: 4 }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: colors.gray500, marginBottom: 20 }}>
                {editingUserId
                  ? 'Update this user\'s details and access level. No new invitation is sent.'
                  : 'Add team members to view orders and estimates. We will email them an invitation to activate their account.'}
              </p>

              {teamError && (
                <div style={{
                  background: '#fff5f5',
                  border: `1px solid #f5c6cb`,
                  borderRadius: 6,
                  padding: '10px 14px',
                  marginBottom: 16,
                  fontSize: 13,
                  color: colors.red,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertCircle size={16} /> {teamError}
                </div>
              )}

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
                onClick={resetUserModal}
                disabled={teamBusy}
                style={styles.btnOutline}
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                disabled={teamBusy}
                style={{ ...styles.btnPrimary, opacity: teamBusy ? 0.7 : 1, cursor: teamBusy ? 'wait' : 'pointer' }}
              >
                {teamBusy
                  ? 'Saving…'
                  : editingUserId
                  ? 'Save Changes'
                  : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
