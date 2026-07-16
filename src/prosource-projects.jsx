import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  ArrowLeft,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from './auth-context';

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

const normalizeStored = (stored) => {
  if (!stored) return [];
  if (Array.isArray(stored.list)) return stored.list;
  if (stored.project) {
    return [{
      id: 'legacy-' + Date.now(),
      ...stored.project,
      status: stored.status || 'working',
      archived: !!stored.archived,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }];
  }
  return [];
};

export default function ProSourceProjects() {
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

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  };

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
};
