import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth-context';
import {
  FileText,
  Camera,
  Palette,
  Clock,
  Bell,
  ChevronRight,
  Plus,
  Paperclip,
  MessageCircle,
  Settings,
  Check,
  Lock,
  MapPin,
  Calendar,
  Download,
  X,
  ShoppingCart,
  Pencil,
  Home,
  Circle,
  Image,
  Minus,
  MoreHorizontal,
  Archive,
  Edit2,
  Trash2,
  ArrowRight
} from 'lucide-react';
import {
  DEFAULT_PROJECT,
  PROJECT_TYPE_VALUES,
  BUDGET_RANGES,
  ROOM_OPTIONS,
  normalizeStored,
  makeRoom,
  removeRoomFromProject,
  renameRoomInProject,
  groupProductsByRoom,
  roomLabel,
  moveProductToRoom,
  setProductQty,
  removeProductAt,
  countProductsInRoom,
} from './project-model';
import { customerStatusLabel, statusTone, statusIcon } from './order-status';
import {
  useOrders,
  docsForProject,
  isEstimate,
  headlineLabel,
  headlineAmount,
  byNewest,
  money,
} from './order-model';

// ProSource Brand Colors
const colors = {
  red: '#BA0C2F',
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

const TAB_IDS = ['overview', 'products', 'designs', 'photos', 'estimates', 'activity'];

// -------- Demo persona replies in the discussion feed --------

/**
 * Demo personas the shared /api/ai-reply service knows about. Mirrors
 * DEMO_IDENTITY_BY_NAME in netlify/functions/lib/seed.mjs.
 *
 * Seeded connections carry `demoIdentity`, but a project's `team` entries only
 * store name/role/type, so we resolve by connection first and fall back to the
 * name. Anyone who resolves to nothing (real invited users, James Anderson,
 * Mike Torres) simply never replies: we only ever put words in a demo persona's
 * mouth, never a real person's.
 */
const DEMO_IDENTITY_BY_NAME = {
  'Kim Marks': 'demo-kim-marks',
  'Bubba Beans': 'demo-bubba-beans',
  "Ryan O'Toole": 'demo-ryan-otoole',
  'Sarah Chen': 'demo-sarah-chen',
  'Heather Yager': 'demo-heather-yager',
};

/**
 * `/api/ai-reply` is the contract, but its [[redirects]] entry in netlify.toml
 * is still landing. Netlify always serves functions at /.netlify/functions/<name>
 * regardless of redirects, so fall back to that path on a 404 rather than
 * silently dropping the reply. Once the redirect ships the first call succeeds
 * and the fallback never fires.
 */
const AI_REPLY_PATHS = ['/api/ai-reply', '/.netlify/functions/ai-reply'];
let aiReplyPath = null;

const fetchAiReply = async ({ identity, message, history, context }) => {
  const payload = JSON.stringify({
    identity,
    message,
    history,
    surface: 'project-discussion',
    ...(context ? { context } : {}),
  });
  const paths = aiReplyPath ? [aiReplyPath] : AI_REPLY_PATHS;

  for (const path of paths) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.status === 404) continue; // redirect not live yet, try direct path
      const data = await res.json();
      // `source` is "ai" or "canned" (key missing / API blip). Both are valid
      // replies and must be treated identically. Never surfaced in the UI.
      if (data?.reply) {
        aiReplyPath = path; // remember the path that worked
        return data.reply;
      }
      return null;
    } catch {
      // try the next candidate path
    }
  }
  return null;
};

/**
 * Who on the team should field this post? Each rule owns a topic; the rule with
 * the most keyword hits that has someone on THIS project's team answers.
 * Deliberately simple and explainable. It only has to look considered, not be
 * a classifier.
 */
const RESPONDER_RULES = [
  {
    // Install logistics -> whoever swings the hammer.
    keywords: [
      'install', 'subfloor', 'underlayment', 'demo day', 'tear out', 'rip out',
      'acclimat', 'grout', 'crew', 'schedule', 'scheduling', 'prep', 'waste factor',
      'square foot', 'square feet', 'sq ft', 'moisture', 'level', 'transition strip',
      'labor', 'measure',
    ],
    matches: (m) => m.type === 'tradepro',
  },
  {
    // Look and feel -> the designer.
    keywords: [
      'color', 'colour', 'tone', 'shade', 'design', 'style', 'look', 'match',
      'finish', 'pattern', 'layout', 'texture', 'transition', 'aesthetic',
      'stain', 'grain', 'coordinate', 'palette', 'warm', 'cool', 'contrast',
    ],
    matches: (m) => /design/i.test(m.role || ''),
  },
  {
    // Samples, pricing, orders, showroom logistics -> the account manager.
    keywords: [
      'sample', 'quote', 'estimate', 'price', 'pricing', 'cost', 'budget',
      'order', 'pickup', 'pick up', 'delivery', 'deliver', 'lead time', 'stock',
      'invoice', 'showroom', 'availability', 'ship', 'reorder', 'discontinued',
    ],
    matches: (m) => /account manager/i.test(m.role || ''),
  },
];

const scoreRule = (text, keywords) =>
  keywords.reduce((n, k) => (text.includes(k) ? n + 1 : n), 0);

/**
 * `candidates` are team members already resolved to a demo persona.
 * Default is the account manager, the member's main point of contact, and who
 * they'd expect to hear from when nothing more specific applies.
 */
