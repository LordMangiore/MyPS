import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle, Mail } from 'lucide-react';
import { iconForProjectType } from './project-type-icons';
import { useAuth } from './auth-context';
import { clearGuestCart } from './guest-cart';

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

const AUDIENCE_OPTIONS = [
  { value: 'tradepro', label: 'Trade pro', body: 'Contractor, designer, or builder buying for clients.' },
  { value: 'homeowner-with-pro', label: 'Homeowner working with a pro', body: 'I have a contractor or designer involved.' },
  { value: 'homeowner-diy', label: 'Homeowner shopping myself', body: "I'm researching for my own project." },
];

const BUDGET_OPTIONS = [
  'Under $5,000',
  '$5,000 – $15,000',
  '$15,000 – $50,000',
  '$50,000 – $100,000',
  '$100,000+',
  'Not sure yet',
];

// Icons come from project-type-icons.js, keyed by label.
const PROJECT_TYPES = [
  { value: 'Kitchen Remodel', label: 'Kitchen' },
  { value: 'Bathroom Remodel', label: 'Bathroom' },
  { value: 'Flooring', label: 'Flooring' },
  { value: 'Full Home Renovation', label: 'Whole home' },
  { value: 'New Construction', label: 'New build' },
  { value: 'Countertops', label: 'Countertops' },
  { value: 'Cabinets', label: 'Cabinets' },
  { value: 'Other', label: 'Other' },
];

const TIMING_OPTIONS = [
  { value: 'asap', label: 'ASAP', body: 'Ready to start now.' },
  { value: '1-3', label: 'Within 1–3 months', body: 'Planning the project.' },
  { value: '3-6', label: '3–6 months out', body: 'Early planning stage.' },
  { value: 'exploring', label: 'Just exploring', body: 'Gathering ideas.' },
];

// Order: qualifying questions first (audience, project, where, budget, timing),
// then optional context (notes), then identity (contact, verify), then success.
const stepIds = ['audience', 'project', 'where', 'budget', 'timing', 'notes', 'contact', 'verify', 'success'];
// Substantive step count for the "Step X of N" eyebrow — excludes verify + success.
const NUM_FORM_STEPS = 7;

