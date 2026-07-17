import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  ArrowLeft,
  Lightbulb,
  ChevronRight,
  Home,
  FolderOpen,
  AlertCircle,
  RotateCw,
  Inbox,
} from 'lucide-react';
import { useAuth } from './auth-context';
import { normalizeStored } from './project-model';
import {
  readUserBlob,
  loadMemberProjects,
  membersFromConnections,
  memberProjectPath,
} from './member-access';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  lightBlue: '#6CACE4',
  green: '#07542E',
  amber: '#856404',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

const STATUS_META = {
  working: { label: 'Working', bg: '#e3f2fd', fg: colors.darkBlue },
  complete: { label: 'Complete', bg: '#fff3cd', fg: colors.amber },
  published: { label: 'Published', bg: '#e8f5e9', fg: colors.green },
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
};

/** Working first, then complete, then published, then most recently touched. */
const byStatusThenRecent = (a, b) => {
  const rank = { working: 0, complete: 1, published: 2 };
  const sa = rank[a.status] ?? 99;
  const sb = rank[b.status] ?? 99;
  if (sa !== sb) return sa - sb;
  return (b.updatedAt || 0) - (a.updatedAt || 0);
};

/** Shared by both readers: the same search over the same fields. */
const matchesQuery = (p, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (p.name || '').toLowerCase().includes(q) ||
    (p.type || '').toLowerCase().includes(q) ||
    (p.address || '').toLowerCase().includes(q)
  );
};

const matchesFilter = (p, filter) => {
  if (filter === 'active') return !p.archived;
  if (filter === 'archived') return !!p.archived;
  return true;
};

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

/**
 * /projects means "the projects I came here to look at", and who that is
 * depends on which side of the glass you are on.
 *
 * A member owns projects, so theirs is the list below. An account manager owns
 * none: hers are her members', read out of their accounts. Both answer the same
 * question at the same address, and both open a project at /projects/:id, so
 * this is one route with two readers rather than two routes.
 *
 * The split is a component boundary, not a branch inside one, because the two
 * views load different things from different places and hooks cannot be called
 * conditionally.
 */
export default function ProSourceProjects() {
  const { userType } = useAuth();
  return userType === 'accountmanager' ? <AmMemberProjects /> : <MemberProjects />;
}

