import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, X, Plus } from 'lucide-react';
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

const PROJECT_TYPES = [
  { value: 'Kitchen Remodel', label: 'Kitchen', emoji: '🍳' },
  { value: 'Bathroom Remodel', label: 'Bathroom', emoji: '🛁' },
  { value: 'Flooring', label: 'Flooring', emoji: '🪵' },
  { value: 'Full Home Renovation', label: 'Whole home', emoji: '🏡' },
  { value: 'New Construction', label: 'New build', emoji: '🏗️' },
  { value: 'Commercial', label: 'Commercial', emoji: '🏢' },
  { value: 'Countertops Only', label: 'Countertops', emoji: '🪨' },
  { value: 'Cabinets Only', label: 'Cabinets', emoji: '🗄️' },
  { value: 'Other', label: 'Other', emoji: '✨' },
];

const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $10,000',
  '$10,000 - $15,000',
  '$15,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+',
  'Not Sure Yet',
];

const STATES = ['MO', 'IL', 'TX', 'CA', 'FL', 'NY', 'NC', 'OH', 'PA', 'GA', 'WA', 'CO'];

const stepIds = ['type', 'name', 'address', 'scope', 'team', 'review'];

export default function ProSourceProjectCreate() {
  const { userId, userName, loadUserData, saveUserData } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const step = stepIds[stepIndex];

  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [touchedName, setTouchedName] = useState(false);
  const [address, setAddress] = useState({ street: '', city: '', state: 'MO', zip: '' });
  const [budgetRange, setBudgetRange] = useState('Not Sure Yet');
  const [targetCompletion, setTargetCompletion] = useState('');
  const [connections, setConnections] = useState([]);
  const [teamSelections, setTeamSelections] = useState({}); // connectionId → bool
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load connections so the team step can offer real people.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('connections', null).then((stored) => {
      if (cancelled) return;
      const list = Array.isArray(stored?.list) ? stored.list : [];
      setConnections(list);
      // Pre-check ProSource showroom contacts (Kim + Heather etc.)
      const initial = {};
      list.forEach((c) => {
        if (c.type === 'prosource') initial[c.id] = true;
      });
      setTeamSelections(initial);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    if (!userId) return;
    setSaving(true);
    setError('');
    try {
      const stored = await loadUserData('projects', null);
      const list = Array.isArray(stored?.list) ? stored.list : [];
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
        rooms: [],
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
                {PROJECT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    style={{
                      ...styles.typeCard,
                      borderColor: type === t.value ? colors.darkBlue : colors.gray200,
                      background: type === t.value ? '#f0f5ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{t.emoji}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{t.label}</div>
                  </button>
                ))}
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

          {step === 'team' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="Bring in your team."
              sub="Your ProSource showroom team is already added. Toggle anyone else."
            >
              {connections.length === 0 ? (
                <div style={{ fontSize: 14, color: colors.gray500, padding: 16 }}>
                  No connections yet. You can add them after creating the project.
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
            </Step>
          )}

          {step === 'review' && (
            <Step
              eyebrow={`Step ${stepIndex + 1} of ${stepIds.length}`}
              title="Looks good?"
              sub="Quick review before we create the project."
            >
              <div style={styles.reviewCard}>
                <ReviewRow label="Project name" value={name || '—'} />
                <ReviewRow label="Type" value={type || '—'} />
                <ReviewRow label="Address" value={(address.street || address.city || address.zip) ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ') : 'Not set'} />
                <ReviewRow label="Budget" value={budgetRange} />
                <ReviewRow label="Target completion" value={targetCompletion || 'Not set'} />
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
                {(step === 'address' || step === 'scope') && 'Skip / Continue →'}
                {step !== 'address' && step !== 'scope' && 'Continue →'}
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