const QuoteWizard = ({ isOpen, onClose, cartItems = [], intent = 'quote' }) => {
  // intent === 'quote' → AM gets a hot-lead notification.
  // intent === 'save'  → same project/account creation, but no quote signal
  //                      to the AM. They still see the lead, just as warm.
  const isSave = intent === 'save';
  const { finalizeSession, requestCode, verifyCode } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const step = stepIds[stepIndex];

  const [audience, setAudience] = useState('');
  const [projectType, setProjectType] = useState('');
  const [zip, setZip] = useState('');
  const [budget, setBudget] = useState('');
  const [timing, setTiming] = useState('');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { projectId, showroom, accountManager }

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setAudience('');
    setProjectType('');
    setZip('');
    setBudget('');
    setTiming('');
    setNotes('');
    setContact({ firstName: '', lastName: '', email: '', phone: '' });
    setCode('');
    setBusy(false);
    setError('');
    setResult(null);
  }, [isOpen]);

  const cartSubtotal = useMemo(
    () => cartItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
    [cartItems]
  );

  const goNext = () => { setError(''); setStepIndex((i) => Math.min(i + 1, stepIds.length - 1)); };
  const goBack = () => { setError(''); setStepIndex((i) => Math.max(i - 1, 0)); };

  const stepValid = () => {
    if (step === 'audience') return !!audience;
    if (step === 'project') return !!projectType;
    if (step === 'where') return /^\d{5}/.test(zip.trim());
    if (step === 'budget') return !!budget;
    if (step === 'timing') return !!timing;
    if (step === 'contact') {
      return contact.firstName.trim() && contact.email.trim() && /\S+@\S+\.\S+/.test(contact.email);
    }
    if (step === 'verify') return code.length === 6;
    return true;
  };

  const [foundAccount, setFoundAccount] = useState(null);

  // Step 5 (contact) → Send code. OTP works for both new sign-ups and returning
  // accounts, so we don't gate the flow when an existing email is found — we
  // just surface that they have an account so they aren't surprised when the
  // app drops them straight into their existing profile after verification.
  const sendCode = async () => {
    setBusy(true);
    setError('');
    setFoundAccount(null);
    try {
      const emailLower = contact.email.trim().toLowerCase();
      // Best-effort lookup so we can show the "welcome back" message.
      // Failure here shouldn't block sending the code.
      try {
        const lookup = await fetch(`/api/lookup-user?email=${encodeURIComponent(emailLower)}`)
          .then((r) => r.json());
        if (lookup?.found) setFoundAccount(lookup.user);
      } catch {}
      await requestCode(emailLower);
      goNext();
    } catch (err) {
      setError(err.message || 'Could not send code.');
    } finally {
      setBusy(false);
    }
  };

  // Step 6 (verify) → finalize: verify OTP, submit quote, navigate.
  const verifyAndSubmit = async () => {
    setBusy(true);
    setError('');
    try {
      const verifyData = await verifyCode(contact.email.trim(), code.trim());
      const user = verifyData.user;
      const session = {
        email: user.email,
        name: contact.firstName || (user.name || user.email.split('@')[0]),
        userId: user.id,
        token: verifyData.token,
        isNewUser: !!verifyData.isNewUser,
        firebaseUid: user.firebaseUid || null,
        userType: 'homeowner',
      };

      const res = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          phone: contact.phone.trim(),
          audience,
          projectType,
          zip: zip.trim(),
          budget,
          timing,
          notes: notes.trim(),
          cartItems,
          intent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit quote');
      }

      finalizeSession({
        ...session,
        showroom: data.showroom,
        accountManager: data.accountManager,
      });
      setResult({
        projectId: data.projectId,
        showroom: data.showroom,
        accountManager: data.accountManager,
      });
      clearGuestCart();
      goNext(); // success step
    } catch (err) {
      setError(err.message || 'Could not verify code.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div onClick={onClose} style={styles.backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>

        <div style={styles.progressBar}>
          {stepIds.map((id, i) => (
            <div key={id} style={{
              flex: 1, height: 3,
              background: i < stepIndex ? colors.darkBlue : i === stepIndex ? colors.red : colors.gray200,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={styles.body}>
          {step === 'audience' && (
            <Step
              eyebrow={`Step 1 of ${NUM_FORM_STEPS}`}
              title="Who's the project for?"
              sub={isSave
                ? `We'll set up your project and assign you an account manager. No pricing request — your AM will be there when you're ready. ${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} go into the project.`
                : `Helps us match you to the right account manager. ${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} in your cart will come with the request.`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    style={{
                      ...styles.choiceCard,
                      borderColor: audience === opt.value ? colors.darkBlue : colors.gray200,
                      background: audience === opt.value ? '#f0f5ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: colors.gray500 }}>{opt.body}</div>
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 'project' && (
            <Step
              eyebrow={`Step 2 of ${NUM_FORM_STEPS}`}
              title="What's the project?"
              sub="Pick the closest match. Your account manager can refine it with you."
            >
              <div style={styles.chipGrid}>
                {PROJECT_TYPES.map((t) => {
                  const Icon = iconForProjectType(t.label);
                  const selected = projectType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setProjectType(t.value)}
                      style={{
                        ...styles.typeCard,
                        borderColor: selected ? colors.darkBlue : colors.gray200,
                        background: selected ? '#f0f5ff' : '#fff',
                      }}
                    >
                      <Icon
                        size={24}
                        strokeWidth={1.5}
                        color={selected ? colors.darkBlue : colors.gray500}
                        style={{ marginBottom: 6 }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray900 }}>{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 'where' && (
            <Step eyebrow={`Step 3 of ${NUM_FORM_STEPS}`} title="Where is the project?" sub="Zip code is enough. We'll route to your nearest ProSource showroom.">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, ''))}
                placeholder="Zip code"
                style={{ ...styles.bigInput, maxWidth: 200 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && stepValid()) goNext(); }}
                maxLength={10}
              />
            </Step>
          )}

          {step === 'budget' && (
            <Step
              eyebrow={`Step 4 of ${NUM_FORM_STEPS}`}
              title="What's the rough budget?"
              sub="A range is fine. It keeps your account manager's recommendations realistic."
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {BUDGET_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBudget(opt)}
                    style={{
                      ...styles.choiceCard,
                      textAlign: 'center',
                      borderColor: budget === opt ? colors.darkBlue : colors.gray200,
                      background: budget === opt ? '#f0f5ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900 }}>{opt}</div>
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 'timing' && (
            <Step eyebrow={`Step 5 of ${NUM_FORM_STEPS}`} title="When do you want to start?" sub="No commitments. Helps your account manager prioritize.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TIMING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTiming(opt.value)}
                    style={{
                      ...styles.choiceCard,
                      borderColor: timing === opt.value ? colors.darkBlue : colors.gray200,
                      background: timing === opt.value ? '#f0f5ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: colors.gray500 }}>{opt.body}</div>
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 'notes' && (
            <Step eyebrow={`Step 6 of ${NUM_FORM_STEPS} · Optional`} title="Anything else we should know?" sub="Specific colors, rooms, deadlines, photos to send later. Whatever helps.">
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                style={styles.textarea}
              />
            </Step>
          )}

          {step === 'contact' && (
            <Step eyebrow={`Step 7 of ${NUM_FORM_STEPS}`} title="Where should we reach you?" sub="We'll send a 6-digit code to confirm your email.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="First name">
                    <input autoFocus type="text" value={contact.firstName}
                      onChange={(e) => {
                        setContact({ ...contact, firstName: e.target.value });
                        setFoundAccount(null);
                      }}
                      style={styles.input} />
                  </Field>
                  <Field label="Last name">
                    <input type="text" value={contact.lastName}
                      onChange={(e) => {
                        setContact({ ...contact, lastName: e.target.value });
                        setFoundAccount(null);
                      }}
                      style={styles.input} />
                  </Field>
                </div>
                <Field label="Email">
                  <input type="email" value={contact.email}
                    onChange={(e) => {
                      setContact({ ...contact, email: e.target.value });
                      setFoundAccount(null);
                    }}
                    placeholder="name@email.com" style={styles.input} />
                </Field>
                <Field label="Phone (optional)">
                  <input type="tel" value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    placeholder="(555) 555-0000" style={styles.input} />
                </Field>
              </div>

              {error && <div style={{ fontSize: 12, color: colors.red, marginTop: 10 }}>{error}</div>}
            </Step>
          )}

          {step === 'verify' && (
            <Step
              eyebrow="Almost there"
              title={foundAccount ? "Welcome back." : "Check your email."}
              sub={foundAccount
                ? `We found your ProSource account. Enter the code we sent to ${contact.email} to sign in and submit your quote.`
                : `We sent a 6-digit code to ${contact.email}.`}
            >
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                style={{ ...styles.bigInput, letterSpacing: 8, fontSize: 22, textAlign: 'center', maxWidth: 220 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && stepValid()) verifyAndSubmit(); }}
              />
              {error && <div style={{ fontSize: 12, color: colors.red, marginTop: 10 }}>{error}</div>}
              <div style={{ marginTop: 12, fontSize: 12, color: colors.gray500 }}>
                Didn't get it?{' '}
                <button
                  onClick={sendCode}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: colors.darkBlue, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12,
                  }}
                >Resend code</button>
              </div>
            </Step>
          )}

          {step === 'success' && result && (
            <Step
              title={isSave ? 'Project saved.' : "You're set."}
              sub={isSave
                ? `${result.accountManager?.name || 'Your account manager'} will be there when you're ready for pricing.`
                : `${result.accountManager?.name || 'Your account manager'} will reach out within a business day.`}
            >
              <div style={styles.summaryCard}>
                <SummaryRow label="Showroom" value={result.showroom?.name || 'Nearest ProSource'} />
                <SummaryRow label="Account Manager" value={result.accountManager?.name || '—'} />
                <SummaryRow label="Project" value={projectType} />
                <SummaryRow label="Budget" value={budget || '—'} />
                <SummaryRow label="Items" value={`${cartItems.length} (subtotal $${cartSubtotal.toFixed(2)})`} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: colors.green, fontSize: 13 }}>
                <CheckCircle size={18} /> {isSave ? 'Project created. No quote requested yet.' : 'Project created and your AM is notified'}
              </div>
            </Step>
          )}
        </div>

        <div style={styles.nav}>
          {step === 'success' ? (
            <button
              onClick={() => {
                if (result?.projectId) navigate(`/projects/${result.projectId}`);
                onClose();
              }}
              style={{ ...styles.navBtnPrimary, marginLeft: 'auto' }}
            >Open my project →</button>
          ) : (
            <>
              <button
                onClick={goBack}
                disabled={stepIndex === 0 || busy}
                style={{ ...styles.navBtnGhost, visibility: stepIndex === 0 ? 'hidden' : 'visible' }}
              >← Back</button>
              {step === 'contact' ? (
                <button
                  onClick={sendCode}
                  disabled={!stepValid() || busy}
                  style={{
                    ...styles.navBtnPrimary,
                    opacity: stepValid() && !busy ? 1 : 0.5,
                    cursor: stepValid() && !busy ? 'pointer' : 'not-allowed',
                  }}
                >{busy ? 'Sending code…' : 'Send verification code →'}</button>
              ) : step === 'verify' ? (
                <button
                  onClick={verifyAndSubmit}
                  disabled={!stepValid() || busy}
                  style={{
                    ...styles.navBtnPrimary,
                    opacity: stepValid() && !busy ? 1 : 0.5,
                    cursor: stepValid() && !busy ? 'pointer' : 'not-allowed',
                  }}
                >{busy ? 'Submitting…' : 'Submit quote →'}</button>
              ) : (
                <button
                  onClick={goNext}
                  disabled={!stepValid()}
                  style={{
                    ...styles.navBtnPrimary,
                    opacity: stepValid() ? 1 : 0.5,
                    cursor: stepValid() ? 'pointer' : 'not-allowed',
                  }}
                >Continue →</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function Step({ eyebrow, title, sub, children }) {
  return (
    <div>
      {eyebrow && <div style={styles.eyebrow}>{eyebrow}</div>}
      <h2 style={styles.title}>{title}</h2>
      {sub && <p style={styles.sub}>{sub}</p>}
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.gray700 }}>{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value || '—'}</span>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, zIndex: 1000,
    fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  modal: {
    background: '#fff', borderRadius: 14,
    width: '100%', maxWidth: 540,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex', flexDirection: 'column',
    maxHeight: '92vh',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    background: 'none', border: 'none', color: colors.gray500,
    cursor: 'pointer', padding: 4, zIndex: 10,
  },
  progressBar: { display: 'flex', gap: 4, padding: '16px 16px 0' },
  body: {
    padding: '20px 28px 12px',
    overflowY: 'auto',
    flex: 1,
  },
  eyebrow: {
    fontSize: 11, fontWeight: 600,
    letterSpacing: 1.4, textTransform: 'uppercase',
    color: colors.red, marginBottom: 8,
  },
  title: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: 22, lineHeight: 1.2,
    color: colors.gray900, margin: 0,
  },
  sub: {
    fontSize: 13, color: colors.gray500,
    margin: '8px 0 0', lineHeight: 1.5,
  },
  chipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
  },
  typeCard: {
    border: '2px solid',
    borderRadius: 10,
    padding: '14px 8px',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
    // Flex-centred: the icon is an <svg> and preflight makes svg display:block,
    // so textAlign alone would leave it against the left edge.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCard: {
    border: '1.5px solid',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'all 0.12s ease',
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
  textarea: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    border: `1.5px solid ${colors.gray300}`,
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 130,
    boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  summaryCard: {
    background: colors.gray100,
    borderRadius: 10,
    padding: '4px 16px',
  },
  summaryRow: {
    display: 'flex', gap: 16,
    padding: '12px 0',
    borderBottom: `1px solid ${colors.gray200}`,
  },
  summaryLabel: {
    fontSize: 11, color: colors.gray500,
    fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: 0.5, minWidth: 100,
  },
  summaryValue: {
    fontSize: 14, color: colors.gray900,
    fontWeight: 500, flex: 1, minWidth: 0,
  },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 24px 18px', borderTop: `1px solid ${colors.gray100}`,
  },
  navBtnGhost: {
    padding: '10px 14px', background: 'none', color: colors.gray700,
    border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navBtnPrimary: {
    padding: '11px 22px', background: colors.darkBlue, color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};

export default QuoteWizard;
