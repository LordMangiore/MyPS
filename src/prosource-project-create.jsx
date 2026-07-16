import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, X, Plus, Home, Store } from 'lucide-react';
import { useAuth } from './auth-context';
import {
  PROJECT_TYPES,
  BUDGET_RANGES,
  ROOM_OPTIONS,
  DEFAULT_ROOMS_BY_TYPE,
  makeRoom,
  normalizeStored,
} from './project-model';
import { iconForProjectType } from './project-type-icons';

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

const STATES = ['MO', 'IL', 'TX', 'CA', 'FL', 'NY', 'NC', 'OH', 'PA', 'GA', 'WA', 'CO'];

/**
 * Every step the wizard can show, in order. Not every account sees all of them:
 * `buildStepIds` is what an account actually walks through.
 */
const ALL_STEP_IDS = ['type', 'name', 'address', 'showroom', 'scope', 'rooms', 'team', 'review'];

/**
 * The steps this account walks through.
 *
 * One list drives everything downstream: the "Step X of N" eyebrow, the progress
 * bar, next/back, and which step renders. So a conditional step has to be
 * conditional *here*, in the list itself, and nowhere else. Filter the canonical
 * order rather than splicing into it: the order stays declared in one literal,
 * and the only thing the condition decides is whether a step is in or out.
 *
 * The showroom step is dropped for accounts with a single showroom (nearly all
 * of them). There is nothing to choose, so asking would be a step whose answer
 * is a foregone conclusion. `createProject` assigns it silently instead.
 */
const buildStepIds = (multiShowroom) =>
  ALL_STEP_IDS.filter((id) => id !== 'showroom' || multiShowroom);

