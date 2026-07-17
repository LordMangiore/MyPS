import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle, Mail } from 'lucide-react';
import { iconForProjectType } from './project-type-icons';
import { useAuth } from './auth-context';

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

const SIZE_OPTIONS = [
  'Under $5,000',
  '$5,000-$15,000',
  '$15,000-$50,000',
  '$50,000-$100,000',
  '$100,000+',
  'Not sure yet',
];

const TIMING_OPTIONS = [
  { value: 'asap', label: 'ASAP', body: 'Ready to start now.' },
  { value: '1-3', label: 'Within 1-3 months', body: 'Planning the project now.' },
  { value: '3-6', label: '3-6 months out', body: 'Early planning stage.' },
  { value: 'exploring', label: 'Just exploring', body: 'Gathering ideas.' },
];

const stepIds = ['project', 'where', 'size', 'timing', 'message', 'contact', 'confirm'];

const ConsultationWizard = ({ isOpen, onClose, pro = null }) => {
  const { userId, userEmail, userName, profile, loadUserData, saveUserData } = useAuth();
  const proName = pro?.name || 'this pro';
  const proInitials = pro?.initials || (proName.split(/\s+/).map((s) => s[0]).join('').slice(0, 2) || 'PS');

  const [stepIndex, setStepIndex] = useState(0);
  const step = stepIds[stepIndex];

  const [projectType, setProjectType] = useState('');
  const [zip, setZip] = useState('');
  const [budget, setBudget] = useState('');
  const [timing, setTiming] = useState('');
  const [message, setMessage] = useState('');
  const [touchedMessage, setTouchedMessage] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [requestSummary, setRequestSummary] = useState(null);

  // Reset everything when the modal opens. Prefill contact from session if
  // the visitor is already logged in.
  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setProjectType('');
    setZip(profile?.businessAddress?.zip || profile?.address?.zip || '');
    setBudget('');
    setTiming('');
    setMessage('');
    setTouchedMessage(false);
    setContact({
      // The profile is the better source: this field wants a full name, and
      // `userName` is the session's display name, which is usually just a first
      // name. It stays as the fallback for the window before the profile loads.
      // A guest has neither and starts empty.
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || userName || '',
      email: userEmail || '',
      phone: profile?.phone || '',
    });
    setError('');
    setBusy(false);
    setSubmitted(false);
    setRequestSummary(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-compose a friendly default message when the user reaches the message
  // step, before they touch it. Includes the chosen project type + zip so the
  // pro can size up the lead at a glance.
  const suggestedMessage = useMemo(() => {
    if (!projectType) return '';
    const opener = `Hi ${proName.split(/\s+/)[0] || 'there'},`;
    const intro = `I'm looking into a ${projectType.toLowerCase()}`;
    const where = zip ? ` in ${zip}` : '';
    const close = `. Would love to chat about what's possible.`;
    return `${opener}\n\n${intro}${where}${close}`;
  }, [projectType, zip, proName]);

  useEffect(() => {
    if (!touchedMessage && suggestedMessage) setMessage(suggestedMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedMessage]);

  const goNext = () => { setError(''); setStepIndex((i) => Math.min(i + 1, stepIds.length - 1)); };
  const goBack = () => { setError(''); setStepIndex((i) => Math.max(i - 1, 0)); };

  const stepValid = () => {
    if (step === 'project') return !!projectType;
    if (step === 'where') return /^\d{5}/.test(zip.trim());
    if (step === 'size') return !!budget;
    if (step === 'timing') return !!timing;
    if (step === 'message') return message.trim().length > 0;
    if (step === 'contact') {
      return !!contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email.trim());
    }
    return true;
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        toProName: pro?.name || proName,
        toProUserId: pro?.userId || null,
        fromName: contact.name.trim(),
        fromEmail: contact.email.trim(),
        fromPhone: contact.phone.trim(),
        fromUserId: userId || null,
        projectType,
        zip: zip.trim(),
        budget,
        timing,
        message: message.trim(),
        createdAt: Date.now(),
      };

      // Notify the pro. Server takes care of: writing to the pro's consultation
      // requests blob, putting it on an account manager's queue, kicking off a
      // Twilio conversation (if both sides have identities), and emailing.
      //
      // This call is the request. Nothing below it may run unless the server
      // accepted, or the confirm step promises a pro is on their way over a
      // rejection nobody saw. A failure leaves the wizard on the contact step
      // with the error visible and the button live, which is the retry.
      const res = await fetch('/api/consultation-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not send your request. Try again.');
      }

      // Persist a copy for the requester (if they're logged in). Useful to
      // show "Consultations requested" in a future history view, so it carries
      // the server's id: the two copies are unlinkable without it.
      //
      // Saved only once the request is real, and best-effort even then. The
      // server already holds the request by this point, both as its own record
      // and on the account manager's work queue (consultation-request.mjs), so
      // losing this copy loses a history entry, not the consultation. Note it is
      // the QUEUE that carries it, not a pro: the profile that opens this wizard
      // passes `userId: null`, so there is nobody to route it to yet. That is
      // WP11, and it is why this comment does not promise otherwise.
      if (userId) {
        try {
          const existing = await loadUserData('consultations', null);
          const list = Array.isArray(existing?.list) ? existing.list : [];
          await saveUserData('consultations', {
            list: [...list, { ...payload, id: data.requestId, role: 'requester' }],
          });
        } catch (err) {
          console.warn('Consultation save failed:', err.message);
        }
      }

      setRequestSummary(payload);
      setSubmitted(true);
      goNext();
    } catch (err) {
      setError(err.message || 'Could not send your request.');
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
              background: submitted || i < stepIndex ? colors.darkBlue : i === stepIndex ? colors.red : colors.gray200,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={styles.proHeader}>
          <div style={styles.proAvatar}>{proInitials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: colors.gray500, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Request a Consultation
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.gray900 }}>{proName}</div>
          </div>
        </div>

        <div style={styles.body}>
          {step === 'project' && (
            <Step title="What's the project?" sub="Pick the closest match. You can refine later.">
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
            <Step title="Where's the project?" sub="A zip code is enough to figure out the nearest showroom.">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={10}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, ''))}
                placeholder="Zip code"
                style={{ ...styles.bigInput, maxWidth: 180 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && stepValid()) goNext(); }}
              />
            </Step>
          )}

          {step === 'size' && (
            <Step title="What's the rough budget?" sub="A range is fine. It keeps your pro's recommendations realistic.">
              <div style={styles.chipRow}>
                {SIZE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setBudget(s)}
                    style={{
                      ...styles.chip,
                      borderColor: budget === s ? colors.darkBlue : colors.gray300,
                      background: budget === s ? '#f0f5ff' : '#fff',
                      color: budget === s ? colors.darkBlue : colors.gray700,
                      fontWeight: budget === s ? 600 : 500,
                    }}
                  >{s}</button>
                ))}
              </div>
            </Step>
          )}

          {step === 'timing' && (
            <Step title="When do you want to start?" sub="No commitments. Just helps us prioritize.">
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

          {step === 'message' && (
            <Step title="Anything to add?" sub={`Whatever you'd want ${proName.split(/\s+/)[0] || 'them'} to know going in.`}>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setTouchedMessage(true); }}
                placeholder={suggestedMessage}
                style={styles.textarea}
              />
            </Step>
          )}

          {step === 'contact' && (
            <Step title="How can they reach you?" sub={userId ? "Confirm your details so they know who they're talking to." : "They'll reach out within a business day."}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Your name">
                  <input
                    autoFocus
                    type="text"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    placeholder="Full name"
                    style={styles.input}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    placeholder="name@email.com"
                    style={styles.input}
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    placeholder="(555) 555-0000"
                    style={styles.input}
                  />
                </Field>
              </div>
              {error && <div style={{ fontSize: 12, color: colors.red, marginTop: 10 }}>{error}</div>}
            </Step>
          )}

          {step === 'confirm' && submitted && requestSummary && (
            <Step title="You're in." sub={`${proName} will reach out shortly.`}>
              <div style={styles.summaryCard}>
                <SummaryRow label="Project" value={requestSummary.projectType} />
                <SummaryRow label="Where" value={requestSummary.zip} />
                <SummaryRow label="Budget" value={requestSummary.budget} />
                <SummaryRow label="Timing" value={(TIMING_OPTIONS.find((t) => t.value === requestSummary.timing) || {}).label || ''} />
                <SummaryRow label="From" value={`${requestSummary.fromName} · ${requestSummary.fromEmail}`} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: colors.green, fontSize: 13 }}>
                <CheckCircle size={18} /> Sent to {proName}
              </div>
              {!userId && (
                <div style={{ marginTop: 16, padding: 14, background: '#f0f5ff', borderRadius: 8, fontSize: 13, color: colors.darkBlue, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Mail size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>We sent a one-tap link to <strong>{requestSummary.fromEmail}</strong> so you can track the conversation in your inbox or claim a ProSource account.</span>
                </div>
              )}
            </Step>
          )}
        </div>

        <div style={styles.nav}>
          {!submitted ? (
            <>
              <button
                onClick={goBack}
                disabled={stepIndex === 0 || busy}
                style={{ ...styles.navBtnGhost, visibility: stepIndex === 0 ? 'hidden' : 'visible' }}
              >← Back</button>
              {step === 'contact' ? (
                <button
                  onClick={submit}
                  disabled={!stepValid() || busy}
                  style={{
                    ...styles.navBtnPrimary,
                    opacity: stepValid() && !busy ? 1 : 0.5,
                    cursor: stepValid() && !busy ? 'pointer' : 'not-allowed',
                  }}
                >{busy ? 'Sending…' : 'Send request →'}</button>
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
          ) : (
            <button onClick={onClose} style={{ ...styles.navBtnPrimary, marginLeft: 'auto' }}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
};

function Step({ title, sub, children }) {
  return (
    <div>
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
      <span style={styles.summaryValue}>{value || 'Not set'}</span>
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
  proHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 28px 0',
  },
  proAvatar: {
    width: 40, height: 40, borderRadius: '50%',
    background: `linear-gradient(135deg, ${colors.lightBlue} 0%, ${colors.darkBlue} 100%)`,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 14, flexShrink: 0,
  },
  body: {
    padding: '20px 28px 12px',
    overflowY: 'auto',
    flex: 1,
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
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '10px 14px',
    fontSize: 13,
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
    letterSpacing: 0.5, minWidth: 80,
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

export default ConsultationWizard;