const pickResponder = (message, candidates) => {
  if (!candidates.length) return null;
  const text = String(message || '').toLowerCase();
  const ranked = RESPONDER_RULES
    .map((rule) => ({ rule, score: scoreRule(text, rule.keywords) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const { rule } of ranked) {
    const hit = candidates.find((c) => rule.matches(c));
    if (hit) return hit;
  }
  return (
    candidates.find((c) => /account manager/i.test(c.role || '')) ||
    candidates.find((c) => c.type === 'prosource') ||
    candidates[0]
  );
};

export default function ProjectDetailPage() {
  const { loadUserData, saveUserData, userId, userName, accountManager } = useAuth();
  // Estimates & Orders tab. Reads the same `orders` blob as /orders. Seeded
  // documents already carry a projectId, it just had nothing reading it.
  const {
    orders: allOrderDocs,
    status: ordersStatus,
    error: ordersError,
    reload: reloadOrders,
  } = useOrders();
  // ?tab=products lets the shop's save-to-project flow land on the right tab.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TAB_IDS.includes(requestedTab) ? requestedTab : 'overview'
  );
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [projectStatus, setProjectStatus] = useState('working'); // working, complete, published
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('view');
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [projectId, setProjectId] = useState(routeId && routeId !== 'new' ? routeId : null);
  // For new projects, jump straight into the rename flow so the user's first
  // action is giving the project a real name.
  useEffect(() => {
    if (routeId === 'new') {
      setEditingTitle(true);
      setIsEditingDetails(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const [projectData, setProjectData] = useState(DEFAULT_PROJECT);
  const [projectList, setProjectList] = useState([]); // full collection
  const [loadedProject, setLoadedProject] = useState(false);

  // Load persisted projects on mount, hydrate the one matching the URL :id.
  // For /projects/new (or no id) we stay on defaults until first save.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('projects', null).then((stored) => {
      if (cancelled) return;
      const list = normalizeStored(stored);
      setProjectList(list);
      if (projectId) {
        const match = list.find((p) => p.id === projectId);
        if (match) {
          const { id, status, archived: arch, createdAt, updatedAt, ...rest } = match;
          setProjectData({ ...DEFAULT_PROJECT, ...rest });
          setProjectStatus(status || 'working');
          setArchived(!!arch);
          // Seed the auto-save guard with the LOADED values so the very next
          // status-effect run sees no diff and doesn't re-save with stale state
          // (which used to wipe out team[] before the team effect could hydrate).
          lastPersistedStatus.current = { status: status || 'working', archived: !!arch };
        } else {
          // Bad id, so fall back to "new" behavior
          setProjectId(null);
        }
      }
      setLoadedProject(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId]);

  // Build the updated list with the current project upserted into it. Always
  // carries the current `team` state through so team edits made before first
  // save are preserved when the project record is finally created.
  const buildUpsertedList = (next = projectData, status = projectStatus, arch = archived, teamSnapshot = team) => {
    const id = projectId || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const record = {
      id,
      ...next,
      status,
      archived: arch,
      team: teamSnapshot,
      updatedAt: now,
    };
    const idx = projectList.findIndex((p) => p.id === id);
    let updatedList;
    if (idx >= 0) {
      updatedList = [...projectList];
      updatedList[idx] = { ...projectList[idx], ...record };
    } else {
      updatedList = [...projectList, { ...record, createdAt: now }];
    }
    return { id, updatedList };
  };

  const persistProject = async (next = projectData) => {
    if (!userId) return;
    setSaving(true);
    try {
      const { id, updatedList } = buildUpsertedList(next);
      await saveUserData('projects', { list: updatedList });
      setProjectList(updatedList);
      if (!projectId) {
        setProjectId(id);
        // Update the URL so refresh lands on the right project.
        navigate(`/projects/${id}`, { replace: true });
      }
    } catch (err) {
      alert(`Could not save project: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Persist whenever status or archived flag changes. Those are one-click
  // actions with no explicit Save button. Skip until the initial load completes
  // so we don't echo the loaded values back as a save.
  const lastPersistedStatus = useRef({ status: null, archived: null });
  useEffect(() => {
    if (!userId || !loadedProject) return;
    if (!projectId) return; // brand-new draft, let the explicit save handle it
    if (
      lastPersistedStatus.current.status === projectStatus &&
      lastPersistedStatus.current.archived === archived
    ) return;
    lastPersistedStatus.current = { status: projectStatus, archived };
    const { updatedList } = buildUpsertedList(projectData, projectStatus, archived);
    saveUserData('projects', { list: updatedList })
      .then(() => setProjectList(updatedList))
      .catch((err) => console.warn('Project status save failed:', err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStatus, archived, loadedProject]);

  const deleteProject = async () => {
    if (!userId || !projectId) {
      navigate('/projects');
      return;
    }
    const next = projectList.filter((p) => p.id !== projectId);
    try {
      await saveUserData('projects', { list: next });
    } catch (err) {
      alert(`Could not delete project: ${err.message}`);
      return;
    }
    navigate('/projects');
  };

  // -------- Project team --------
  const [team, setTeam] = useState([]);
  const [connections, setConnections] = useState([]);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  // Hydrate team from the currently-loaded project record. For brand-new
  // projects, default to the ProSource showroom contacts already in the user's
  // connections list (Account Manager + Designer) so the team isn't blank.
  useEffect(() => {
    if (!loadedProject) return;
    const match = projectId ? projectList.find((p) => p.id === projectId) : null;
    if (match?.team && Array.isArray(match.team)) {
      setTeam(match.team);
      return;
    }
    if (!projectId) {
      // Pick the user's account-manager connection (and Designer if present).
      const showroomTeam = connections
        .filter((c) => c.type === 'prosource')
        .map((c) => ({
          connectionId: c.id,
          name: c.name,
          initials: c.initials,
          role: c.role,
          type: c.type,
          addedAt: Date.now(),
        }));
      setTeam(showroomTeam);
      return;
    }
    setTeam([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProject, projectId, connections]);

  // Load the user's connections so the + Add picker has someone to choose from.
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

  const persistTeam = async (nextTeam) => {
    if (!userId || !projectId) {
      // No project saved yet, so keep changes local; first project save will
      // include the team via persistProject below.
      setTeam(nextTeam);
      return;
    }
    setTeam(nextTeam);
    try {
      const { updatedList } = buildUpsertedList(projectData, projectStatus, archived);
      // buildUpsertedList already includes our current `team` state through the
      // shallow copy, so we need to override with the explicit nextTeam.
      const overridden = updatedList.map((p) =>
        p.id === projectId ? { ...p, team: nextTeam } : p
      );
      await saveUserData('projects', { list: overridden });
      setProjectList(overridden);
    } catch (err) {
      alert(`Could not update team: ${err.message}`);
    }
  };

  const addTeamMember = (conn) => {
    if (team.some((t) => t.connectionId === conn.id)) {
      setTeamPickerOpen(false);
      return;
    }
    const next = [...team, {
      connectionId: conn.id,
      name: conn.name,
      initials: conn.initials,
      role: conn.role,
      type: conn.type,
      addedAt: Date.now(),
    }];
    persistTeam(next);
    setTeamPickerOpen(false);
  };

  const removeTeamMember = (connectionId) => {
    persistTeam(team.filter((t) => t.connectionId !== connectionId));
  };

  const memberBadgeStyle = (type) => {
    if (type === 'prosource') return { color: colors.darkBlue, background: '#e3f2fd', label: 'ProSource' };
    if (type === 'client') return { color: colors.green, background: '#dcfce7', label: 'Client' };
    return { color: colors.red, background: '#fee2e2', label: 'Trade Pro' };
  };

  const memberAvatarStyle = (type) => {
    if (type === 'prosource') return styles.avatar(44);
    if (type === 'client') return { ...styles.avatar(44), background: `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)` };
    return { ...styles.avatar(44), background: `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)` };
  };

  /** Same colour language as the team sidebar, sized for the discussion feed. */
  const commentAvatarStyle = (type) => {
    if (type === 'prosource') return styles.avatar(40);
    if (type === 'client') return { ...styles.avatar(40), background: `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)` };
    return { ...styles.avatar(40), background: `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)` };
  };

  // -------- Discussion comments --------
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentIsPrivate, setCommentIsPrivate] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  // The teammate currently "typing" a reply, or null.
  const [typingResponder, setTypingResponder] = useState(null);
  // Bumped to invalidate an in-flight reply (project switch / unmount).
  const replyToken = useRef(0);

  useEffect(() => {
    if (!userId || !projectId) return;
    let cancelled = false;
    loadUserData('discussions', null).then((stored) => {
      if (cancelled) return;
      const all = (stored && typeof stored === 'object') ? stored : {};
      setComments(Array.isArray(all[projectId]) ? all[projectId] : []);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId]);

  // Switching projects (or leaving) invalidates any reply still in flight.
  useEffect(() => () => {
    replyToken.current += 1;
  }, [projectId]);

  /**
   * Project team members who map to a demo persona the AI-reply service knows.
   * Everyone else is filtered out, so a real user on the team never gets words
   * put in their mouth.
   */
  const teamPersonas = useMemo(
    () =>
      team
        .map((m) => {
          const conn = connections.find((c) => String(c.id) === String(m.connectionId));
          const identity = conn?.demoIdentity || DEMO_IDENTITY_BY_NAME[m.name] || null;
          return identity ? { ...m, identity } : null;
        })
        .filter(Boolean),
    [team, connections]
  );

  /**
   * Prior turns for the persona's context, oldest first. The persona's own past
   * posts are "them"; everything else is "user". Another persona's post is
   * attributed inline so the responder doesn't read it as the member speaking.
   * Private notes are left out, since they aren't visible to the team.
   */
  const buildReplyHistory = (thread, identity) =>
    thread
      .filter((c) => !c.private)
      .slice(-12)
      .map((c) =>
        c.authorIdentity === identity
          ? { from: 'them', body: c.body }
          : { from: 'user', body: c.authorIdentity ? `${c.author}: ${c.body}` : c.body }
      );

  /**
   * Ask a teammate to reply to the member's post.
   *
   * Only ever called from postComment, i.e. only a member's own post triggers a
   * reply. The persona's post is written straight to the blob and never routed
   * back through here, so replies cannot chain.
   */
  const requestPersonaReply = async (post, thread) => {
    const responder = pickResponder(post.body, teamPersonas);
    if (!responder) return;
    const token = ++replyToken.current;
    const targetId = projectId;
    setTypingResponder(responder);
    try {
      const [reply] = await Promise.all([
        fetchAiReply({
          identity: responder.identity,
          message: post.body,
          // `post` is the message itself; the rest of the thread is the history.
          history: buildReplyHistory(thread.slice(0, -1), responder.identity),
          context: {
            projectName: projectData.name,
            rooms: rooms.map((r) => r.name).filter(Boolean),
            products: products.map((p) => p.name).filter(Boolean),
          },
        }),
        // Let the reply land like someone typed it, not like an API returned.
        new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 900)),
      ]);
      if (token !== replyToken.current || !reply) return;

      // Re-read: the member may have posted again while this was in flight.
      const stored = (await loadUserData('discussions', null)) || {};
      const list = Array.isArray(stored[targetId]) ? stored[targetId] : [];
      const next = [
        ...list,
        {
          id: `c-${Date.now()}-${responder.identity}`,
          author: responder.name,
          authorRole: responder.type,
          authorTitle: responder.role,
          authorInitials: responder.initials,
          authorIdentity: responder.identity,
          body: reply,
          private: false,
          createdAt: Date.now(),
        },
      ];
      await saveUserData('discussions', { ...stored, [targetId]: next });
      if (token !== replyToken.current) return;
      setComments(next);
    } catch (err) {
      // A missing reply isn't worth interrupting the member with an alert.
      console.warn('Persona reply failed:', err.message);
    } finally {
      if (token === replyToken.current) setTypingResponder(null);
    }
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || !projectId) return;
    setPostingComment(true);
    const isPrivate = commentIsPrivate;
    let posted = null;
    try {
      const stored = (await loadUserData('discussions', null)) || {};
      const list = Array.isArray(stored[projectId]) ? stored[projectId] : [];
      const entry = {
        id: `c-${Date.now()}`,
        author: 'Me',
        authorRole: 'tradepro',
        body: text,
        private: isPrivate,
        createdAt: Date.now(),
      };
      const next = [...list, entry];
      await saveUserData('discussions', { ...stored, [projectId]: next });
      setComments(next);
      setCommentText('');
      setCommentIsPrivate(false);
      posted = { entry, thread: next };
    } catch (err) {
      alert(`Could not post comment: ${err.message}`);
    } finally {
      setPostingComment(false);
    }
    // A private note is visible only to the member, so nobody replies to it.
    if (posted && !isPrivate) requestPersonaReply(posted.entry, posted.thread);
  };

  const formatCommentDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // -------- Rooms + products --------
  const rooms = projectData.rooms || [];
  const products = projectData.products || [];

  const [newRoomName, setNewRoomName] = useState('');
  const [renamingRoomId, setRenamingRoomId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  /**
   * Narrow write: re-read the collection, patch ONLY this project, save.
   * Rooms and products change from three different pages, so writing back a
   * list we loaded on mount would clobber concurrent edits. Drafts that have
   * never been saved (no projectId) stay local, and persistProject picks them up.
   */
  const persistProjectFields = async (fields) => {
    setProjectData((current) => ({ ...current, ...fields }));
    if (!userId || !projectId) return;
    try {
      const stored = await loadUserData('projects', null);
      const list = normalizeStored(stored);
      const next = list.map((p) =>
        p.id === projectId ? { ...p, ...fields, updatedAt: Date.now() } : p
      );
      await saveUserData('projects', { list: next });
      setProjectList(next);
    } catch (err) {
      alert(`Could not save project: ${err.message}`);
    }
  };

  const addRoom = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    if (rooms.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewRoomName('');
      return;
    }
    persistProjectFields({ rooms: [...rooms, makeRoom(trimmed, rooms)] });
    setNewRoomName('');
  };

  const removeRoom = (room) => {
    const attached = countProductsInRoom(products, room.id);
    if (attached > 0) {
      const ok = window.confirm(
        `Remove "${room.name}"?\n\n${attached} product${attached !== 1 ? 's' : ''} ` +
        `will move to Unassigned. Nothing is deleted.`
      );
      if (!ok) return;
    }
    persistProjectFields(removeRoomFromProject(projectData, room.id));
  };

  const commitRename = (roomId) => {
    const name = renameDraft.trim();
    setRenamingRoomId(null);
    if (!name) return;
    persistProjectFields(renameRoomInProject(projectData, roomId, name));
  };

  const changeProductQty = (index, delta) => {
    const current = products[index];
    if (!current) return;
    persistProjectFields({ products: setProductQty(products, index, (current.qty || 1) + delta) });
  };

  const moveProduct = (index, roomId) => {
    persistProjectFields({ products: moveProductToRoom(products, index, roomId || null) });
  };

  const removeProduct = (index) => {
    persistProjectFields({ products: removeProductAt(products, index) });
  };

  // -------- Activity --------

  /**
   * Real project activity, newest first.
   *
   * This used to be two hand-written lists that credited Kim Marks with adding
   * a "Top Knobs Garrison Knob", a product no project has, which reads as
   * broken next to a Products tab showing real data. Everything here is instead
   * derived from timestamps the app already writes. An old record missing a
   * timestamp just yields no event rather than an invented one.
   */
  const activity = useMemo(() => {
    const record = projectId ? projectList.find((p) => p.id === projectId) : null;
    const me = {
      name: userName || 'You',
      initials: (userName || 'You').slice(0, 2).toUpperCase(),
      type: 'tradepro',
    };
    const events = [];

    (projectData.rooms || []).forEach((room) => {
      if (!room.createdAt) return;
      events.push({
        id: `act-room-${room.id}`, ...me, ts: room.createdAt,
        text: <>Added <strong>{room.name}</strong> as a room</>,
      });
    });

    (projectData.products || []).forEach((p, i) => {
      if (!p.addedAt) return;
      events.push({
        id: `act-product-${p.sku || p.id || 'x'}-${i}`, ...me, ts: p.addedAt,
        text: (
          <>
            Added <strong>{p.name}</strong> to{' '}
            {p.roomId ? roomLabel(projectData.rooms, p.roomId) : 'products'}
          </>
        ),
      });
    });

    team.forEach((m) => {
      if (!m.addedAt) return;
      events.push({
        id: `act-team-${m.connectionId}`, ...me, ts: m.addedAt,
        text: (
          <>
            Added <strong>{m.name}</strong>{' '}
            {m.role ? `as ${String(m.role).toLowerCase()}` : 'to the team'}
          </>
        ),
      });
    });

    comments.forEach((c) => {
      const isPersona = !!c.authorIdentity;
      events.push({
        id: `act-post-${c.id}`,
        name: isPersona ? c.author : me.name,
        initials: isPersona
          ? (c.authorInitials || String(c.author || '').slice(0, 2).toUpperCase())
          : me.initials,
        type: isPersona ? c.authorRole : 'tradepro',
        ts: c.createdAt,
        text: c.private ? <>Added a private note</> : <>Posted in the discussion</>,
      });
    });

    if (record?.createdAt) {
      events.push({ id: 'act-created', ...me, ts: record.createdAt, text: <>Created this project</> });
    }

    return events.filter((e) => e.ts).sort((a, b) => b.ts - a.ts);
  }, [projectId, projectList, projectData, team, comments, userName]);

  // Unread = activity since the last time this project's Activity tab was open.
  // (Previously a hardcoded literal 3, which was true of no project.)
  const activitySeenKey = projectId ? `ps-activity-seen-${projectId}` : null;
  const [activitySeenAt, setActivitySeenAt] = useState(0);
  useEffect(() => {
    if (!activitySeenKey) return;
    setActivitySeenAt(Number(localStorage.getItem(activitySeenKey) || 0));
  }, [activitySeenKey]);

  const unreadActivity = activity.filter((e) => e.ts > activitySeenAt).length;

  // Mark as read once the user has actually sat on the tab for a moment.
  useEffect(() => {
    if (activeTab !== 'activity' || !activitySeenKey || !activity.length) return;
    const newest = activity[0].ts;
    if (newest <= activitySeenAt) return;
    const t = setTimeout(() => {
      localStorage.setItem(activitySeenKey, String(newest));
      setActivitySeenAt(newest);
    }, 600);
    return () => clearTimeout(t);
  }, [activeTab, activity, activitySeenAt, activitySeenKey]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'products', label: 'Products', icon: ShoppingCart, count: products.length || null },
    { id: 'designs', label: 'Designs', icon: Palette },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'estimates', label: 'Estimates & Orders', icon: FileText },
    { id: 'activity', label: 'Activity', icon: Bell, count: unreadActivity || null },
  ];

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
    // Project Header
    projectHeader: {
      background: colors.gray100,
      borderRadius: 8,
      padding: '20px 24px',
      marginBottom: 24,
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 12,
    },
    breadcrumb: {
      fontSize: 13,
      color: colors.gray500,
      marginBottom: 8,
    },
    breadcrumbLink: {
      color: colors.darkBlue,
      textDecoration: 'none',
      cursor: 'pointer',
    },
    projectTitle: {
      fontSize: 28,
      fontWeight: 700,
      color: colors.gray900,
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    editLink: {
      fontSize: 14,
      color: colors.darkBlue,
      textDecoration: 'none',
      cursor: 'pointer',
      fontWeight: 500,
    },
    projectMeta: {
      display: 'flex',
      gap: 24,
      flexWrap: 'wrap',
    },
    metaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: colors.gray700,
    },
    statusBadge: (status) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
      background: status === 'working' ? '#e3f2fd' : status === 'complete' ? '#fff3cd' : '#e8f5e9',
      color: status === 'working' ? colors.darkBlue : status === 'complete' ? '#856404' : colors.green,
    }),
    statusDot: (status) => ({
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: status === 'working' ? colors.darkBlue : status === 'complete' ? '#856404' : colors.green,
    }),
    headerActions: {
      display: 'flex',
      gap: 12,
    },
    btnPrimary: {
      padding: '12px 24px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    btnOutline: {
      padding: '12px 24px',
      background: '#fff',
      color: colors.gray700,
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    btnSuccess: {
      padding: '12px 24px',
      background: colors.green,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    btnSmall: {
      padding: '8px 16px',
      fontSize: 13,
    },
    moreBtn: {
      padding: '10px 12px',
      background: '#fff',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.gray500,
    },
    moreMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 4,
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: 180,
      zIndex: 100,
      overflow: 'hidden',
    },
    moreMenuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '12px 16px',
      border: 'none',
      background: 'none',
      fontSize: 14,
      color: colors.gray700,
      cursor: 'pointer',
      textAlign: 'left',
    },
    // Tabs
    tabNav: {
      display: 'flex',
      gap: 4,
      borderBottom: `2px solid ${colors.gray200}`,
      marginBottom: 32,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
    },
    tab: (isActive) => ({
      padding: '14px 20px',
      border: 'none',
      background: 'none',
      fontSize: 14,
      fontWeight: 500,
      color: isActive ? colors.darkBlue : colors.gray500,
      cursor: 'pointer',
      borderBottom: isActive ? `3px solid ${colors.darkBlue}` : '3px solid transparent',
      marginBottom: -2,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
    }),
    tabBadge: {
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
    // Layout
    twoColumn: {
      gap: 32,
    },
    mainColumn: {
      minWidth: 0,
    },
    sidebar: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    },
    // Cards
    card: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray200}`,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
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
      padding: 20,
    },
    // Team members
    teamGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
    },
    teamMember: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: colors.gray100,
      borderRadius: 8,
      minWidth: 200,
    },
    avatar: (size = 40) => ({
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.darkBlue} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 600,
      fontSize: size * 0.4,
    }),
    avatarImg: (size = 40) => ({
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover',
    }),
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
    },
    memberRole: {
      fontSize: 12,
      color: colors.gray500,
    },
    // Activity feed
    activityList: {
      display: 'flex',
      flexDirection: 'column',
    },
    activityItem: {
      display: 'flex',
      gap: 12,
      padding: '16px 0',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    activityContent: {
      flex: 1,
    },
    activityText: {
      fontSize: 14,
      color: colors.gray700,
      marginBottom: 4,
      lineHeight: 1.5,
    },
    activityTime: {
      fontSize: 12,
      color: colors.gray500,
    },
    activityAction: {
      alignSelf: 'center',
    },
    // Products grid
    productsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 20,
    },
    productCard: {
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    productImage: {
      width: '100%',
      height: 160,
      background: colors.gray100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    productInfo: {
      padding: 16,
    },
    productName: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    productMeta: {
      fontSize: 13,
      color: colors.gray500,
    },
    // Empty states
    emptyState: {
      padding: 48,
      textAlign: 'center',
      background: '#fff',
      borderRadius: 8,
      border: `1px solid ${colors.gray200}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'center',
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
      maxWidth: 400,
      margin: '0 auto 20px',
    },
    // Discussion
    commentBox: {
      flex: 1,
      padding: 16,
      border: `1px solid ${colors.gray300}`,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: 'inherit',
      minHeight: 80,
      resize: 'vertical',
    },
    privateCheck: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: colors.gray500,
    },
    // Form inputs
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      color: colors.gray500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: 6,
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
    },
    formSelect: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
      background: '#fff',
      cursor: 'pointer',
    },
    formTextarea: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
      minHeight: 80,
      resize: 'vertical',
    },
    formRow: {
      gap: 16,
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.gray500,
    },
    detailValue: {
      fontSize: 14,
      color: colors.gray900,
      fontWeight: 500,
      textAlign: 'right',
    },
    // Rooms
    roomRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: colors.gray100,
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
    },
    roomIconBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: colors.gray500,
      display: 'flex',
      alignItems: 'center',
      padding: 4,
    },
    roomSuggestion: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 12px',
      background: '#fff',
      color: colors.gray700,
      border: `1px solid ${colors.gray300}`,
      borderRadius: 999,
      fontSize: 13,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s ease',
    },
    // Products
    roomGroupHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '0 0 12px',
      paddingBottom: 8,
      borderBottom: `1px solid ${colors.gray200}`,
    },
    roomGroupTitle: {
      fontSize: 15,
      fontWeight: 600,
      color: colors.gray900,
      margin: 0,
    },
    roomGroupCount: {
      fontSize: 12,
      color: colors.gray500,
    },
    productSelect: {
      width: '100%',
      padding: '6px 8px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 12,
      fontFamily: 'inherit',
      background: '#fff',
      cursor: 'pointer',
      color: colors.gray700,
    },
    qtyBtn: {
      width: 28,
      height: 28,
      border: `1px solid ${colors.gray300}`,
      background: '#fff',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.gray700,
      padding: 0,
    },
    // Inspiration grid
    inspirationGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 12,
    },
    inspirationItem: {
      aspectRatio: '1',
      background: colors.gray100,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      border: `2px dashed ${colors.gray300}`,
      transition: 'all 0.15s ease',
    },
  };

  // One saved product line. `index` is its position in projectData.products,
  // and that's the handle every edit writes back through.
  const renderProductCard = (product, index) => (
    <div key={`${index}-${product.sku || product.id}`} style={{ ...styles.productCard, cursor: 'default' }}>
      <div style={styles.productImage}>
        {product.image ? (
          <img
            src={product.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Image size={48} color={colors.gray300} />
        )}
      </div>
      <div style={styles.productInfo}>
        <div style={styles.productName}>
          {product.isSample && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: colors.darkBlue, background: '#e3f2fd',
              padding: '2px 6px', borderRadius: 3, marginRight: 6,
            }}>SAMPLE</span>
          )}
          {product.name}
        </div>
        <div style={styles.productMeta}>
          {[product.category, product.colorName].filter(Boolean).join(' • ') || 'No details'}
        </div>
        <div style={{ fontSize: 13, color: colors.gray700, marginTop: 6 }}>
          {product.isSample
            ? 'Product sample'
            : product.price != null
              ? `List: $${Number(product.price).toFixed(2)}${product.unit ? ` /${product.unit}` : ''}`
              : 'To be quoted'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 10px' }}>
          <button
            style={styles.qtyBtn}
            title="Decrease quantity"
            onClick={() => changeProductQty(index, -1)}
          ><Minus size={13} /></button>
          <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, color: colors.gray900 }}>
            {product.qty || 1}
          </span>
          <button
            style={styles.qtyBtn}
            title="Increase quantity"
            onClick={() => changeProductQty(index, 1)}
          ><Plus size={13} /></button>
          <button
            style={{ ...styles.qtyBtn, marginLeft: 'auto', borderColor: colors.red, color: colors.red }}
            title={`Remove ${product.name} from this project`}
            onClick={() => removeProduct(index)}
          ><Trash2 size={13} /></button>
        </div>

        <select
          style={styles.productSelect}
          value={product.roomId || ''}
          onChange={(e) => moveProduct(index, e.target.value)}
          title="Move to a room"
        >
          <option value="">Unassigned</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Project Header */}
        <div style={styles.projectHeader}>
          <div style={styles.headerTop}>
            <div>
              <div style={styles.breadcrumb}>
                <Link to="/projects" style={styles.breadcrumbLink}>← Back to My Projects</Link>
              </div>
              {editingTitle ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    autoFocus
                    value={projectData.name}
                    onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { setEditingTitle(false); persistProject(); }
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    style={{
                      fontSize: 26, fontWeight: 700, color: colors.gray900,
                      padding: '4px 8px', border: `2px solid ${colors.darkBlue}`,
                      borderRadius: 6, outline: 'none', minWidth: 320,
                    }}
                  />
                  <button
                    style={{ ...styles.btnPrimary, ...styles.btnSmall }}
                    onClick={() => { setEditingTitle(false); persistProject(); }}
                  >Save</button>
                  <button
                    style={{ ...styles.btnOutline, ...styles.btnSmall }}
                    onClick={() => setEditingTitle(false)}
                  >Cancel</button>
                </div>
              ) : (
                <h1
                  className="group"
                  style={{ ...styles.projectTitle, cursor: 'pointer' }}
                  title="Click to rename"
                  onClick={() => setEditingTitle(true)}
                >
                  {projectData.name}
                  <Pencil
                    size={16}
                    className="opacity-0 group-hover:opacity-40 transition-opacity"
                  />
                </h1>
              )}
              <div style={styles.projectMeta}>
                <div style={styles.metaItem}>
                  <span style={styles.statusBadge(projectStatus)}>
                    <span style={styles.statusDot(projectStatus)} />
                    {projectStatus === 'working' ? 'Working' : 
                     projectStatus === 'complete' ? 'Complete' : 'Published'}
                  </span>
                </div>
                <div style={styles.metaItem}>
                  <MapPin size={14} /> <strong>ProSource of St. Louis</strong>
                </div>
                <div style={styles.metaItem}>
                  <Calendar size={14} /> Last updated Dec 18, 2025
                </div>
              </div>
            </div>
            <div style={styles.headerActions}>
              {/* Contextual Status Button */}
              {projectStatus === 'working' && (
                <button 
                  style={styles.btnPrimary}
                  onClick={() => setProjectStatus('complete')}
                >
                  <Check size={16} /> Mark Complete
                </button>
              )}
              {projectStatus === 'complete' && (
                <button 
                  style={styles.btnSuccess}
                  onClick={() => setProjectStatus('published')}
                >
                  <ArrowRight size={16} /> Publish Project
                </button>
              )}
              {projectStatus === 'published' && (
                <button 
                  style={styles.btnOutline}
                  onClick={() => setProjectStatus('complete')}
                >
                  Unpublish
                </button>
              )}
              
              {/* More Menu */}
              <div style={{ position: 'relative' }}>
                <button 
                  style={styles.moreBtn}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                >
                  <MoreHorizontal size={20} />
                </button>
                {showMoreMenu && (
                  <div style={styles.moreMenu}>
                    <button
                      style={styles.moreMenuItem}
                      onClick={() => { setArchived(true); setShowMoreMenu(false); }}
                      onMouseOver={(e) => e.currentTarget.style.background = colors.gray100}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <Archive size={16} /> {archived ? 'Unarchive Project' : 'Archive Project'}
                    </button>
                    <button
                      style={{ ...styles.moreMenuItem, color: colors.red }}
                      onClick={() => { setDeleteConfirmOpen(true); setShowMoreMenu(false); }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={16} /> Delete Project
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="scrollbar-hide" style={styles.tabNav}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={styles.tab(activeTab === tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count && <span style={styles.tabBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px]" style={styles.twoColumn}>
            <div style={styles.mainColumn}>
              {/* Project Details */}
              <div style={{ ...styles.card, marginBottom: 24 }}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Project Details</h3>
                  {!isEditingDetails ? (
                    <button
                      style={{ ...styles.btnOutline, ...styles.btnSmall }}
                      onClick={() => { setSnapshot(projectData); setIsEditingDetails(true); }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={{ ...styles.btnOutline, ...styles.btnSmall }}
                        onClick={() => {
                          // Rooms + products are edited outside this buffer and
                          // persist on their own, so don't roll them back here.
                          if (snapshot) {
                            setProjectData((current) => ({
                              ...snapshot,
                              rooms: current.rooms,
                              products: current.products,
                            }));
                          }
                          setSnapshot(null);
                          setIsEditingDetails(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        style={{ ...styles.btnPrimary, ...styles.btnSmall, opacity: saving ? 0.6 : 1 }}
                        disabled={saving}
                        onClick={async () => {
                          await persistProject();
                          setSnapshot(null);
                          setIsEditingDetails(false);
                        }}
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={styles.cardBody}>
                  {!isEditingDetails ? (
                    /* View Mode */
                    <div>
                      {/* Description */}
                      {projectData.description ? (
                        <p style={{ fontSize: 14, color: colors.gray700, margin: '0 0 20px', lineHeight: 1.6 }}>
                          {projectData.description}
                        </p>
                      ) : (
                        <p style={{ fontSize: 14, color: colors.gray500, fontStyle: 'italic', margin: '0 0 20px' }}>
                          No description added yet. Click Edit to add project details.
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24 }}>
                        <div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Project Type</span>
                            <span style={styles.detailValue}>{projectData.type}</span>
                          </div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Budget Range</span>
                            <span style={styles.detailValue}>{projectData.budgetRange}</span>
                          </div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Square Footage</span>
                            <span style={styles.detailValue}>{projectData.squareFootage} sq ft</span>
                          </div>
                        </div>
                        <div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Target Start</span>
                            <span style={styles.detailValue}>
                              {projectData.targetStart
                                ? new Date(projectData.targetStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : <span style={{ color: colors.gray500 }}>Not set</span>}
                            </span>
                          </div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Target Completion</span>
                            <span style={styles.detailValue}>
                              {projectData.targetCompletion
                                ? new Date(projectData.targetCompletion).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : <span style={{ color: colors.gray500 }}>Not set</span>}
                            </span>
                          </div>
                          <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
                            <span style={styles.detailLabel}>Property Address</span>
                            <span style={{ ...styles.detailValue, maxWidth: 180 }}>{projectData.address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Rooms live in their own card below. They're real
                          entities now, not a checkbox tag list. */}

                      {/* Notes */}
                      {projectData.notes && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.gray200}` }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', marginBottom: 10 }}>
                            Notes
                          </div>
                          <p style={{ fontSize: 14, color: colors.gray700, margin: 0, background: colors.gray100, padding: 12, borderRadius: 6 }}>
                            {projectData.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Project Description</label>
                        <textarea 
                          style={styles.formTextarea}
                          placeholder="Describe the project scope, goals, and any important details..."
                          value={projectData.description}
                          onChange={(e) => setProjectData({...projectData, description: e.target.value})}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2" style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Project Type</label>
                          <select 
                            style={styles.formSelect}
                            value={projectData.type}
                            onChange={(e) => setProjectData({...projectData, type: e.target.value})}
                          >
                            {PROJECT_TYPE_VALUES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Budget Range</label>
                          <select 
                            style={styles.formSelect}
                            value={projectData.budgetRange}
                            onChange={(e) => setProjectData({...projectData, budgetRange: e.target.value})}
                          >
                            {BUDGET_RANGES.map(range => (
                              <option key={range} value={range}>{range}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2" style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Target Start Date</label>
                          <input 
                            type="date" 
                            style={styles.formInput}
                            value={projectData.targetStart}
                            onChange={(e) => setProjectData({...projectData, targetStart: e.target.value})}
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Target Completion Date</label>
                          <input 
                            type="date" 
                            style={styles.formInput}
                            value={projectData.targetCompletion}
                            onChange={(e) => setProjectData({...projectData, targetCompletion: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2" style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Square Footage</label>
                          <input 
                            type="text" 
                            style={styles.formInput}
                            placeholder="e.g., 180"
                            value={projectData.squareFootage}
                            onChange={(e) => setProjectData({...projectData, squareFootage: e.target.value})}
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Property Address</label>
                          <input 
                            type="text" 
                            style={styles.formInput}
                            placeholder="Where is the project located?"
                            value={projectData.address}
                            onChange={(e) => setProjectData({...projectData, address: e.target.value})}
                          />
                        </div>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Notes (access info, pets, scheduling preferences)</label>
                        <textarea 
                          style={{ ...styles.formTextarea, minHeight: 60 }}
                          placeholder="Any special instructions or notes for the team..."
                          value={projectData.notes}
                          onChange={(e) => setProjectData({...projectData, notes: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rooms & Areas: real entities. Products hang off these. */}
              <div style={{ ...styles.card, marginBottom: 24 }}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Rooms &amp; Areas</h3>
                  <span style={{ fontSize: 13, color: colors.gray500 }}>
                    {rooms.length > 0
                      ? `${rooms.length} room${rooms.length !== 1 ? 's' : ''}`
                      : 'None yet'}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  {rooms.length === 0 ? (
                    <p style={{ fontSize: 14, color: colors.gray500, fontStyle: 'italic', margin: '0 0 16px' }}>
                      No rooms yet. Add the spaces you're working on to organize products by room.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {rooms.map((room) => {
                        const attached = countProductsInRoom(products, room.id);
                        const isRenaming = renamingRoomId === room.id;
                        return (
                          <div key={room.id} style={styles.roomRow}>
                            <Home size={16} color={colors.darkBlue} />
                            {isRenaming ? (
                              <input
                                autoFocus
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onBlur={() => commitRename(room.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename(room.id);
                                  if (e.key === 'Escape') setRenamingRoomId(null);
                                }}
                                style={{
                                  flex: 1, fontSize: 14, fontWeight: 600, color: colors.gray900,
                                  padding: '4px 8px', border: `2px solid ${colors.darkBlue}`,
                                  borderRadius: 6, outline: 'none', fontFamily: 'inherit',
                                }}
                              />
                            ) : (
                              <>
                                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: colors.gray900 }}>
                                  {room.name}
                                </span>
                                <span style={{ fontSize: 12, color: colors.gray500 }}>
                                  {attached > 0
                                    ? `${attached} product${attached !== 1 ? 's' : ''}`
                                    : 'No products'}
                                </span>
                                <button
                                  title={`Rename ${room.name}`}
                                  onClick={() => { setRenamingRoomId(room.id); setRenameDraft(room.name); }}
                                  style={styles.roomIconBtn}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  title={`Remove ${room.name}`}
                                  onClick={() => removeRoom(room)}
                                  style={{ ...styles.roomIconBtn, color: colors.red }}
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addRoom(newRoomName); }}
                      placeholder="Add a room, any name works"
                      style={{ ...styles.formInput, flex: 1 }}
                    />
                    <button
                      onClick={() => addRoom(newRoomName)}
                      style={{
                        ...styles.btnPrimary, ...styles.btnSmall,
                        opacity: newRoomName.trim() ? 1 : 0.5,
                        cursor: newRoomName.trim() ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                      disabled={!newRoomName.trim()}
                    >
                      <Plus size={14} /> Add Room
                    </button>
                  </div>

                  {ROOM_OPTIONS.some((o) => !rooms.some((r) => r.name.toLowerCase() === o.toLowerCase())) && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        Quick add
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ROOM_OPTIONS
                          .filter((option) => !rooms.some((r) => r.name.toLowerCase() === option.toLowerCase()))
                          .map((option) => (
                            <button
                              key={option}
                              onClick={() => addRoom(option)}
                              style={styles.roomSuggestion}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = colors.darkBlue; e.currentTarget.style.color = colors.darkBlue; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = colors.gray300; e.currentTarget.style.color = colors.gray700; }}
                            >
                              <Plus size={12} /> {option}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Discussion */}
              <div style={{ ...styles.card, marginBottom: 24 }}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Discussion</h3>
                  <span style={{ fontSize: 13, color: colors.gray500 }}>
                    {comments.length > 0 ? `${comments.length} message${comments.length !== 1 ? 's' : ''}` : 'None yet'}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  {/* New comment input */}
                  <textarea
                    style={{ ...styles.commentBox, width: '100%', marginBottom: 12 }}
                    placeholder="Add a comment or update..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                    <label style={styles.privateCheck}>
                      <input
                        type="checkbox"
                        checked={commentIsPrivate}
                        onChange={(e) => setCommentIsPrivate(e.target.checked)}
                      />
                      <span>Make this message private (visible only to select users)</span>
                    </label>
                    <div className="flex gap-3 shrink-0">
                      <button className="whitespace-nowrap" style={{ ...styles.btnOutline, ...styles.btnSmall }}>
                        <Paperclip size={14} /> Attach File
                      </button>
                      <button
                        className="whitespace-nowrap"
                        style={{
                          ...styles.btnPrimary, ...styles.btnSmall,
                          opacity: !commentText.trim() || postingComment ? 0.6 : 1,
                          cursor: !commentText.trim() || postingComment ? 'not-allowed' : 'pointer',
                        }}
                        onClick={!commentText.trim() || postingComment ? undefined : postComment}
                      >
                        {postingComment ? 'Posting…' : 'Post Comment'}
                      </button>
                    </div>
                  </div>

                  {/* Live thread: the member's posts and their team's replies. */}
                  {(comments.length > 0 || typingResponder) && (
                    <div style={{ borderTop: `1px solid ${colors.gray200}`, paddingTop: 24, marginBottom: 24 }}>
                      {/* Newest first, so the reply being typed belongs at the top. */}
                      {typingResponder && (
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                          <div style={commentAvatarStyle(typingResponder.type)}>{typingResponder.initials}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>{typingResponder.name}</span>
                              <span style={{ fontSize: 12, color: colors.gray500 }}>is typing…</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22 }}>
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="animate-pulse"
                                  style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: colors.gray500,
                                    animationDelay: `${i * 0.2}s`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {comments.slice().reverse().map((c) => {
                        // No authorIdentity => the member's own post. Stored
                        // comments predate personas and land here too.
                        const isPersona = !!c.authorIdentity;
                        const name = isPersona ? c.author : (userName || 'You');
                        const badge = memberBadgeStyle(isPersona ? c.authorRole : 'tradepro');
                        return (
                        <div key={c.id} style={{
                          display: 'flex', gap: 12, marginBottom: 24,
                          ...(c.private ? {
                            padding: 16,
                            background: '#fffbeb',
                            borderRadius: 8,
                            border: '1px solid #fde68a',
                            marginLeft: -16,
                            marginRight: -16,
                          } : {}),
                        }}>
                          <div style={commentAvatarStyle(isPersona ? c.authorRole : 'tradepro')}>
                            {isPersona
                              ? (c.authorInitials || name.slice(0, 2).toUpperCase())
                              : name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>{name}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: badge.color, background: badge.background,
                                padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                              }}>{badge.label}</span>
                              {isPersona && c.authorTitle && (
                                <span style={{ fontSize: 12, color: colors.gray500 }}>{c.authorTitle}</span>
                              )}
                              {c.private && (
                                <span style={{
                                  fontSize: 11, fontWeight: 600,
                                  color: '#92400e', background: '#fef3c7',
                                  padding: '2px 8px', borderRadius: 4,
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}><Lock size={12} /> PRIVATE</span>
                              )}
                              <span style={{ fontSize: 12, color: colors.gray500 }}>{formatCommentDate(c.createdAt)}</span>
                            </div>
                            <p style={{ fontSize: 14, color: colors.gray700, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {c.body}
                            </p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state when no comments exist yet. */}
                  {comments.length === 0 && !typingResponder && (
                    <div style={{
                      borderTop: `1px solid ${colors.gray200}`,
                      paddingTop: 32, paddingBottom: 16,
                      textAlign: 'center', color: colors.gray500, fontSize: 13,
                    }}>
                      No comments yet. Start the conversation above.
                    </div>
                  )}

                  {/* Sample messages, kept in the source for visual reference
                      but rendered behind an opt-in flag that we never enable in
                      production. */}
                  {false && (
                  <div style={{ borderTop: `1px solid ${colors.gray200}`, paddingTop: 24 }}>
                    {/* Client comment */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                      <div style={{ 
                        ...styles.avatar(40), 
                        background: `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)` 
                      }}>BB</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>Bubba Beans</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: colors.green,
                            background: '#dcfce7',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}>CLIENT</span>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Dec 19, 2025 at 9:15 AM</span>
                        </div>
                        <p style={{ fontSize: 14, color: colors.gray700, margin: 0, lineHeight: 1.6 }}>
                          Love the knob selection! My wife and I were just discussing this last night. Can we also look at some matching drawer pulls?
                        </p>
                      </div>
                    </div>

                    {/* Account Manager comment */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                      <div style={styles.avatar(40)}>KM</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>Kim Marks</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: colors.darkBlue,
                            background: '#e3f2fd',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}>PROSOURCE</span>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Dec 18, 2025 at 2:34 PM</span>
                        </div>
                        <p style={{ fontSize: 14, color: colors.gray700, margin: 0, lineHeight: 1.6 }}>
                          Absolutely! I'll put together some drawer pull options that match the polished nickel finish. I'll have those added to the project by end of day.
                        </p>
                      </div>
                    </div>

                    {/* Trade Pro comment with file attachment */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                      <div style={{ 
                        ...styles.avatar(40), 
                        background: `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)` 
                      }}>SQ</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>Suzie Q Snowflake</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: colors.red,
                            background: '#fee2e2',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}>TRADE PRO</span>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Dec 17, 2025 at 10:15 AM</span>
                        </div>
                        <p style={{ fontSize: 14, color: colors.gray700, margin: '0 0 12px', lineHeight: 1.6 }}>
                          Here's the floor plan from the client. They want to keep the island but are open to changing the cabinet layout on the north wall.
                        </p>
                        {/* File attachment */}
                        <div style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 10, 
                          padding: '10px 14px', 
                          background: colors.gray100, 
                          borderRadius: 6,
                          border: `1px solid ${colors.gray200}`,
                        }}>
                          <FileText size={20} color={colors.gray500} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: colors.gray900 }}>kitchen-floorplan.pdf</div>
                            <div style={{ fontSize: 11, color: colors.gray500 }}>245 KB</div>
                          </div>
                          <a style={{ fontSize: 12, color: colors.darkBlue, marginLeft: 8, cursor: 'pointer' }}>Download</a>
                        </div>
                      </div>
                    </div>

                    {/* Private message between Trade Pro and Account Manager */}
                    <div style={{ 
                      display: 'flex', 
                      gap: 12, 
                      marginBottom: 24, 
                      padding: 16, 
                      background: '#fffbeb', 
                      borderRadius: 8,
                      border: `1px solid #fde68a`,
                      marginLeft: -16,
                      marginRight: -16,
                    }}>
                      <div style={{ 
                        ...styles.avatar(40), 
                        background: `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)` 
                      }}>SQ</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>Suzie Q Snowflake</span>
                          <span style={{ 
                            fontSize: 11, 
                            fontWeight: 600,
                            color: '#92400e', 
                            background: '#fef3c7',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}><Lock size={12} style={{ marginRight: 4 }} /> PRIVATE</span>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Dec 16, 2025 at 4:22 PM</span>
                        </div>
                        <p style={{ fontSize: 14, color: colors.gray700, margin: 0, lineHeight: 1.6 }}>
                          Kim - heads up, the client has a tight budget (~$8k for cabinets). Let's try to keep recommendations in that range. Don't mention this to them directly.
                        </p>
                        <div style={{ fontSize: 12, color: colors.gray500, marginTop: 8 }}>
                          Visible to: Kim Marks, Heather Yager, Suzie Q Snowflake
                        </div>
                      </div>
                    </div>

                    {/* Designer comment with image attachment */}
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={styles.avatar(40)}>HY</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>Heather Yager</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: colors.darkBlue,
                            background: '#e3f2fd',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}>PROSOURCE</span>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Dec 15, 2025 at 11:00 AM</span>
                        </div>
                        <p style={{ fontSize: 14, color: colors.gray700, margin: '0 0 12px', lineHeight: 1.6 }}>
                          Welcome to the project! Here's a photo of the current kitchen for reference. I'll have some initial design concepts ready by next week.
                        </p>
                        {/* Image attachment */}
                        <div style={{ 
                          width: 200, 
                          height: 140, 
                          background: colors.gray200, 
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          <Home size={32} color={colors.gray400} />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '6px 10px',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            fontSize: 11,
                          }}>
                            current-kitchen.jpg
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>

              {/* Inspiration */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Inspiration Board</h3>
                  <div className="flex gap-2 shrink-0">
                    <button className="whitespace-nowrap" style={{ ...styles.btnOutline, ...styles.btnSmall }}>
                      Browse Gallery
                    </button>
                    <button className="whitespace-nowrap" style={{ ...styles.btnPrimary, ...styles.btnSmall }}>
                      + Add Photo
                    </button>
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.inspirationGrid}>
                    <div 
                      style={styles.inspirationItem}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = colors.darkBlue}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = colors.gray300}
                    >
                      <span style={{ color: colors.gray400, fontSize: 24 }}>+</span>
                    </div>
                    <div 
                      style={styles.inspirationItem}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = colors.darkBlue}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = colors.gray300}
                    >
                      <span style={{ color: colors.gray400, fontSize: 24 }}>+</span>
                    </div>
                    <div 
                      style={styles.inspirationItem}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = colors.darkBlue}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = colors.gray300}
                    >
                      <span style={{ color: colors.gray400, fontSize: 24 }}>+</span>
                    </div>
                    <div 
                      style={styles.inspirationItem}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = colors.darkBlue}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = colors.gray300}
                    >
                      <span style={{ color: colors.gray400, fontSize: 24 }}>+</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: colors.gray500, marginTop: 16, marginBottom: 0 }}>
                    Add photos from our inspiration gallery or upload your own. Collaborate with your team on the perfect look.
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div style={styles.sidebar}>
              {/* Team */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Project Team</h3>
                  <button
                    className="whitespace-nowrap"
                    onClick={() => setAddTeamOpen(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: colors.darkBlue, fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + Add
                  </button>
                </div>
                <div style={styles.cardBody}>
                  {team.length === 0 ? (
                    <div style={{ fontSize: 13, color: colors.gray500, textAlign: 'center', padding: '12px 0' }}>
                      No team members yet. Click + Add to bring people in.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {team.map((m) => {
                        const badge = memberBadgeStyle(m.type);
                        return (
                          <div
                            key={m.connectionId}
                            className="group"
                            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                          >
                            <div style={memberAvatarStyle(m.type)}>{m.initials}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={styles.memberName}>{m.name}</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 600,
                                  color: badge.color, background: badge.background,
                                  padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                                }}>{badge.label}</span>
                              </div>
                              <div style={styles.memberRole}>{m.role}</div>
                            </div>
                            <button
                              onClick={() => removeTeamMember(m.connectionId)}
                              title="Remove from team"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: colors.gray500, padding: 4,
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity: real events, newest 3. */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Recent Activity</h3>
                  {activity.length > 3 && (
                    <button
                      onClick={() => setActiveTab('activity')}
                      style={{
                        ...styles.editLink, fontSize: 13,
                        background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      View All
                    </button>
                  )}
                </div>
                <div style={{ ...styles.cardBody, padding: '0 20px' }}>
                  {activity.length === 0 ? (
                    <div style={{ fontSize: 13, color: colors.gray500, textAlign: 'center', padding: '16px 0' }}>
                      No activity yet.
                    </div>
                  ) : (
                    <div style={styles.activityList}>
                      {activity.slice(0, 3).map((item, i, arr) => (
                        <div
                          key={item.id}
                          style={{
                            ...styles.activityItem,
                            ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}),
                          }}
                        >
                          <div style={{
                            ...styles.avatar(32),
                            ...(item.type === 'prosource' ? {} : {
                              background: item.type === 'client'
                                ? `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`
                                : `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)`,
                            }),
                          }}>{item.initials}</div>
                          <div style={styles.activityContent}>
                            <div style={styles.activityText}>{item.text}</div>
                            <div style={styles.activityTime}>{formatCommentDate(item.ts)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Quick Actions</h3>
                </div>
                <div style={styles.cardBody}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button style={{ ...styles.btnPrimary, justifyContent: 'center', width: '100%' }}>
                      Request an Estimate
                    </button>
                    <button style={{ ...styles.btnOutline, justifyContent: 'center', width: '100%' }}>
                      Request Kitchen/Bath Design
                    </button>
                    <button style={{ ...styles.btnOutline, justifyContent: 'center', width: '100%' }}>
                      Browse Products
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0">
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Project Products</h2>
                <p style={{ color: colors.gray500, fontSize: 14, margin: '4px 0 0' }}>
                  Products you're considering for this project
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  className="whitespace-nowrap"
                  style={styles.btnOutline}
                  onClick={() => navigate('/shop')}
                >
                  <Plus size={14} /> Add Product
                </button>
                <button className="whitespace-nowrap" style={styles.btnPrimary}>Request Estimate</button>
              </div>
            </div>

            {products.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}><ShoppingCart size={48} color={colors.gray300} /></div>
                <h3 style={styles.emptyTitle}>No Products Yet</h3>
                <p style={styles.emptyText}>
                  Browse the catalog and save products to this project. They'll show up here
                  grouped by room so you can see exactly what's going where.
                </p>
                <button style={styles.btnPrimary} onClick={() => navigate('/shop')}>
                  Browse Products
                </button>
              </div>
            ) : (
              groupProductsByRoom(projectData).map(({ room, items }) => (
                <section key={room ? room.id : 'unassigned'} style={{ marginBottom: 32 }}>
                  <div style={styles.roomGroupHeader}>
                    <Home size={16} color={room ? colors.darkBlue : colors.gray500} />
                    <h3 style={styles.roomGroupTitle}>{room ? room.name : 'Unassigned'}</h3>
                    <span style={styles.roomGroupCount}>
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <div style={{ fontSize: 13, color: colors.gray500, fontStyle: 'italic' }}>
                      Nothing assigned to this room yet.
                    </div>
                  ) : (
                    <div style={styles.productsGrid}>
                      {items.map(({ product, index }) => renderProductCard(product, index))}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        )}

        {/* Designs Tab */}
        {activeTab === 'designs' && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}><Palette size={48} color={colors.gray300} /></div>
            <h3 style={styles.emptyTitle}>No Designs Yet</h3>
            <p style={styles.emptyText}>
              Your ProSource Kitchen & Bath Designer will upload amazing designs for you to see your space come to life. 
              When you need to access them during installation, you'll find them here.
            </p>
            <button style={styles.btnPrimary}>
              Request Kitchen or Bath Design
            </button>
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Project Photos</h2>
                <p style={{ color: colors.gray500, fontSize: 14, margin: '4px 0 0' }}>
                  Before, during, and after photos of your project
                </p>
              </div>
              <button style={styles.btnPrimary}>+ Add Photos</button>
            </div>

            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}><Camera size={48} color={colors.gray300} /></div>
              <h3 style={styles.emptyTitle}>No Photos Yet</h3>
              <p style={styles.emptyText}>
                Document your project progress! Add before photos now, then capture the transformation as work progresses.
              </p>
              <button style={styles.btnPrimary}>
                Upload Your First Photo
              </button>
            </div>
          </div>
        )}

        {/* Estimates & Orders Tab */}
        {activeTab === 'estimates' && (() => {
          const projectDocs = docsForProject(allOrderDocs, projectId).sort(byNewest);
          const estimates = projectDocs.filter(isEstimate);
          const orderDocs = projectDocs.filter((d) => !isEstimate(d));

          const docCard = (doc) => {
            const DocIcon = statusIcon(doc.status);
            const tone = statusTone(doc.status);
            return (
              <Link
                key={doc.id}
                to={`/orders/${doc.id}`}
                style={{
                  ...styles.card,
                  display: 'block',
                  padding: 16,
                  marginBottom: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: colors.gray900, marginBottom: 6 }}>
                      {doc.id}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: tone.bg, color: tone.fg,
                    }}>
                      {DocIcon && <DocIcon size={12} />} {customerStatusLabel(doc.status)}
                    </div>
                    <div style={{ fontSize: 13, color: colors.gray500, marginTop: 8 }}>
                      {isEstimate(doc) ? 'Quoted' : 'Ordered'} {doc.orderDate || '--'}
                      {doc.lineItems.length > 0 && ` · ${doc.lineItems.length} line ${doc.lineItems.length === 1 ? 'item' : 'items'}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: colors.gray500, textTransform: 'uppercase', marginBottom: 2 }}>
                      {headlineLabel(doc)}
                    </div>
                    <div style={{
                      fontSize: 17, fontWeight: 700,
                      color: isEstimate(doc)
                        ? colors.gray900
                        : doc.balanceDue > 0 ? colors.red : colors.green,
                    }}>
                      {money(headlineAmount(doc))}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: colors.darkBlue, marginTop: 8 }}>
                      View details <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          };

          const section = (title, list) => (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.gray700, margin: '0 0 12px' }}>
                {title} ({list.length})
              </h3>
              {list.map(docCard)}
            </div>
          );

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Estimates & Orders</h2>
                  <p style={{ color: colors.gray500, fontSize: 14, margin: '4px 0 0' }}>
                    Track all estimates and orders for this project
                  </p>
                </div>
                {/* Messaging the account manager IS how you request an estimate
                    here. There's no self-serve estimate endpoint, so this links
                    to the thing that actually works instead of a dead button. */}
                <Link to="/messages" style={{ ...styles.btnPrimary, textDecoration: 'none' }}>
                  Message your Account Manager
                </Link>
              </div>

              {ordersStatus === 'loading' && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><FileText size={40} color={colors.gray300} /></div>
                  <h3 style={styles.emptyTitle}>Loading…</h3>
                  <p style={styles.emptyText}>Fetching this project's estimates and orders.</p>
                </div>
              )}

              {ordersStatus === 'error' && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><FileText size={40} color={colors.gray300} /></div>
                  <h3 style={styles.emptyTitle}>Couldn't load estimates & orders</h3>
                  <p style={styles.emptyText}>{ordersError}</p>
                  <button onClick={reloadOrders} style={styles.btnOutline}>Try again</button>
                </div>
              )}

              {ordersStatus === 'ready' && projectDocs.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><FileText size={48} color={colors.gray300} /></div>
                  <h3 style={styles.emptyTitle}>No Estimates or Orders Yet</h3>
                  <p style={styles.emptyText}>
                    Ask your ProSource Account Manager to quote the products on this project. Approved quotes turn into orders and show up here.
                  </p>
                  <Link to="/messages" style={{ ...styles.btnPrimary, textDecoration: 'none' }}>
                    Message your Account Manager
                  </Link>
                </div>
              )}

              {ordersStatus === 'ready' && projectDocs.length > 0 && (
                <>
                  {estimates.length > 0 && section('Estimates', estimates)}
                  {orderDocs.length > 0 && section('Orders', orderDocs)}
                </>
              )}
            </div>
          );
        })()}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Project Activity</h2>
              <p style={{ color: colors.gray500, fontSize: 14, margin: '4px 0 0' }}>
                All updates and changes to this project
              </p>
            </div>

            {activity.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}><Bell size={40} color={colors.gray300} /></div>
                <h3 style={styles.emptyTitle}>No activity yet</h3>
                <p style={styles.emptyText}>
                  Rooms, products, team changes, and discussion posts all show up here.
                </p>
              </div>
            ) : (
              <div style={styles.card}>
                <div style={{ padding: 0 }}>
                  {/* Newest first, so the unread ones are exactly the first N. */}
                  {activity.map((item, i, arr) => {
                    const unread = i < unreadActivity;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          gap: 16,
                          padding: 20,
                          borderBottom: i < arr.length - 1 ? `1px solid ${colors.gray100}` : 'none',
                          borderLeft: unread ? `3px solid ${colors.darkBlue}` : '3px solid transparent',
                          background: unread ? '#fafbff' : '#fff',
                          alignItems: 'flex-start',
                          transition: 'background 0.3s ease, border-color 0.3s ease',
                        }}
                      >
                        <div style={{
                          ...styles.avatar(40),
                          ...(item.type === 'prosource' ? {} : {
                            background: item.type === 'client'
                              ? `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`
                              : `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)`,
                          }),
                        }}>{item.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: colors.gray700, marginBottom: 4 }}>
                            <strong>{item.name}</strong> {item.text}
                          </div>
                          <div style={{ fontSize: 13, color: colors.gray500 }}>{formatCommentDate(item.ts)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Project Confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-2" style={{ color: colors.gray900 }}>Delete this project?</h2>
            <p className="text-sm mb-5" style={{ color: colors.gray500 }}>
              <strong style={{ color: colors.gray700 }}>{projectData.name}</strong> and all of its photos, products, and discussion will be permanently removed. This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium"
                style={{ color: colors.gray700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >Cancel</button>
              <button
                onClick={async () => { setDeleteConfirmOpen(false); await deleteProject(); }}
                className="px-4 py-2 text-sm font-semibold rounded-md text-white"
                style={{ background: colors.red, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >Delete project</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {addTeamOpen && (() => {
        const taken = new Set(team.map((t) => t.connectionId));
        const available = connections.filter((c) => !taken.has(c.id));
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setAddTeamOpen(false)} />
            <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
                <h2 className="text-lg font-bold" style={{ color: colors.gray900 }}>Add to Project Team</h2>
                <button
                  onClick={() => setAddTeamOpen(false)}
                  aria-label="Close"
                  style={{ color: colors.darkBlue, background: 'none', border: 'none', cursor: 'pointer' }}
                ><X size={20} /></button>
              </div>
              <div className="px-5 py-3 flex-1 overflow-auto">
                {available.length === 0 ? (
                  <div style={{ padding: '32px 8px', textAlign: 'center', color: colors.gray500, fontSize: 14 }}>
                    {connections.length === 0
                      ? <>No connections yet. Add people from your <Link to="/connections" style={{ color: colors.darkBlue }}>connections list</Link> first.</>
                      : 'Everyone in your connections is already on this project.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {available.map((c) => {
                      const badge = memberBadgeStyle(c.type);
                      return (
                        <button
                          key={c.id}
                          onClick={() => addTeamMember(c)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: 10, border: `1px solid ${colors.gray200}`,
                            borderRadius: 8, background: '#fff', cursor: 'pointer',
                            textAlign: 'left', fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8faff'; e.currentTarget.style.borderColor = colors.darkBlue; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = colors.gray200; }}
                        >
                          <div style={memberAvatarStyle(c.type)}>{c.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <span style={{ fontWeight: 600, color: colors.gray900, fontSize: 14 }}>{c.name}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: badge.color, background: badge.background,
                                padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                              }}>{badge.label}</span>
                            </div>
                            <div style={{ fontSize: 12, color: colors.gray500 }}>{c.role}</div>
                          </div>
                          <Plus size={18} color={colors.darkBlue} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-neutral-200">
                <button
                  onClick={() => setAddTeamOpen(false)}
                  className="px-4 py-2 text-sm font-medium"
                  style={{ color: colors.gray700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Archived banner */}
      {archived && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-md shadow-xl flex items-center gap-3"
          style={{ background: colors.gray900, color: '#fff', fontSize: 14, maxWidth: 360 }}
        >
          <Archive size={16} />
          <span>Project archived</span>
          <button
            onClick={() => setArchived(false)}
            className="ml-2 underline"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          >Undo</button>
        </div>
      )}
    </div>
  );
}