export default function ProSourceProjectCreate() {
  const { userId, userName, loadUserData, saveUserData, showrooms } = useAuth();
  const navigate = useNavigate();

  // Showrooms come off the session, which is read synchronously at mount, but a
  // profile fetch can widen the list a moment later. Treat it as data that
  // changes: `stepIds` is derived, never a snapshot taken at mount.
  const showroomOptions = showrooms || [];
  const multiShowroom = showroomOptions.length > 1;
  const stepIds = useMemo(() => buildStepIds(multiShowroom), [multiShowroom]);

  const [rawStepIndex, setStepIndex] = useState(0);
  // If the step list changes under an open wizard (see above), a raw index kept
  // in state could point past the end. Deriving the real index keeps it inside
  // the list, so "Step X of N" can never read "Step 8 of 7".
  const stepIndex = Math.min(rawStepIndex, stepIds.length - 1);
  const step = stepIds[stepIndex];

  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [touchedName, setTouchedName] = useState(false);
  const [address, setAddress] = useState({ street: '', city: '', state: 'MO', zip: '' });
  const [showroomId, setShowroomId] = useState(null);
  const [touchedShowroom, setTouchedShowroom] = useState(false);
  const [budgetRange, setBudgetRange] = useState('Not Sure Yet');
  const [targetCompletion, setTargetCompletion] = useState('');
  const [rooms, setRooms] = useState([]);
  const [touchedRooms, setTouchedRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [teamSelections, setTeamSelections] = useState({}); // connectionId → bool
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonType, setNewPersonType] = useState('client');
  const [addingPerson, setAddingPerson] = useState(false);
  const [addPersonError, setAddPersonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load connections so the team step can offer real people.
  // `connectionsLoading` matters: without it the team step renders its "no
  // connections yet" empty state while the fetch is still in flight, which reads
  // as "you have nobody" rather than "hang on". On a cold function that is the
  // difference between the step looking broken and looking correct.
  useEffect(() => {
    if (!userId) { setConnectionsLoading(false); return; }
    let cancelled = false;
    setConnectionsLoading(true);
    loadUserData('connections', null).then((stored) => {
      if (cancelled) return;
      // Tolerate both shapes: the seed writes { list: [...] }, but older/other
      // writers may hand back a bare array.
      const list = Array.isArray(stored?.list)
        ? stored.list
        : Array.isArray(stored)
        ? stored
        : [];
      setConnections(list);
      // Pre-check ProSource showroom contacts (Kim + Heather etc.)
      const initial = {};
      list.forEach((c) => {
        if (c.type === 'prosource') initial[c.id] = true;
      });
      setTeamSelections(initial);
      setConnectionsLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /**
   * Add someone who isn't a connection yet, straight from the wizard.
   * Written as status 'invited' with inviteEmailSent: false, so they have been
   * added to the project, but no email has gone out. The Connections page has
   * the real invite flow; sending mail from here would surprise the user.
   */
  const addPerson = async () => {
    const name = newPersonName.trim();
    if (!name || addingPerson) return;
    setAddingPerson(true);
    setAddPersonError('');
    try {
      const stored = await loadUserData('connections', null);
      const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
      const list = Array.isArray(stored?.list)
        ? stored.list
        : Array.isArray(stored)
        ? stored
        : [];
      const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const record = {
        id,
        name,
        initials: name.split(/\s+/).filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join('') || '?',
        role: newPersonType === 'client' ? 'Homeowner' : 'Trade Pro',
        type: newPersonType,
        email: newPersonEmail.trim(),
        phone: '',
        location: '',
        status: 'invited',
        projects: 0,
        inviteToken: null,
        inviteEmailSent: false,
        invitedAt: Date.now(),
        addedAt: Date.now(),
      };
      const next = [...list, record];
      // Spread `base` so we never drop sibling keys (the Connections page keeps
      // `requests`/`requestsSeeded` in this same blob).
      await saveUserData('connections', { ...base, list: next });
      setConnections(next);
      setTeamSelections((prev) => ({ ...prev, [id]: true }));
      setNewPersonName('');
      setNewPersonEmail('');
      setShowAddPerson(false);
    } catch (err) {
      setAddPersonError('Could not add them. Try again.');
    } finally {
      setAddingPerson(false);
    }
  };

  /**
   * Default to the primary showroom, and keep that default honest if the list
   * only arrives after mount. `touchedShowroom` stops it overwriting a choice
   * the user has already made, the same way `touchedName` and `touchedRooms` do.
   *
   * This is also the whole of the single-showroom path: the one showroom is the
   * primary, so it lands here with nothing on screen and nothing to click. An
   * account with no showrooms at all resolves to null, which the project model
   * reads as unassigned.
   */
  useEffect(() => {
    if (touchedShowroom) return;
    setShowroomId(showrooms?.[0]?.id ?? null);
  }, [showrooms, touchedShowroom]);

  // Suggest a default name based on type and a client name from the team
  // (e.g. "Beans Kitchen Remodel"). Only applies before the user types anything.
  const suggestedName = useMemo(() => {
    if (!type) return '';
    const clientLast = connections
      .filter((c) => c.type === 'client' && teamSelections[c.id])
      .map((c) => c.name.split(/\s+/).pop())
      .filter(Boolean)[0];
    if (clientLast) return `${clientLast} ${type}`;
    return type;
  }, [type, connections, teamSelections]);

  useEffect(() => {
    if (!touchedName && suggestedName) setName(suggestedName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedName]);

  // Seed rooms from the project type ("Kitchen Remodel" → a Kitchen room) until
  // the user edits the list themselves.
  useEffect(() => {
    if (touchedRooms) return;
    const defaults = DEFAULT_ROOMS_BY_TYPE[type] || [];
    setRooms(defaults.reduce((acc, room) => [...acc, makeRoom(room, acc)], []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const addRoom = (roomName) => {
    const trimmed = String(roomName || '').trim();
    if (!trimmed) return;
    setTouchedRooms(true);
    setRooms((current) => {
      if (current.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) return current;
      return [...current, makeRoom(trimmed, current)];
    });
    setNewRoomName('');
  };

  const removeRoom = (roomId) => {
    setTouchedRooms(true);
    setRooms((current) => current.filter((r) => r.id !== roomId));
  };

  const goNext = () => {
    setError('');
    if (stepIndex === stepIds.length - 1) return;
    setStepIndex((i) => Math.min(i + 1, stepIds.length - 1));
  };
  const goBack = () => {
    setError('');
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const stepValid = () => {
    if (step === 'type') return !!type;
    if (step === 'name') return name.trim().length > 0;
    return true; // address, scope, team, review are all skippable
  };

  const createProject = async () => {
    // Never fail silently here. This used to be a bare `if (!userId) return`,
    // which made the Create button do visibly nothing for anyone holding a
    // session without a userId (e.g. one minted by the old demo-skip flow).
    // No navigation, no error -- indistinguishable from a broken button.
    if (!userId) {
      setError('Your session has expired. Sign out and sign in again to create a project.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const stored = await loadUserData('projects', null);
      const list = normalizeStored(stored);
      const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();
      const team = connections
        .filter((c) => teamSelections[c.id])
        .map((c) => ({
          connectionId: c.id,
          name: c.name,
          initials: c.initials,
          role: c.role,
          type: c.type,
          addedAt: now,
        }));
      const hasAddress = !!(address.street || address.city || address.zip);
      const fullAddress = hasAddress
        ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ')
        : '';
      const record = {
        id,
        name: name.trim(),
        type,
        description: '',
        address: fullAddress,
        budgetRange,
        targetStart: '',
        targetCompletion,
        squareFootage: '',
        // Chosen on the showroom step, or defaulted to the account's primary
        // when there was no choice to make.
        showroomId,
        rooms,
        products: [],
        notes: '',
        status: 'working',
        archived: false,
        team,
        createdAt: now,
        updatedAt: now,
      };
      await saveUserData('projects', { list: [...list, record] });
      navigate(`/projects/${id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create project');
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <Link to="/projects" style={styles.backLink}>
          <ArrowLeft size={18} /> Back to My Projects
        </Link>

        <div style={styles.progressRow}>
          {stepIds.map((id, i) => (
            <div
              key={id}
              style={{
                ...styles.progressDot,
                background: i < stepIndex ? colors.darkBlue : i === stepIndex ? colors.red : colors.gray300,
              }}
            />
          ))}
        </div>

        <div style={styles.card}>
          {step === 'type' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="What kind of project is this?"
              sub="Pick the closest match. You can change it later."
            >
              <div style={styles.chipGrid}>
                {PROJECT_TYPES.map((t) => {
                  const Icon = iconForProjectType(t.label);
                  const selected = type === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      style={{
                        ...styles.typeCard,
                        borderColor: selected ? colors.darkBlue : colors.gray200,
                        background: selected ? '#f0f5ff' : '#fff',
                      }}
                    >
                      <Icon
                        size={26}
                        strokeWidth={1.5}
                        color={selected ? colors.darkBlue : colors.gray500}
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 'name' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="Give it a name."
              sub="Something memorable so you can find it later."
            >
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setTouchedName(true); }}
                placeholder={suggestedName || 'e.g. Beans Kitchen Remodel'}
                style={styles.bigInput}
                onKeyDown={(e) => { if (e.key === 'Enter' && stepValid()) goNext(); }}
              />
              {suggestedName && !touchedName && (
                <div style={{ fontSize: 12, color: colors.gray500, marginTop: 8 }}>
                  We'll use this default. Feel free to change it.
                </div>
              )}
            </Step>
          )}

          {step === 'address' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length} · Optional`}
              title="Where's the work happening?"
              sub="Helps us prep materials for delivery. You can skip and add this later."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text" placeholder="Street address"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  style={styles.input}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                  <input
                    type="text" placeholder="City"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    style={styles.input}
                  />
                  <select
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    style={styles.input}
                  >
                    {STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input
                    type="text" placeholder="Zip"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>
            </Step>
          )}

          {step === 'showroom' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="Which showroom is this project with?"
              sub="You work with more than one. Pick the one supplying this job so quotes, samples and questions go to the right team."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {showroomOptions.map((s) => {
                  const selected = showroomId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setShowroomId(s.id); setTouchedShowroom(true); }}
                      style={{
                        ...styles.showroomCard,
                        borderColor: selected ? colors.darkBlue : colors.gray200,
                        background: selected ? '#f0f5ff' : '#fff',
                      }}
                    >
                      <Store
                        size={22}
                        strokeWidth={1.5}
                        color={selected ? colors.darkBlue : colors.gray500}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: colors.gray900 }}>
                          {s.name}
                        </div>
                        {s.address && (
                          <div style={{ fontSize: 12.5, color: colors.gray500, marginTop: 3 }}>
                            {s.address}
                          </div>
                        )}
                        {s.accountManager?.name && (
                          <div style={{ fontSize: 12.5, color: colors.gray700, marginTop: 5 }}>
                            {s.accountManager.name}
                            {s.accountManager.title ? `, ${s.accountManager.title}` : ''}
                          </div>
                        )}
                      </div>
                      {/* Radio, not a checkbox: a project has one showroom. */}
                      <div
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${selected ? colors.darkBlue : colors.gray300}`,
                          background: selected ? colors.darkBlue : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {selected && <Check size={13} color="#fff" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 'scope' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length} · Optional`}
              title="What's the scope?"
              sub="Just rough numbers. We refine these as we go."
            >
              <div style={styles.sectionLabel}>Budget range</div>
              <div style={styles.chipRow}>
                {BUDGET_RANGES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudgetRange(b)}
                    style={{
                      ...styles.chip,
                      borderColor: budgetRange === b ? colors.darkBlue : colors.gray300,
                      background: budgetRange === b ? '#f0f5ff' : '#fff',
                      color: budgetRange === b ? colors.darkBlue : colors.gray700,
                      fontWeight: budgetRange === b ? 600 : 500,
                    }}
                  >{b}</button>
                ))}
              </div>

              <div style={{ ...styles.sectionLabel, marginTop: 28 }}>Target completion</div>
              <input
                type="date"
                value={targetCompletion}
                onChange={(e) => setTargetCompletion(e.target.value)}
                style={{ ...styles.input, maxWidth: 280 }}
              />
            </Step>
          )}

          {step === 'rooms' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length} · Optional`}
              title="Which rooms are involved?"
              sub="Rooms let you keep products, estimates, and photos organized by space. Add or remove any time."
            >
              {rooms.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        border: `1.5px solid ${colors.gray200}`,
                        borderRadius: 10,
                        background: '#fff',
                      }}
                    >
                      <Home size={16} color={colors.darkBlue} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: colors.gray900 }}>
                        {room.name}
                      </span>
                      <button
                        onClick={() => removeRoom(room.id)}
                        title={`Remove ${room.name}`}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.gray500, display: 'flex', padding: 4,
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRoom(newRoomName); } }}
                  placeholder="Add a room, e.g. Butler's Pantry"
                  style={{ ...styles.input, flex: 1 }}
                />
                <button
                  onClick={() => addRoom(newRoomName)}
                  disabled={!newRoomName.trim()}
                  style={{
                    ...styles.navBtnPrimary,
                    padding: '10px 18px',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: newRoomName.trim() ? 1 : 0.5,
                    cursor: newRoomName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Plus size={15} /> Add
                </button>
              </div>

              <div style={styles.sectionLabel}>Common rooms</div>
              <div style={styles.chipRow}>
                {ROOM_OPTIONS
                  .filter((option) => !rooms.some((r) => r.name.toLowerCase() === option.toLowerCase()))
                  .map((option) => (
                    <button
                      key={option}
                      onClick={() => addRoom(option)}
                      style={{
                        ...styles.chip,
                        borderColor: colors.gray300,
                        background: '#fff',
                        color: colors.gray700,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Plus size={13} /> {option}
                    </button>
                  ))}
              </div>
            </Step>
          )}

          {step === 'team' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length} · Optional`}
              title="Bring in your team."
              sub={
                connectionsLoading
                  ? 'Finding the people you work with…'
                  : connections.some((c) => c.type === 'prosource')
                  ? 'Your ProSource showroom team is pre-selected. Toggle anyone else, or add someone new.'
                  : 'Toggle anyone who should see this project, or add someone new.'
              }
            >
              {connectionsLoading ? (
                <div style={{ fontSize: 14, color: colors.gray500, padding: 16 }}>
                  Loading your connections…
                </div>
              ) : connections.length === 0 ? (
                <div style={{ fontSize: 14, color: colors.gray500, padding: '8px 0 16px' }}>
                  No connections yet. Add the people working on this project below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {connections.map((c) => {
                    const checked = !!teamSelections[c.id];
                    const badge = c.type === 'prosource'
                      ? { color: colors.darkBlue, bg: '#e3f2fd', label: 'ProSource' }
                      : c.type === 'client'
                      ? { color: colors.green, bg: '#dcfce7', label: 'Client' }
                      : { color: colors.red, bg: '#fee2e2', label: 'Trade Pro' };
                    return (
                      <button
                        key={c.id}
                        onClick={() => setTeamSelections((sel) => ({ ...sel, [c.id]: !sel[c.id] }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: 12,
                          border: `1.5px solid ${checked ? colors.darkBlue : colors.gray200}`,
                          background: checked ? '#f8faff' : '#fff',
                          borderRadius: 10,
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: c.type === 'prosource'
                            ? `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.darkBlue} 100%)`
                            : c.type === 'client'
                            ? `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`
                            : `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)`,
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, fontSize: 13,
                        }}>{c.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, color: colors.gray900, fontSize: 14 }}>{c.name}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: badge.color, background: badge.bg,
                              padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                            }}>{badge.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: colors.gray500 }}>{c.role}</div>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: `2px solid ${checked ? colors.darkBlue : colors.gray300}`,
                          background: checked ? colors.darkBlue : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {checked && <Check size={14} color="#fff" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!connectionsLoading && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${colors.gray200}` }}>
                  {!showAddPerson ? (
                    <button
                      onClick={() => setShowAddPerson(true)}
                      style={{
                        ...styles.chip,
                        borderColor: colors.gray300,
                        background: '#fff',
                        color: colors.darkBlue,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Plus size={14} /> Add someone new
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={styles.sectionLabel}>Add someone to this project</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { value: 'client', label: 'Client' },
                          { value: 'tradepro', label: 'Trade Pro' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setNewPersonType(opt.value)}
                            style={{
                              ...styles.chip,
                              borderColor: newPersonType === opt.value ? colors.darkBlue : colors.gray300,
                              background: newPersonType === opt.value ? '#f0f5ff' : '#fff',
                              color: newPersonType === opt.value ? colors.darkBlue : colors.gray700,
                              fontWeight: newPersonType === opt.value ? 600 : 500,
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } }}
                        placeholder="Name, e.g. Dana Whitfield"
                        style={styles.input}
                      />
                      <input
                        type="email"
                        value={newPersonEmail}
                        onChange={(e) => setNewPersonEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } }}
                        placeholder="Email (optional)"
                        style={styles.input}
                      />
                      <div style={{ fontSize: 12, color: colors.gray500 }}>
                        They'll be added to this project and your connections. No email is sent.
                        You can invite them to ProSource from Connections when you're ready.
                      </div>
                      {addPersonError && (
                        <div style={{ fontSize: 13, color: colors.red }} role="alert">{addPersonError}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={addPerson}
                          disabled={!newPersonName.trim() || addingPerson}
                          style={{
                            ...styles.navBtnPrimary,
                            padding: '10px 18px',
                            opacity: newPersonName.trim() && !addingPerson ? 1 : 0.5,
                            cursor: newPersonName.trim() && !addingPerson ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {addingPerson ? 'Adding…' : 'Add to project'}
                        </button>
                        <button
                          onClick={() => { setShowAddPerson(false); setAddPersonError(''); }}
                          style={{ ...styles.navBtnGhost, padding: '10px 14px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Step>
          )}

          {step === 'review' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="Looks good?"
              sub="Quick review before we create the project."
            >
              <div style={styles.reviewCard}>
                <ReviewRow label="Project name" value={name || 'Not set'} />
                <ReviewRow label="Type" value={type || 'Not set'} />
                <ReviewRow label="Address" value={(address.street || address.city || address.zip) ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ') : 'Not set'} />
                {/* Only worth reviewing when it was a decision. With one
                    showroom this row would just restate the obvious. */}
                {multiShowroom && (
                  <ReviewRow
                    label="Showroom"
                    value={showroomOptions.find((s) => s.id === showroomId)?.name || 'Not set'}
                  />
                )}
                <ReviewRow label="Budget" value={budgetRange} />
                <ReviewRow label="Target completion" value={targetCompletion || 'Not set'} />
                <ReviewRow
                  label="Rooms"
                  value={rooms.map((r) => r.name).join(', ') || 'None yet'}
                />
                <ReviewRow
                  label="Team"
                  value={
                    connections.filter((c) => teamSelections[c.id]).map((c) => c.name).join(', ') || 'No teammates yet'
                  }
                />
              </div>
              {error && <div style={{ fontSize: 13, color: colors.red, marginTop: 12 }}>{error}</div>}
            </Step>
          )}

          <div style={styles.nav}>
            <button
              onClick={goBack}
              disabled={stepIndex === 0 || saving}
              style={{
                ...styles.navBtnGhost,
                visibility: stepIndex === 0 ? 'hidden' : 'visible',
                opacity: saving ? 0.6 : 1,
              }}
            >← Back</button>

            {step === 'review' ? (
              <button
                onClick={createProject}
                disabled={!name.trim() || !type || saving}
                style={{
                  ...styles.navBtnPrimary,
                  opacity: !name.trim() || !type || saving ? 0.6 : 1,
                  cursor: !name.trim() || !type || saving ? 'not-allowed' : 'pointer',
                }}
              >{saving ? 'Creating…' : 'Create project →'}</button>
            ) : (
              <button
                onClick={goNext}
                disabled={!stepValid()}
                style={{
                  ...styles.navBtnPrimary,
                  opacity: stepValid() ? 1 : 0.5,
                  cursor: stepValid() ? 'pointer' : 'not-allowed',
                }}
              >
                {(step === 'address' || step === 'scope' || step === 'rooms') && 'Skip / Continue →'}
                {step !== 'address' && step !== 'scope' && step !== 'rooms' && 'Continue →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ eyebrow, title, sub, children }) {
  return (
    <div>
      <div style={styles.eyebrow}>{eyebrow}</div>
      <h1 style={styles.title}>{title}</h1>
      {sub && <p style={styles.sub}>{sub}</p>}
      <div style={{ marginTop: 24 }}>{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={styles.reviewRow}>
      <div style={styles.reviewLabel}>{label}</div>
      <div style={styles.reviewValue}>{value}</div>
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
    maxWidth: 720,
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
    marginBottom: 24,
  },
  progressRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 24,
    paddingInline: 4,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    transition: 'background 0.2s',
  },
  card: {
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 14,
    padding: '32px',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.red,
    marginBottom: 8,
  },
  title: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: 28,
    lineHeight: 1.2,
    color: colors.gray900,
    margin: 0,
  },
  sub: {
    fontSize: 14,
    color: colors.gray500,
    margin: '8px 0 0',
    lineHeight: 1.5,
  },
  chipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
  },
  typeCard: {
    border: '2px solid',
    borderRadius: 12,
    padding: '20px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
    // Flex-centred rather than relying on textAlign: the icon is an <svg>, and
    // Tailwind's preflight sets `svg { display: block }`, so textAlign can't
    // centre it -- it would sit hard against the left edge.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A row, not a tile like typeCard: a showroom carries an address and an
  // account manager, which want to read left to right against the icon.
  showroomCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    border: '2px solid',
    borderRadius: 12,
    padding: '16px 16px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    padding: '8px 14px',
    fontSize: 13,
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  bigInput: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 17,
    border: `1.5px solid ${colors.gray300}`,
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    border: `1px solid ${colors.gray300}`,
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    width: '100%',
  },
  reviewCard: {
    background: colors.gray100,
    borderRadius: 10,
    padding: '4px 18px',
  },
  reviewRow: {
    display: 'flex',
    gap: 16,
    padding: '14px 0',
    borderBottom: `1px solid ${colors.gray200}`,
  },
  reviewLabel: {
    fontSize: 13,
    color: colors.gray500,
    fontWeight: 500,
    minWidth: 140,
  },
  reviewValue: {
    fontSize: 14,
    color: colors.gray900,
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 20,
    borderTop: `1px solid ${colors.gray100}`,
  },
  navBtnGhost: {
    padding: '12px 18px',
    background: 'none',
    color: colors.gray700,
    border: 'none',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navBtnPrimary: {
    padding: '13px 26px',
    background: colors.darkBlue,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
