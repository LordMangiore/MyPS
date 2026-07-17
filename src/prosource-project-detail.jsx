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
  Trash2,
  ArrowRight,
  User,
  Eye,
  AlertCircle
} from 'lucide-react';
import {
  DEFAULT_PROJECT,
  PROJECT_TYPE_VALUES,
  BUDGET_RANGES,
  ROOM_OPTIONS,
  normalizeStored,
  makeRoom,
  removeRoomFromProject,
  groupProductsByRoom,
  roomLabel,
  moveProductToRoom,
  setProductQty,
  removeProductAt,
  countProductsInRoom,
  parseMoney,
  formatMoney,
  roomCostPerSqFt,
} from './project-model';
import { readUserBlob, writeUserBlob, loadMemberProjects } from './member-access';
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
  'Denise Okafor': 'demo-denise-okafor',
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
 *
 * `preferredName` breaks ties: a project on a multi-showroom account can have
 * two account managers on its team (its own showroom's, plus the primary's from
 * the default team selection), and both match the account-manager rule equally.
 * The one whose showroom is actually supplying the job is who would answer, so
 * name them and they win. Without a preference this picks the first match, which
 * is what it has always done.
 */
const pickResponder = (message, candidates, preferredName = null) => {
  if (!candidates.length) return null;
  const text = String(message || '').toLowerCase();
  const preferred = (list) =>
    (preferredName && list.find((c) => c.name === preferredName)) || list[0];
  const ranked = RESPONDER_RULES
    .map((rule) => ({ rule, score: scoreRule(text, rule.keywords) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const { rule } of ranked) {
    const hits = candidates.filter((c) => rule.matches(c));
    if (hits.length) return preferred(hits);
  }
  const managers = candidates.filter((c) => /account manager/i.test(c.role || ''));
  if (managers.length) return preferred(managers);
  return candidates.find((c) => c.type === 'prosource') || candidates[0];
};

export default function ProjectDetailPage() {
  const { loadUserData, saveUserData, userId, userName, userType, accountManager, showrooms } = useAuth();
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

  // -------- Whose project is this --------

  /**
   * A project id does not say whose it is.
   *
   * Ids are unique within an account, not across the app, and the record lives
   * in one account's blob (`${userId}::projects`). For everyone who has ever
   * opened this page that owner was implicitly the signed-in user, which is why
   * `loadUserData` was enough. An account manager breaks that assumption: she
   * owns no projects, and the ones she needs to read belong to her members.
   *
   * So the owner rides in the URL as `?owner=<userId>`, and the account manager's
   * list is the only thing that produces such a link. No param means the old
   * meaning exactly: this is mine. That keeps every member URL, bookmark and
   * redirect working unchanged, and it survives a refresh, which a bit of
   * router state handed over on navigation would not.
   */
  const ownerParam = searchParams.get('owner');
  const ownerId = ownerParam || userId;
  /**
   * Viewing someone else's project. Note this is derived from the data, not from
   * the role: an owner param naming yourself is still your own project, so a
   * stray `?owner=` on a member's own URL cannot lock them out of their work.
   */
  const isGuest = !!ownerId && !!userId && ownerId !== userId;
  const canEdit = !isGuest;
  const isAccountManager = userType === 'accountmanager';
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
    if (routeId === 'new' && canEdit) {
      setEditingTitle(true);
      setIsEditingDetails(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, canEdit]);

  const [projectData, setProjectData] = useState(DEFAULT_PROJECT);
  const [projectList, setProjectList] = useState([]); // full collection
  const [loadedProject, setLoadedProject] = useState(false);

  // A guest's read can genuinely fail (it is a bare fetch at another account's
  // blob), and a failure is not an empty project. The member path cannot reach
  // these: loadUserData swallows its own errors and always resolves.
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Load persisted projects on mount, hydrate the one matching the URL :id.
  // For /projects/new (or no id) we stay on defaults until first save.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadError('');
    setNotFound(false);
    // The owner's blob, which for everyone but a guest is the signed-in user's,
    // read through the same helper it always was.
    const read = isGuest
      ? loadMemberProjects(ownerId)
      : loadUserData('projects', null).then(normalizeStored);
    read.then((list) => {
      if (cancelled) return;
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
        } else if (isGuest || isAccountManager) {
          // "Not found" is the honest answer here, and the only safe one. The
          // member fallback below turns an unresolved id into a brand-new draft,
          // which for an account manager would offer to create a project on an
          // account that holds none: an empty form where a colleague's job
          // should be. She reads projects, she does not start them.
          setNotFound(true);
        } else {
          // Bad id, so fall back to "new" behavior
          setProjectId(null);
        }
      }
      setLoadedProject(true);
    }).catch((err) => {
      if (cancelled) return;
      setLoadError(err.message || 'Could not load this project');
      setLoadedProject(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId, ownerId, isGuest]);

  // -------- Showroom --------

  /**
   * The showroom supplying this project, resolved from the account's list.
   *
   * The project stores only `showroomId`, so the name, address and account
   * manager shown here are always today's, not a copy frozen at creation.
   *
   * Resolves to null in two cases, both of which mean "we cannot name it":
   * projects created before projects carried a showroom (no `showroomId`), and
   * an id the account's list no longer contains. We say so rather than guess.
   * Falling back to the primary would put "ProSource of St. Louis" under a
   * Chicago project, which is the exact bug this replaced.
   */
  const projectShowroom = useMemo(
    () => (showrooms || []).find((s) => s.id === projectData.showroomId) || null,
    [showrooms, projectData.showroomId]
  );

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

  /**
   * Where the project collection is written, and read for a modify-write.
   *
   * The owner's account, always. For the owner that is the signed-in account
   * (saveUserData / loadUserData). For an account manager editing her member's
   * project it is the MEMBER, reached explicitly by userId, because saveUserData
   * is bound to whoever is signed in and would otherwise file her edits under her
   * own blob where the member would never see them. Same door the discussion
   * composer already opens (see postComment), generalized to project writes.
   */
  const persistProjectsList = (list) =>
    isGuest
      ? writeUserBlob(ownerId, 'projects', { list })
      : saveUserData('projects', { list });

  const loadProjectsList = async () =>
    normalizeStored(isGuest ? await readUserBlob(ownerId, 'projects') : await loadUserData('projects', null));

  /**
   * The content writes below refuse unless the viewer may edit the project:
   * the owner, or the account manager whose member's project this is
   * (canEditProject). They still refuse for a plain guest.
   *
   * The guard matters more than a hidden button, not less: these functions write
   * a whole `{ list }` blob back to an account, so the wrong caller does not
   * fail, it succeeds and overwrites. That is exactly why editing has to redirect
   * to the OWNER (persistProjectsList) rather than widen who writes the signed-in
   * blob. Archiving and deleting stay on `canEdit` (owner only): they are
   * destructive and the member's to make.
   */
  const persistProject = async (next = projectData) => {
    if (!userId || !canEditProject) return;
    setSaving(true);
    try {
      const { id, updatedList } = buildUpsertedList(next);
      await persistProjectsList(updatedList);
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
    if (!userId || !loadedProject || !canEditProject) return;
    if (!projectId) return; // brand-new draft, let the explicit save handle it
    if (
      lastPersistedStatus.current.status === projectStatus &&
      lastPersistedStatus.current.archived === archived
    ) return;
    lastPersistedStatus.current = { status: projectStatus, archived };
    const { updatedList } = buildUpsertedList(projectData, projectStatus, archived);
    // Status is a content edit the AM may make; `archived` only ever changes for
    // the owner (the archive control is owner-only), so this stays correct for
    // both. persistProjectsList sends it to the project's owner either way.
    persistProjectsList(updatedList)
      .then(() => setProjectList(updatedList))
      .catch((err) => console.warn('Project status save failed:', err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStatus, archived, loadedProject]);

  const deleteProject = async () => {
    if (!canEdit) return;
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

  /**
   * Something stable to key a team entry on.
   *
   * `connectionId` was that until the account manager joined a team, and hers is
   * null on purpose: nobody's connections list has her on it, so there is no id
   * to carry (see amTeamMember in netlify/functions/lib/seed.mjs). She brings a
   * `userId` instead. Members added through the picker have the id and no
   * userId, so between them one is always there.
   */
  const teamKey = (m) => m.connectionId ?? m.userId ?? m.name;

  /**
   * The account manager this header names.
   *
   * The team is asked first and the showroom is the fallback, because they can
   * disagree and when they do the team is the one that is right. A showroom has
   * one account manager on its record; a project has the one who is actually
   * working it, and for an account manager's own members those are now different
   * people (see castProjectTeam in netlify/functions/lib/seed.mjs). Reading the
   * showroom alone put "Kim Marks, Account Manager" at the top of a project whose
   * team panel, four inches to the right, said Tessa.
   *
   * The fallback still matters: a project whose team has no account manager on it
   * is a real state (anyone can remove one), and the showroom's is a better
   * answer than none.
   */
  const projectAccountManager = useMemo(() => {
    const onTeam = team.find((m) => m.role === 'Account Manager');
    if (onTeam) return { name: onTeam.name, title: onTeam.role };
    const fromShowroom = projectShowroom?.accountManager;
    return fromShowroom?.name
      ? { name: fromShowroom.name, title: fromShowroom.title }
      : null;
  }, [team, projectShowroom]);

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

  /**
   * Who this project belongs to, resolved from the viewer's own connections:
   * the owner param is a userId, and a connection carrying that userId is the
   * name attached to it. A guest reaches this project through her connections
   * in the first place, so the answer is already loaded.
   */
  const ownerConnection = useMemo(
    () => connections.find((c) => c.userId && c.userId === ownerId) || null,
    [connections, ownerId]
  );

  /**
   * The name to put on this project's history and posts.
   *
   * Everything on this page that is not a persona was written by the person
   * whose account holds the record, and the page used to be able to assume that
   * was the reader ("You"). For a guest it is not: crediting a member's rooms,
   * products and posts to the account manager reading them would be inventing a
   * history that never happened. Falls back to a neutral label rather than a
   * guess when the connection cannot be resolved.
   */
  const ownerName = isGuest
    ? (ownerConnection?.name || 'This member')
    : (userName || 'You');

  const persistTeam = async (nextTeam) => {
    if (!canEditProject) return;
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
      await persistProjectsList(overridden);
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
      ...amStamp(),
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

  /**
   * The signed-in account's own entry on this project's team, or null.
   *
   * A team entry carrying a `userId` is a real account rather than a name (see
   * amTeamMember in netlify/functions/lib/seed.mjs). Matching the signed-in one
   * against it answers "is the person reading this on this team, as themselves?"
   *
   * Asked of the data, deliberately, and not of the role. `userType ===
   * 'accountmanager'` would have been shorter and would have meant something
   * else: that any account manager may post on any project she can get the URL
   * for. Being on the team is the thing that is actually true about Tessa and
   * her own members, it is what the seed now says, and it is what stops this
   * from quietly becoming a role-wide permission the next time someone reads it.
   */
  const teamSelf = useMemo(
    () => team.find((m) => m.userId && m.userId === userId) || null,
    [team, userId]
  );

  /**
   * Who may write in this discussion: the owner, or a teammate who is a real
   * account. Everything else on this page stays owner-only.
   *
   * A guest who can post is a genuinely different thing from the owner posting,
   * and the difference is the whole reason this took a data-model change rather
   * than deleting a guard: her post has to go into the OWNER's blob (it is their
   * thread) and it has to carry her name (it is her sentence). Neither was true
   * of the composer before. See postComment.
   */
  const canPost = canEdit || !!teamSelf;

  /**
   * Who may edit the project's CONTENT: the owner, or the account manager whose
   * members' project this is (a guest who is on the team, as a real account, and
   * is showroom staff).
   *
   * Deliberately a separate flag from `canEdit`, not a widening of it. `canEdit`
   * stays owner-only and keeps meaning owner-only, because things hang off it
   * that must not change for a guest: a guest's post never triggers an AI reply
   * (postComment), and a guest has no private notes. Only the project-content
   * writes and their affordances move to this flag.
   *
   * CONTENT, not lifecycle. Archiving and deleting a member's project stay the
   * member's own call (`canEdit`), because they are destructive and they are the
   * member's to make. See the decision recorded in GAP-ANALYSIS.md.
   */
  const canEditProject = canEdit || (isGuest && !!teamSelf && isAccountManager);

  /**
   * Who to credit for a room or team member added right now.
   *
   * `{ addedBy }` naming the account manager when she is the one editing, and
   * `{}` (nothing) when the owner is, so an owner's own entries stay unstamped
   * exactly as every entry made before this was. The activity feed reads it: a
   * room Tessa adds to her member's project must not be credited to the member,
   * which is the same misattribution the authored-post shape fixed for the
   * discussion. Products are not added from this page (they come from the shop),
   * so only rooms and team carry it.
   */
  const amStamp = () =>
    isGuest && teamSelf
      ? { addedBy: { name: teamSelf.name, initials: teamSelf.initials, userId, type: teamSelf.type } }
      : {};

  useEffect(() => {
    if (!userId || !projectId) return;
    let cancelled = false;
    // The thread belongs to the project, so it comes out of the project owner's
    // blob. Reading the signed-in account's would show a guest her own empty
    // discussions under someone else's project and call it "no comments yet",
    // which is not a smaller truth, it is a false one.
    const read = isGuest
      ? readUserBlob(ownerId, 'discussions').catch(() => null)
      : loadUserData('discussions', null);
    read.then((stored) => {
      if (cancelled) return;
      const all = (stored && typeof stored === 'object') ? stored : {};
      setComments(Array.isArray(all[projectId]) ? all[projectId] : []);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId, ownerId, isGuest]);

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
   * posts are "them"; everything else is "user". Anyone else's post is
   * attributed inline so the responder doesn't read it as the member speaking:
   * another persona's, and equally a real teammate's, since a post signed by the
   * account manager is no more the member's words than Kim's are. Private notes
   * are left out, since they aren't visible to the team.
   */
  const buildReplyHistory = (thread, identity) =>
    thread
      .filter((c) => !c.private)
      .slice(-12)
      .map((c) =>
        c.authorIdentity === identity
          ? { from: 'them', body: c.body }
          : {
              from: 'user',
              body: (c.authorIdentity || c.authorUserId) ? `${c.author}: ${c.body}` : c.body,
            }
      );

  /**
   * Ask a teammate to reply to the member's post.
   *
   * Only ever called from postComment, i.e. only a member's own post triggers a
   * reply. The persona's post is written straight to the blob and never routed
   * back through here, so replies cannot chain.
   */
  const requestPersonaReply = async (post, thread) => {
    // The project's own showroom decides which account manager answers it.
    const responder = pickResponder(
      post.body,
      teamPersonas,
      projectShowroom?.accountManager?.name || null
    );
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
    if (!text || !projectId || !canPost) return;
    setPostingComment(true);
    // A guest has no private notes: the checkbox is hers to see only when the
    // thread is hers. "Visible only to select users" in someone else's blob
    // would be a promise this has no way to keep.
    const isPrivate = canEdit && commentIsPrivate;
    let posted = null;
    try {
      // Both ends of the read-modify-write address the project OWNER, guest or
      // not. The thread belongs to the project, so a guest's post has to land
      // where the rest of the thread already is; writing her own blob would file
      // her reply somewhere the member will never look.
      const stored = (isGuest
        ? await readUserBlob(ownerId, 'discussions')
        : await loadUserData('discussions', null)) || {};
      const list = Array.isArray(stored[projectId]) ? stored[projectId] : [];
      // Sign it when the thread is not yours, and only then. This mirrors the
      // reader exactly, which is the point: it treats an unsigned post as the
      // owner's, so "unsigned" has to keep meaning "the owner wrote this".
      const signAs = isGuest ? teamSelf : null;
      const entry = {
        id: `c-${Date.now()}`,
        ...(signAs
          // An authored post: it says who wrote it, because in someone else's
          // thread "Me" is not a name, it is a bug waiting to be rendered. An
          // unsigned post here would show up to the member as their own words.
          //
          // `authorUserId` and not `authorIdentity`: the two look alike and mean
          // opposite things. authorIdentity marks a demo persona and is what
          // makes the model speak as someone; a real account must never carry
          // it, or the app starts generating Tessa's opinions for her.
          ? {
              author: signAs.name,
              authorRole: signAs.type,
              authorTitle: signAs.role,
              authorInitials: signAs.initials,
              authorUserId: userId,
            }
          // The owner's own post stays exactly as it always was, unsigned. The
          // reader renders it as them, every stored post already looks like
          // this, and signing them now would be a migration of everyone's
          // history to gain nothing.
          : { author: 'Me', authorRole: 'tradepro' }),
        body: text,
        private: isPrivate,
        createdAt: Date.now(),
      };
      const next = [...list, entry];
      const value = { ...stored, [projectId]: next };
      if (isGuest) await writeUserBlob(ownerId, 'discussions', value);
      else await saveUserData('discussions', value);
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
    //
    // And nobody replies to a guest either, which is a rule and not a shortcut.
    // A reply is written with saveUserData, into the SIGNED-IN account's blob,
    // so fired from here it would put a persona's words in Tessa's discussions
    // under a project id that is not hers. Beyond the plumbing: pickResponder
    // chooses from this project's personas, so Tessa asking her own member a
    // question would be answered by Kim, in the member's thread, on Tessa's
    // screen. The member is who should answer, they answer in Messages, and
    // that is where she already talks to them.
    if (posted && !isPrivate && canEdit) requestPersonaReply(posted.entry, posted.thread);
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
  // One editor per room, not two. Name, size, budget and notes are edited
  // together: a rename pencil beside a specs pencil read as "two edits" and
  // there was nowhere to put a note. A room's cost-per-sq-ft is never in here,
  // because it is derived from size and budget rather than entered.
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [roomDraft, setRoomDraft] = useState({ name: '', squareFootage: '', budget: '', notes: '' });

  const startEditRoom = (room) => {
    setRoomDraft({
      name: room.name || '',
      squareFootage: room.squareFootage != null ? String(room.squareFootage) : '',
      budget: room.budget != null ? String(room.budget) : '',
      notes: room.notes || '',
    });
    setEditingRoomId(room.id);
  };

  const commitRoom = (roomId) => {
    const name = roomDraft.name.trim();
    setEditingRoomId(null);
    // A room must keep a name; a blank one leaves everything as it was.
    if (!name) return;
    const nextRooms = rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            name,
            squareFootage: roomDraft.squareFootage.trim(),
            // budget through parseMoney so "20000"/"$20,000"/blank all normalize;
            // a cleared field becomes null ("not budgeted"), never 0.
            budget: parseMoney(roomDraft.budget),
            // Keep the id, so products stay linked to this room across a rename.
            notes: roomDraft.notes.trim(),
          }
        : r
    );
    persistProjectFields({ rooms: nextRooms });
  };

  /**
   * Narrow write: re-read the collection, patch ONLY this project, save.
   * Rooms and products change from three different pages, so writing back a
   * list we loaded on mount would clobber concurrent edits. Drafts that have
   * never been saved (no projectId) stay local, and persistProject picks them up.
   */
  const persistProjectFields = async (fields) => {
    if (!canEditProject) return;
    setProjectData((current) => ({ ...current, ...fields }));
    if (!userId || !projectId) return;
    try {
      // Re-read and write the OWNER's list, so an AM's room and product edits go
      // to the member's account, not to her own empty one. See persistProjectsList.
      const list = await loadProjectsList();
      const next = list.map((p) =>
        p.id === projectId ? { ...p, ...fields, updatedAt: Date.now() } : p
      );
      await persistProjectsList(next);
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
    persistProjectFields({ rooms: [...rooms, makeRoom(trimmed, rooms, amStamp())] });
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
    // The project owner, who is the reader unless they are a guest. Every event
    // below is something the owner's account did.
    const me = {
      name: ownerName,
      initials: ownerName.slice(0, 2).toUpperCase(),
      type: 'tradepro',
    };
    // An entry the account manager created carries `addedBy`; credit it to her,
    // not to the owner whose blob it lives in. Same rule as an authored post.
    // Unstamped means the owner, which is every legacy entry and every entry the
    // owner made themselves.
    const by = (entry) =>
      entry && entry.addedBy && entry.addedBy.name
        ? {
            name: entry.addedBy.name,
            initials: entry.addedBy.initials
              || entry.addedBy.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
            type: entry.addedBy.type || 'prosource',
          }
        : me;
    const events = [];

    (projectData.rooms || []).forEach((room) => {
      if (!room.createdAt) return;
      events.push({
        id: `act-room-${room.id}`, ...by(room), ts: room.createdAt,
        text: <>Added <strong>{room.name}</strong> as a room</>,
      });
    });

    (projectData.products || []).forEach((p, i) => {
      if (!p.addedAt) return;
      events.push({
        id: `act-product-${p.sku || p.id || 'x'}-${i}`, ...by(p), ts: p.addedAt,
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
        id: `act-team-${teamKey(m)}`, ...by(m), ts: m.addedAt,
        text: (
          <>
            Added <strong>{m.name}</strong>{' '}
            {m.role ? `as ${String(m.role).toLowerCase()}` : 'to the team'}
          </>
        ),
      });
    });

    // Same rule as the thread itself: a post that says who wrote it is credited
    // to them, and an unsigned one to the owner. See the reader for why.
    comments.forEach((c) => {
      const isAuthored = !!c.authorIdentity || !!c.authorUserId;
      events.push({
        id: `act-post-${c.id}`,
        name: isAuthored ? c.author : me.name,
        initials: isAuthored
          ? (c.authorInitials || String(c.author || '').slice(0, 2).toUpperCase())
          : me.initials,
        type: isAuthored ? c.authorRole : 'tradepro',
        ts: c.createdAt,
        text: c.private ? <>Added a private note</> : <>Posted in the discussion</>,
      });
    });

    if (record?.createdAt) {
      events.push({ id: 'act-created', ...me, ts: record.createdAt, text: <>Created this project</> });
    }

    return events.filter((e) => e.ts).sort((a, b) => b.ts - a.ts);
  }, [projectId, projectList, projectData, team, comments, ownerName]);

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

  /**
   * Estimates & Orders is dropped for a guest.
   *
   * Not because she should not see them (they are her job), but because this tab
   * cannot show them: `useOrders` reads the SIGNED-IN account's orders blob, and
   * an account manager's is empty. It would render "No Estimates or Orders Yet"
   * over a project that may well have both, and then tell her to message her
   * account manager, which is herself. A tab that is not there is a gap; a tab
   * confidently reporting nothing is a lie. Pointing it at the owner's orders is
   * a real feature (and the work queue is where that job already lives), so it
   * is left out rather than half-built.
   */
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'products', label: 'Products', icon: ShoppingCart, count: products.length || null },
    { id: 'designs', label: 'Designs', icon: Palette },
    { id: 'photos', label: 'Photos', icon: Camera },
    ...(isGuest ? [] : [{ id: 'estimates', label: 'Estimates & Orders', icon: FileText }]),
    { id: 'activity', label: 'Activity', icon: Bell, count: unreadActivity || null },
  ];

  // ?tab=estimates is a real link the app sends itself. For a guest that tab
  // does not exist, so land on Overview rather than on a page with no body.
  useEffect(() => {
    if (isGuest && activeTab === 'estimates') setActiveTab('overview');
  }, [isGuest, activeTab]);

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
    /** Whose project this is and what the reader may do with it, said up front. */
    guestBanner: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      margin: '0 0 16px',
      padding: '12px 14px',
      background: '#e8effb',
      border: `1px solid ${colors.darkBlue}`,
      borderRadius: 6,
      fontSize: 13,
      color: colors.darkBlue,
      lineHeight: 1.5,
    },
    readOnlyNote: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 24,
      padding: '12px 14px',
      background: colors.gray100,
      border: `1px solid ${colors.gray200}`,
      borderRadius: 6,
      fontSize: 13,
      color: colors.gray700,
      lineHeight: 1.5,
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

        {/* The stepper, the bin and the room picker are writes. The owner gets
            them, and so does the account manager editing her member's project
            (canEditProject): those writes are redirected to the member's blob,
            which is where they belong. A plain guest reads the two facts (how
            many, which room) as text. */}
        {canEditProject ? (
          <>
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
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 2px', fontSize: 13, color: colors.gray700 }}>
            <span style={{ fontWeight: 600 }}>Qty {product.qty || 1}</span>
            <span style={{ color: colors.gray500 }}>·</span>
            <span style={{ color: colors.gray500 }}>{roomLabel(rooms, product.roomId)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const backLink = (
    <Link to="/projects" style={styles.breadcrumbLink}>
      ← Back to {isAccountManager ? 'Member Projects' : 'My Projects'}
    </Link>
  );

  /**
   * A guest's read can fail or come up empty, and both are dead ends worth
   * saying out loud. A member never reaches either: their read cannot throw, and
   * an id they cannot resolve still falls through to the draft behaviour it
   * always did.
   */
  if (loadError || notFound) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.container}>
          <div style={styles.breadcrumb}>{backLink}</div>
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <AlertCircle size={40} color={loadError ? colors.red : colors.gray300} />
            </div>
            <h3 style={styles.emptyTitle}>
              {loadError ? "We couldn't load this project" : 'Project not found'}
            </h3>
            <p style={styles.emptyText}>
              {loadError || (
                isGuest
                  ? `${ownerName} has no project with this id. It may have been deleted since you opened the list.`
                  : 'This project does not exist, or it belongs to another account.'
              )}
            </p>
            <Link to="/projects" style={{ ...styles.btnPrimary, textDecoration: 'none' }}>
              Back to projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Project Header */}
        <div style={styles.projectHeader}>
          {/* Says whose project this is and that it stays theirs, before any of
              it is read. The absence of edit buttons is not a message: it looks
              the same as a page that is broken or still loading. */}
          {isGuest && (
            <div style={styles.guestBanner}>
              <Eye size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              {/* Two different guests, two different truths. The account manager
                  on this project can edit it (canEditProject); everyone else is
                  reading. Say which, and in both cases name what stays the
                  member's: archiving and deleting are theirs alone. */}
              {canEditProject ? (
                <div>
                  <strong>{ownerName}'s project.</strong> You have it open as their account
                  manager, so you can edit it and post in the discussion. Archiving and deleting
                  it stay {ownerName.split(' ')[0]}'s call.
                </div>
              ) : (
                <div>
                  <strong>{ownerName}'s project.</strong> You have it open as their account
                  manager: nothing here can be renamed, archived, deleted, or changed. To make a
                  change, ask {ownerName.split(' ')[0]}.
                  {canPost && ' You can post in the discussion, since you are on this project team.'}
                </div>
              )}
            </div>
          )}
          <div style={styles.headerTop}>
            <div>
              <div style={styles.breadcrumb}>{backLink}</div>
              {!canEditProject ? (
                <h1 style={styles.projectTitle}>{projectData.name}</h1>
              ) : editingTitle ? (
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
                  <MapPin size={14} />
                  {projectShowroom ? (
                    <strong>{projectShowroom.name}</strong>
                  ) : (
                    <span style={{ color: colors.gray500 }}>No showroom assigned</span>
                  )}
                </div>
                {projectAccountManager && (
                  <div style={styles.metaItem}>
                    <User size={14} /> {projectAccountManager.name}
                    {projectAccountManager.title ? `, ${projectAccountManager.title}` : ''}
                  </div>
                )}
                <div style={styles.metaItem}>
                  <Calendar size={14} /> Last updated Dec 18, 2025
                </div>
              </div>
            </div>
            {/* The status button is a content edit, so the owner AND the account
                manager on this project get it (canEditProject). Archive and
                Delete are not: they are destructive and the member's own call, so
                the more-menu that holds them stays owner-only (canEdit) below. A
                plain guest gets none of it. */}
            {canEditProject && (
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
              
              {/* More Menu: Archive + Delete, owner only. An account manager can
                  edit the project but not archive or delete it. */}
              {canEdit && (
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
              )}
            </div>
            )}
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
                  {!canEditProject ? null : !isEditingDetails ? (
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
                      {isGuest
                        ? `${ownerName} has not added any rooms to this project yet.`
                        : "No rooms yet. Add the spaces you're working on to organize products by room."}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {rooms.map((room) => {
                        const attached = countProductsInRoom(products, room.id);
                        const isEditing = editingRoomId === room.id;
                        const cps = roomCostPerSqFt(room);
                        const sqftNum = Number(String(room.squareFootage ?? '').replace(/[,\s]/g, ''));
                        // Each present spec, in reading order. Omitted, not
                        // zeroed, when unset: an unbudgeted room says nothing
                        // about its budget rather than claiming $0.
                        const specParts = [
                          Number.isFinite(sqftNum) && sqftNum > 0 ? `${sqftNum.toLocaleString()} sq ft` : null,
                          formatMoney(room.budget),
                          cps != null ? `${formatMoney(cps)}/sq ft` : null,
                        ].filter(Boolean);
                        return (
                          <div key={room.id} style={{ ...styles.roomRow, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                            {isEditing ? (
                              /* One editor for the whole room: name, size, budget,
                                 notes. Replaces the pair of pencils that read as
                                 two separate edits. */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <Home size={16} color={colors.darkBlue} style={{ flexShrink: 0 }} />
                                  <input
                                    autoFocus
                                    value={roomDraft.name}
                                    onChange={(e) => setRoomDraft((d) => ({ ...d, name: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitRoom(room.id); if (e.key === 'Escape') setEditingRoomId(null); }}
                                    placeholder="Room name"
                                    style={{ flex: 1, fontSize: 14, fontWeight: 600, color: colors.gray900, padding: '6px 10px', border: `2px solid ${colors.darkBlue}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingLeft: 26 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.gray500 }}>
                                    Size
                                    <input
                                      type="number" min="0"
                                      value={roomDraft.squareFootage}
                                      onChange={(e) => setRoomDraft((d) => ({ ...d, squareFootage: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') commitRoom(room.id); if (e.key === 'Escape') setEditingRoomId(null); }}
                                      placeholder="sq ft"
                                      style={{ width: 90, padding: '5px 8px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}
                                    />
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.gray500 }}>
                                    Budget $
                                    <input
                                      type="number" min="0"
                                      value={roomDraft.budget}
                                      onChange={(e) => setRoomDraft((d) => ({ ...d, budget: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') commitRoom(room.id); if (e.key === 'Escape') setEditingRoomId(null); }}
                                      placeholder="dollars"
                                      style={{ width: 110, padding: '5px 8px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}
                                    />
                                  </label>
                                </div>
                                <div style={{ paddingLeft: 26 }}>
                                  <textarea
                                    value={roomDraft.notes}
                                    onChange={(e) => setRoomDraft((d) => ({ ...d, notes: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingRoomId(null); }}
                                    placeholder="Notes for this room (optional)"
                                    rows={2}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', border: `1px solid ${colors.gray300}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 8, paddingLeft: 26 }}>
                                  <button onClick={() => commitRoom(room.id)} style={{ ...styles.btnPrimary, ...styles.btnSmall }}>
                                    <Check size={13} /> Save
                                  </button>
                                  <button onClick={() => setEditingRoomId(null)} style={{ ...styles.btnOutline, ...styles.btnSmall }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <Home size={16} color={colors.darkBlue} style={{ flexShrink: 0 }} />
                                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: colors.gray900 }}>
                                    {room.name}
                                  </span>
                                  <span style={{ fontSize: 12, color: colors.gray500 }}>
                                    {attached > 0
                                      ? `${attached} product${attached !== 1 ? 's' : ''}`
                                      : 'No products'}
                                  </span>
                                  {canEditProject && (
                                    <>
                                      <button
                                        title={`Edit ${room.name}`}
                                        onClick={() => startEditRoom(room)}
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
                                {specParts.length > 0 && (
                                  <div style={{ fontSize: 12, color: colors.gray700, paddingLeft: 26 }}>
                                    {specParts.join('  ·  ')}
                                  </div>
                                )}
                                {room.notes && (
                                  <div style={{ fontSize: 12, color: colors.gray500, paddingLeft: 26, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {room.notes}
                                  </div>
                                )}
                                {specParts.length === 0 && !room.notes && canEditProject && (
                                  <button
                                    onClick={() => startEditRoom(room)}
                                    style={{ alignSelf: 'flex-start', marginLeft: 26, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: colors.darkBlue, fontFamily: 'inherit' }}
                                  >
                                    + Add size, budget &amp; notes
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {canEditProject && (
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
                  )}

                  {canEditProject && ROOM_OPTIONS.some((o) => !rooms.some((r) => r.name.toLowerCase() === o.toLowerCase())) && (
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
                  {/* The discussion is the one thing on this page a guest can
                      write to, and only a guest who is on the team. Everything
                      else here stays owner-only.

                      The rest of the page is read-only for a guest because the
                      records are the owner's: their rooms, their products,
                      their team. The discussion is the one place where a
                      teammate has something of their own to add, and an account
                      manager who cannot answer a question on her own member's
                      project is a demo of a tool nobody would use.

                      A guest who is NOT on the team still sees the note. That is
                      the honest state and not a fallback: it is someone reading
                      a project they have no part in. */}
                  {!canPost ? (
                    <div style={styles.readOnlyNote}>
                      <MessageCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        You can read this discussion, but not post to it: this thread belongs to{' '}
                        {ownerName}'s project team. To reply to {ownerName.split(' ')[0]}, use{' '}
                        <Link to="/messages" style={{ color: colors.darkBlue, fontWeight: 600 }}>Messages</Link>.
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Posting into someone else's thread: say so, and say as
                      whom. She is about to write on a member's project under her
                      own name, and that should not be something she discovers
                      after pressing the button. */}
                  {isGuest && teamSelf && (
                    <div style={{ ...styles.readOnlyNote, marginBottom: 12 }}>
                      <MessageCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        Posting as <strong>{teamSelf.name}</strong> on {ownerName}'s project.
                        {' '}{ownerName.split(' ')[0]} will see this in their discussion.
                      </div>
                    </div>
                  )}
                  {/* New comment input */}
                  <textarea
                    style={{ ...styles.commentBox, width: '100%', marginBottom: 12 }}
                    placeholder={isGuest ? `Reply to ${ownerName.split(' ')[0]}…` : 'Add a comment or update...'}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                    {/* A private note is the owner's own margin note on their own
                        project. There is no version of it that means anything in
                        a thread you are a guest in: the blob it would be private
                        in belongs to the person you would be hiding it from. */}
                    {canEdit ? (
                      <label style={styles.privateCheck}>
                        <input
                          type="checkbox"
                          checked={commentIsPrivate}
                          onChange={(e) => setCommentIsPrivate(e.target.checked)}
                        />
                        <span>Make this message private (visible only to select users)</span>
                      </label>
                    ) : <span />}
                    {/* "Attach File" is gone: a post is text, and there is
                        nowhere for a file to go. The discussions blob stores a
                        body string, and no upload endpoint exists to give it a
                        URL to store instead. */}
                    <div className="flex gap-3 shrink-0">
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
                  </>
                  )}

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
                        // An authored post says who wrote it, and there are two
                        // kinds: a demo persona (authorIdentity, words the model
                        // generated) and a real teammate (authorUserId, words a
                        // person typed). They render the same and must never be
                        // confused anywhere else: see postComment.
                        //
                        // Unsigned means the project owner. That is the owner's
                        // own composer, and it is also every comment stored
                        // before any of this existed, which is why the fallback
                        // is the owner rather than a migration.
                        const isAuthored = !!c.authorIdentity || !!c.authorUserId;
                        const name = isAuthored ? c.author : ownerName;
                        const badge = memberBadgeStyle(isAuthored ? c.authorRole : 'tradepro');
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
                          <div style={commentAvatarStyle(isAuthored ? c.authorRole : 'tradepro')}>
                            {(isAuthored && c.authorInitials) || name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: colors.gray900 }}>{name}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: badge.color, background: badge.background,
                                padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                              }}>{badge.label}</span>
                              {isAuthored && c.authorTitle && (
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
                      {isGuest
                        ? 'No comments on this project yet.'
                        : 'No comments yet. Start the conversation above.'}
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

              {/* The Inspiration Board is gone rather than fixed.
                  It offered two things: "Browse Gallery" and "+ Add Photo",
                  backed by four dashed tiles that looked like drop targets. There
                  is no inspiration gallery in this app to browse, and no upload
                  path of any kind: no storage, no endpoint, nothing that would
                  hold a photo once it was picked. A card whose every affordance
                  promises a capability that does not exist has nothing honest to
                  link to, so it makes no claim at all. If photo storage ever
                  lands, this comes back with it. */}
            </div>

            {/* Sidebar */}
            <div style={styles.sidebar}>
              {/* Team */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Project Team</h3>
                  {canEditProject && (
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
                  )}
                </div>
                <div style={styles.cardBody}>
                  {team.length === 0 ? (
                    <div style={{ fontSize: 13, color: colors.gray500, textAlign: 'center', padding: '12px 0' }}>
                      {isGuest
                        ? 'Nobody has been added to this project team yet.'
                        : 'No team members yet. Click + Add to bring people in.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {team.map((m) => {
                        const badge = memberBadgeStyle(m.type);
                        return (
                          <div
                            key={teamKey(m)}
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
                            {canEditProject && (
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
                            )}
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

              {/* Quick Actions. Every one of these is a member asking the
                  showroom for something, so for the account manager reading her
                  own member's project they invert: "Request an Estimate" would
                  be her asking herself. Hidden for a guest rather than reworded,
                  because the actions themselves are the member's to take. */}
              {canEdit && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>Quick Actions</h3>
                </div>
                <div style={styles.cardBody}>
                  {/* Both requests are a conversation with the account manager,
                      the same answer the Estimates & Orders tab already gives:
                      no endpoint takes an estimate or a design request, and the
                      showroom fields both in Messages. Two links to /messages
                      with different labels is not a duplicate, it is two asks
                      that share one channel, and the label is what the member
                      goes there to say. Browse Products has a real /shop. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link
                      to="/messages"
                      style={{ ...styles.btnPrimary, justifyContent: 'center', width: '100%', textDecoration: 'none' }}
                    >
                      Request an Estimate
                    </Link>
                    <Link
                      to="/messages"
                      style={{ ...styles.btnOutline, justifyContent: 'center', width: '100%', textDecoration: 'none' }}
                    >
                      Request Kitchen/Bath Design
                    </Link>
                    <button
                      style={{ ...styles.btnOutline, justifyContent: 'center', width: '100%' }}
                      onClick={() => navigate('/shop')}
                    >
                      Browse Products
                    </button>
                  </div>
                </div>
              </div>
              )}
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
                  {isGuest
                    ? `Products ${ownerName} is considering for this project`
                    : "Products you're considering for this project"}
                </p>
              </div>
              {canEdit && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  className="whitespace-nowrap"
                  style={styles.btnOutline}
                  onClick={() => navigate('/shop')}
                >
                  <Plus size={14} /> Add Product
                </button>
                {/* Same answer as the Estimates & Orders tab: the request is a
                    message to the account manager, so it goes where that
                    conversation already happens. */}
                <Link
                  className="whitespace-nowrap"
                  to="/messages"
                  style={{ ...styles.btnPrimary, textDecoration: 'none' }}
                >
                  Request Estimate
                </Link>
              </div>
              )}
            </div>

            {products.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}><ShoppingCart size={48} color={colors.gray300} /></div>
                <h3 style={styles.emptyTitle}>No Products Yet</h3>
                <p style={styles.emptyText}>
                  {isGuest
                    ? `${ownerName} has not saved any products to this project yet. When they do, they show up here grouped by room.`
                    : "Browse the catalog and save products to this project. They'll show up here grouped by room so you can see exactly what's going where."}
                </p>
                {canEdit && (
                  <button style={styles.btnPrimary} onClick={() => navigate('/shop')}>
                    Browse Products
                  </button>
                )}
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
            {/* Says the same true thing the Photos tab says, because this tab is
                in the same position: it renders an unconditional empty state and
                there is no designs field on a project, so no design can ever
                arrive here for anyone. The old copy promised a designer would
                upload them and that you would find them here during
                installation, which was a delivery mechanism that does not exist.
                Asking for a designer IS real though, which is what the button
                below does, so the ask stays and only the promise goes. */}
            <p style={styles.emptyText}>
              {isGuest
                ? `Shared designs aren't part of the app yet, so ${ownerName}'s designs live with their designer for now.`
                : "Shared designs aren't part of the app yet. Your ProSource Kitchen & Bath Designer will get them to you directly, and you can ask for one here."}
            </p>
            {/* The design request is a conversation, same as the estimate: no
                endpoint takes one. Owner only, and for the same reason Quick
                Actions is: asking the account manager for a designer is the
                member's ask, and it inverts for the account manager reading her
                own member's project. */}
            {canEdit && (
              <Link to="/messages" style={{ ...styles.btnPrimary, textDecoration: 'none' }}>
                Request Kitchen or Bath Design
              </Link>
            )}
          </div>
        )}

        {/* Photos Tab. Both buttons here ("+ Add Photos", "Upload Your First
            Photo") are gone, and nothing replaces them. Photo upload has no
            backend: no storage, no endpoint, no field on the project record. It
            has no honest substitute either, and Messages is specifically not
            one, since neither transport carries media. So this tab says what is
            true and makes no offer it cannot keep. The copy went with the
            buttons: "Add before photos now" was the same promise in a
            sentence. */}
        {activeTab === 'photos' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Project Photos</h2>
              {/* The subtitle made the same promise the empty state below just
                  stopped making. Both say the same thing now. */}
              <p style={{ color: colors.gray500, fontSize: 14, margin: '4px 0 0' }}>
                Not part of the app yet
              </p>
            </div>

            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}><Camera size={48} color={colors.gray300} /></div>
              <h3 style={styles.emptyTitle}>No Photos Yet</h3>
              <p style={styles.emptyText}>
                Project photos aren't part of the app yet. When they land, before
                and after shots of {isGuest ? 'this project' : 'your project'} will show up here.
              </p>
            </div>
          </div>
        )}

        {/* Estimates & Orders Tab. `!isGuest` as well as the tab check: ?tab=
            comes from the URL, so the panel has to refuse on its own rather than
            trust that the tab strip never offered it. */}
        {activeTab === 'estimates' && !isGuest && (() => {
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

      {/* Archived banner. It exists to undo an archive you just did, so a guest,
          who cannot archive anything, has nothing to undo. The project's
          archived state still shows on the card in her list. */}
      {archived && canEdit && (
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