function MemberProjects() {
  const { userId, loadUserData } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active'); // active | archived | all

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('projects', null).then((stored) => {
      if (cancelled) return;
      setProjects(normalizeStored(stored));
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const visible = useMemo(() => {
    let list = projects;
    if (filter === 'active') list = list.filter((p) => !p.archived);
    else if (filter === 'archived') list = list.filter((p) => p.archived);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }
    // Working first, then complete, then published, then by updatedAt desc.
    const statusRank = { working: 0, complete: 1, published: 2 };
    return [...list].sort((a, b) => {
      const sa = statusRank[a.status] ?? 99;
      const sb = statusRank[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [projects, query, filter]);

  const grouped = useMemo(() => {
    const g = { working: [], complete: [], published: [] };
    visible.forEach((p) => {
      const k = p.status || 'working';
      (g[k] = g[k] || []).push(p);
    });
    return g;
  }, [visible]);

  const renderCard = (p) => {
    const meta = STATUS_META[p.status] || STATUS_META.working;
    return (
      <button
        key={p.id}
        onClick={() => navigate(`/projects/${p.id}`)}
        style={styles.projectRow}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.darkBlue; e.currentTarget.style.background = '#f8faff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.gray200; e.currentTarget.style.background = '#fff'; }}
      >
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ ...styles.statusBadge, background: meta.bg, color: meta.fg }}>{meta.label}</span>
            {p.archived && <span style={styles.archivedBadge}>Archived</span>}
            <span style={styles.projectType}>{p.type}</span>
          </div>
          <div style={styles.projectName}>{p.name || 'Untitled project'}</div>
          <div style={styles.projectMeta}>
            {p.address && (
              <span style={styles.metaItem}><MapPin size={13} /> {p.address}</span>
            )}
            {p.targetCompletion && (
              <span style={styles.metaItem}><Calendar size={13} /> Target: {formatDate(p.targetCompletion)}</span>
            )}
            {(p.rooms || []).length > 0 && (
              <span style={styles.metaItem}>
                <Home size={13} /> {p.rooms.map((r) => r.name).join(' · ')}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={18} color={colors.gray500} />
      </button>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <Link to="/settings" style={styles.backLink}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>

        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>My Projects</h1>
            <p style={styles.pageDesc}>
              Track your active jobs, manage their lifecycle, and revisit completed work.
            </p>
          </div>
          <button style={styles.newBtn} onClick={() => navigate('/projects/new')}>
            <Plus size={16} /> New Project
          </button>
        </div>

        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <Search size={16} color={colors.gray500} />
            <input
              style={styles.searchInput}
              placeholder="Search projects by name, type, or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            {[
              { id: 'active', label: 'Active' },
              { id: 'archived', label: 'Archived' },
              { id: 'all', label: 'All' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  ...styles.filterChip,
                  background: filter === f.id ? colors.darkBlue : '#fff',
                  color: filter === f.id ? '#fff' : colors.gray700,
                  borderColor: filter === f.id ? colors.darkBlue : colors.gray300,
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading projects…</div>
        ) : visible.length === 0 ? (
          <div style={styles.emptyCard}>
            <Lightbulb size={32} color={colors.darkBlue} />
            <div style={styles.emptyTitle}>No projects yet</div>
            <div style={styles.emptyDesc}>
              Create your first project to track timelines, products, photos, and conversations all in one place.
            </div>
            <button style={styles.newBtn} onClick={() => navigate('/projects/new')}>
              <Plus size={16} /> Create your first project
            </button>
          </div>
        ) : (
          <>
            {['working', 'complete', 'published'].map((status) => {
              const items = grouped[status] || [];
              if (!items.length) return null;
              const meta = STATUS_META[status];
              return (
                <section key={status} style={{ marginBottom: 28 }}>
                  <h3 style={styles.sectionTitle}>
                    <span style={{ ...styles.statusDot, background: meta.fg }} />
                    {meta.label} ({items.length})
                  </h3>
                  <div style={styles.projectGrid}>
                    {items.map(renderCard)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * An account manager's projects screen: her members' work, not her own.
 *
 * She is a default owner on her member ACCOUNTS, so the unit of ownership is the
 * member, not the project. Every project on a member's account is hers to look
 * at, unfiltered: not by team, not by showroom, not by status. That is also why
 * the list is grouped by member rather than sorted into one flat pile. She is
 * looking at other people's work, so whose it is cannot be a footnote on the
 * card, it has to be the thing she reads first.
 *
 * Her members are her connections that carry a real userId. Everyone else in
 * that list is a colleague persona with no account behind them.
 */
function AmMemberProjects() {
  const { userId, userName } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  // One entry per member, each carrying its own projects and its own failure.
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    setError('');
    try {
      const members = membersFromConnections(await readUserBlob(userId, 'connections'));
      // allSettled, never all: one member's blob failing has to cost that
      // member's section and nothing else. `all` would throw away every list she
      // CAN read because of the one she cannot, which is the opposite of useful.
      const results = await Promise.allSettled(
        members.map((m) => loadMemberProjects(m.userId))
      );
      setRoster(
        members.map((member, i) => {
          const result = results[i];
          return result.status === 'fulfilled'
            ? { member, projects: result.value, error: null }
            : {
                member,
                projects: [],
                error: result.reason?.message || 'Could not load this list',
              };
        })
      );
      setStatus('ready');
    } catch (err) {
      // Only the connections read lands here. Without it there is no roster, so
      // there is no screen: that is a page-level failure, not a member's.
      setError(err.message || 'Could not load your members');
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Filter inside each member rather than across the whole set, so a member
  // whose projects are all filtered out still appears, and still says so. She
  // is picking a person first and a project second.
  const visible = useMemo(
    () =>
      roster.map((entry) => ({
        ...entry,
        visibleProjects: entry.projects
          .filter((p) => matchesFilter(p, filter) && matchesQuery(p, query))
          .sort(byStatusThenRecent),
      })),
    [roster, filter, query]
  );

  const totalShown = visible.reduce((n, e) => n + e.visibleProjects.length, 0);
  const failed = visible.filter((e) => e.error).length;

  const renderCard = (p, member) => {
    const meta = STATUS_META[p.status] || STATUS_META.working;
    return (
      <button
        key={p.id}
        onClick={() => navigate(memberProjectPath(p.id, member.userId))}
        style={styles.projectRow}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.darkBlue; e.currentTarget.style.background = '#f8faff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.gray200; e.currentTarget.style.background = '#fff'; }}
      >
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ ...styles.statusBadge, background: meta.bg, color: meta.fg }}>{meta.label}</span>
            {p.archived && <span style={styles.archivedBadge}>Archived</span>}
            <span style={styles.projectType}>{p.type}</span>
          </div>
          <div style={styles.projectName}>{p.name || 'Untitled project'}</div>
          {/* The owner rides on the card as well as the section header: a card
              is the thing she will click, screenshot and talk about, and it has
              to carry whose project it is on its own. */}
          <div style={styles.projectMeta}>
            <span style={{ ...styles.metaItem, color: colors.darkBlue, fontWeight: 600 }}>
              {member.name}
            </span>
            {p.address && (
              <span style={styles.metaItem}><MapPin size={13} /> {p.address}</span>
            )}
            {p.targetCompletion && (
              <span style={styles.metaItem}><Calendar size={13} /> Target: {formatDate(p.targetCompletion)}</span>
            )}
            {(p.rooms || []).length > 0 && (
              <span style={styles.metaItem}>
                <Home size={13} /> {p.rooms.map((r) => r.name).join(' · ')}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={18} color={colors.gray500} />
      </button>
    );
  };

  const renderMember = (entry) => {
    const { member, projects, visibleProjects, error: memberError } = entry;
    return (
      <section key={member.userId} style={{ marginBottom: 32 }}>
        <div style={styles.memberHeader}>
          <div style={styles.memberAvatar(member.type)}>{member.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.memberName}>{member.name}</div>
            <div style={styles.memberRole}>
              {[member.role, member.type === 'client' ? 'Homeowner account' : 'Trade pro account']
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div style={styles.memberCount}>
            {memberError
              ? 'Unavailable'
              : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {memberError ? (
          <div style={styles.memberError}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <strong>We couldn't load {member.name}'s projects.</strong> {memberError}
            </div>
            <button onClick={load} style={{ ...styles.filterChip, borderColor: colors.gray300, background: '#fff', color: colors.gray700 }}>
              Try again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div style={styles.memberEmpty}>
            {member.name} has no projects yet. When they start one it shows up here.
          </div>
        ) : visibleProjects.length === 0 ? (
          <div style={styles.memberEmpty}>
            Nothing matches the current filter. {member.name} has {projects.length} project
            {projects.length === 1 ? '' : 's'} in total.
          </div>
        ) : (
          <div style={styles.projectGrid}>
            {visibleProjects.map((p) => renderCard(p, member))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <Link to="/am" style={styles.backLink}>
          <ArrowLeft size={18} /> Back to Work Queue
        </Link>

        <div style={styles.pageHeader}>
          <div>
            <h1 style={{ ...styles.pageTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
              <FolderOpen size={26} color={colors.darkBlue} />
              Member projects
            </h1>
            <p style={styles.pageDesc}>
              {userName ? `${userName}, every` : 'Every'} project your members are running, grouped by
              whose it is. You can open any of them, but they stay read only: this is their work, not yours.
            </p>
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            style={{
              ...styles.filterChip,
              borderColor: colors.gray300,
              background: '#fff',
              color: colors.gray700,
              opacity: status === 'loading' ? 0.55 : 1,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {status !== 'error' && roster.length > 0 && (
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={16} color={colors.gray500} />
              <input
                style={styles.searchInput}
                placeholder="Search your members' projects by name, type, or address…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div style={styles.filterGroup}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    ...styles.filterChip,
                    background: filter === f.id ? colors.darkBlue : '#fff',
                    color: filter === f.id ? '#fff' : colors.gray700,
                    borderColor: filter === f.id ? colors.darkBlue : colors.gray300,
                  }}
                >{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* One member's list failing is not the page failing, so it is reported
            in that member's section. This only says the page is incomplete, so
            she never reads a short list as the whole picture. */}
        {status === 'ready' && failed > 0 && (
          <div style={styles.pageWarning}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {failed === 1 ? 'One member\'s' : `${failed} members'`} projects could not be loaded.
              Everything else below is complete.
            </div>
          </div>
        )}

        {status === 'loading' && roster.length === 0 && (
          <div style={styles.panelState}>
            <RotateCw size={28} color={colors.gray500} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>Loading your members' projects…</div>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.panelState}>
            <AlertCircle size={28} color={colors.red} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>We couldn't load your members</div>
            <div style={{ marginBottom: 16 }}>{error}</div>
            <button onClick={load} style={{ ...styles.filterChip, borderColor: colors.gray300, background: '#fff', color: colors.gray700 }}>
              Try again
            </button>
          </div>
        )}

        {/* No members is a real state, and a different one from no projects. */}
        {status === 'ready' && roster.length === 0 && (
          <div style={styles.panelState}>
            <Inbox size={28} color={colors.gray500} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>No members yet</div>
            <div style={{ maxWidth: 460 }}>
              Projects here belong to the members on your connections list. Once an account is
              connected to you, everything they are working on shows up.
            </div>
            <Link to="/connections" style={{ ...styles.newBtn, textDecoration: 'none', marginTop: 16 }}>
              View connections
            </Link>
          </div>
        )}

        {status !== 'error' && roster.length > 0 && (
          <>
            {totalShown === 0 && (
              <div style={{ ...styles.empty, marginBottom: 8 }}>
                No projects match "{query || filter}". Every member is still listed below.
              </div>
            )}
            {visible.map(renderMember)}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    background: '#fafafa',
    minHeight: '100vh',
  },
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
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  pageTitle: { fontSize: 28, fontWeight: 700, color: colors.gray900, margin: 0, marginBottom: 6 },
  pageDesc: { fontSize: 14, color: colors.gray500, margin: 0 },
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: colors.darkBlue,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1,
    minWidth: 240,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#fff',
    border: `1px solid ${colors.gray300}`,
    borderRadius: 6,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  filterGroup: {
    display: 'flex',
    gap: 6,
  },
  filterChip: {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    fontWeight: 600,
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    margin: '0 0 12px',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  projectGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  projectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 10,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    width: '100%',
    textAlign: 'left',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  archivedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: colors.gray200,
    color: colors.gray700,
  },
  projectType: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: 500,
  },
  projectName: {
    fontSize: 17,
    fontWeight: 600,
    color: colors.gray900,
    marginBottom: 4,
  },
  projectMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
    fontSize: 13,
    color: colors.gray500,
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  emptyCard: {
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.gray900,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.gray500,
    maxWidth: 420,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: colors.gray500,
    fontSize: 14,
  },

  // -------- Account manager's member-grouped view --------

  memberHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 2px 12px',
    marginBottom: 12,
    borderBottom: `1px solid ${colors.gray200}`,
  },
  memberAvatar: (type) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    background: type === 'client'
      ? `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`
      : `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)`,
  }),
  memberName: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.gray900,
    lineHeight: 1.3,
  },
  memberRole: {
    fontSize: 13,
    color: colors.gray500,
  },
  memberCount: {
    marginLeft: 'auto',
    fontSize: 13,
    color: colors.gray500,
    whiteSpace: 'nowrap',
  },
  memberEmpty: {
    padding: '20px 18px',
    background: '#fff',
    border: `1px dashed ${colors.gray300}`,
    borderRadius: 10,
    fontSize: 13,
    color: colors.gray500,
  },
  memberError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '14px 16px',
    background: '#fee2e2',
    border: `1px solid ${colors.red}`,
    borderRadius: 10,
    fontSize: 13,
    color: colors.red,
    lineHeight: 1.5,
  },
  pageWarning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    margin: '0 0 20px',
    padding: '12px 14px',
    background: '#fff3cd',
    border: `1px solid ${colors.amber}`,
    borderRadius: 6,
    fontSize: 13,
    color: colors.amber,
    lineHeight: 1.5,
  },
  panelState: {
    padding: 64,
    textAlign: 'center',
    background: colors.gray100,
    borderRadius: 8,
    color: colors.gray500,
    fontSize: 14,
    // Tailwind's preflight sets svg{display:block}, so an icon here is a block
    // element and sits hard against the left edge no matter what textAlign says.
    // Flex-centre the column so it lines up with its own text.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.gray700,
    marginBottom: 6,
  },
};
