import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from './auth-context';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  lightBlue: '#6CACE4',
  green: '#07542E',
  amber: '#d97706',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

const HELP_OPTIONS = [
  { value: 'plan', label: 'Plan a remodel', body: 'Walk through ideas and get pointed to the right products.' },
  { value: 'browse', label: 'Browse products with a pro', body: 'Hands-on session in the showroom with samples and finishes.' },
  { value: 'estimate', label: 'Get an estimate', body: 'Put together a quote for a specific scope.' },
  { value: 'samples', label: 'Pick up samples', body: 'Grab tile, flooring, or finish samples for a client meeting.' },
  { value: 'other', label: 'Something else', body: 'Tell us what you need.' },
];

/**
 * The hours you may ASK for, not real availability.
 *
 * There is no calendar behind this modal and no free/busy source to ask, so
 * these are showroom hours. This grid used to grey out invented per-person
 * "booked" slots, which read as a real diary and was fabricated: nobody's
 * 10:30 was ever taken. The account manager settles the time from the queue, so
 * what the member picks here is a preference, and a preference cannot clash.
 */
const MORNING_TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'];
const AFTERNOON_TIMES = ['1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];

// Build a list of upcoming weekdays for the day picker.
const upcomingDays = (count = 6) => {
  const out = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1); // start tomorrow
  while (out.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      out.push({
        ts: cursor.getTime(),
        day: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
        date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        iso: cursor.toISOString().slice(0, 10),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/** Account manager records carry `initials`; derive them for one that doesn't. */
const initialsFor = (name) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'PS';

const AppointmentModal = ({ isOpen, onClose }) => {
  const { userId, userEmail, userName, profile, showrooms, loadUserData, saveUserData } = useAuth();

  /**
   * The request goes to the account's primary showroom, and there is deliberately
   * no step to choose another.
   *
   * Not because choosing is meaningless (an account really can hold more than one
   * showroom: Justin holds St. Louis and Chicago), but because only one end of
   * that choice can be answered. This request lands on `queue/<showroomId>`, and
   * an account manager's console reads the queue for the showrooms HER OWN
   * account is assigned to (see activeShowroomId in src/prosource-am-console.jsx).
   * Tessa is the only account that can open the console and she is St. Louis
   * staff, so anything routed anywhere else is written to a queue that nobody in
   * this demo can select. Chicago's account manager, Denise Okafor, is an AI
   * persona with no console to open.
   *
   * So a picker here would let someone send a real request into a hole and be
   * told it arrived. Routing to the primary is also what the quote path already
   * does: submit-quote.mjs sends to the showroom it resolved, and never asks.
   * Give this a second showroom to be answered at and the step can come back.
   */
  const stepIds = useMemo(
    () => ['what', 'when', 'time', 'notes', 'confirm'],
    []
  );
  // `confirm` is the outcome, not something the member fills in, so it is
  // neither counted in the copy nor drawn in the progress bar.
  const inputSteps = stepIds.slice(0, -1);

  const [stepIndex, setStepIndex] = useState(0);
  const step = stepIds[stepIndex];
  const stepLabel = `Step ${stepIndex + 1} of ${inputSteps.length}`;

  const [help, setHelp] = useState('');
  const days = useMemo(() => upcomingDays(6), []);
  const [selectedDay, setSelectedDay] = useState(days[0]?.ts || null);
  const dayObj = days.find((d) => d.ts === selectedDay) || days[0];
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedToDashboard, setSavedToDashboard] = useState(false);

  /**
   * The account's own showroom and its own account manager, never a hardcoded
   * pair. The dashboard this modal opens over already names both, and a modal
   * offering Kim Marks at St. Louis to an account whose page says Denise Okafor
   * at Chicago is the contradiction that makes a walkthrough fall apart.
   *
   * The primary, for the reason given at stepIds: it is the only one whose queue
   * anybody can open.
   */
  const showroom = useMemo(() => showrooms[0] || null, [showrooms]);
  const host = showroom?.accountManager || null;

  const memberName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || userName || 'Member';

  useEffect(() => {
    if (!isOpen) return;
    // Reset on open so each booking starts fresh.
    setStepIndex(0);
    setHelp('');
    setSelectedTime(null);
    setNotes('');
    setSaving(false);
    setSubmitError(null);
    setSavedToDashboard(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  /**
   * A request routes to a showroom's work queue, so an account without a
   * showroom has nowhere to send one. Say that at the door rather than after
   * five steps of picking a time nobody would ever read.
   */
  if (!showroom) {
    return (
      <div onClick={handleClose} style={styles.backdrop}>
        <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
          <button onClick={handleClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
          <div style={styles.body}>
            <Step
              eyebrow="Request a Consultation"
              title="No showroom on this account yet."
              sub="An appointment is with a showroom, and this account is not assigned to one, so there is nowhere to send the request. Messaging reaches the same people and works today."
            >
              <Link
                to="/messages"
                onClick={handleClose}
                style={{ ...styles.navBtnPrimary, textDecoration: 'none', display: 'inline-block' }}
              >
                Go to Messages
              </Link>
            </Step>
          </div>
        </div>
      </div>
    );
  }

  const goNext = () => setStepIndex((i) => Math.min(i + 1, stepIds.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const stepValid = () => {
    if (step === 'what') return !!help;
    if (step === 'when') return !!selectedDay;
    if (step === 'time') return !!selectedTime;
    // Notes are optional.
    return true;
  };

  const submit = async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const topic = HELP_OPTIONS.find((h) => h.value === help);
      const trimmedNotes = notes.trim();
      const when = `${dayObj.day}, ${dayObj.date} at ${selectedTime}`;

      /**
       * The queue first, the member's own blob second, and never the other way
       * round. The queue is the only place a person actually sees this: it is
       * what an account manager watches in the AM console, and it is what turns
       * this modal from a form into a booking. Writing the dashboard first
       * would leave an appointment sitting on the member's own page that
       * nobody was ever told about, which is the exact failure this flow used
       * to ship.
       *
       * `consultation` because that is what the queue knows and what this is: a
       * request to sit down with the account manager, with a preferred time in
       * the summary. The console already renders the type as a lead to follow
       * up and dismiss, which is the right instruction for it. No email path is
       * involved anywhere here, by design.
       */
      const res = await fetch('/api/am-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enqueue',
          item: {
            type: 'consultation',
            showroomId: showroom.id,
            memberUserId: userId || null,
            memberName,
            memberEmail: userEmail || '',
            // The console renders the summary and nothing else, so anything the
            // account manager needs to act on has to be in it, notes included.
            summary: `Showroom appointment, ${(topic?.label || 'consultation').toLowerCase()}. Preferred ${when}.${
              trimmedNotes ? ` Notes: ${trimmedNotes}` : ''
            }`,
            submittedAt: Date.now(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The request could not be sent');

      /**
       * Saved separately, and the confirm step reports what actually happened
       * rather than assuming. `saveUserData` throws for a session that cannot
       * persist, and telling someone their booking is on a dashboard it never
       * reached is the same lie as the calendar invite this flow used to
       * promise. A failure here does not undo the request: a person still has
       * it, which is worth saying and worth keeping.
       */
      try {
        const existing = await loadUserData('appointments', null);
        const list = Array.isArray(existing?.list) ? existing.list : [];
        await saveUserData('appointments', {
          list: [
            ...list,
            {
              id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              person: host?.name || showroom.name,
              personRole: host?.title || 'ProSource Team',
              showroom: showroom.name,
              day: dayObj.day,
              date: dayObj.date,
              time: selectedTime,
              dateIso: dayObj.iso,
              help,
              notes: trimmedNotes,
              bookedAt: Date.now(),
              // Not 'confirmed'. Nobody has agreed to this time yet: it is in
              // the showroom's queue waiting on the account manager. The seeded
              // appointment IS confirmed and keeps saying so.
              status: 'requested',
            },
          ],
        });
        setSavedToDashboard(true);
      } catch (err) {
        console.warn('Appointment save failed:', err.message);
      }

      goNext();
    } catch (err) {
      // The request reached nobody, so there is nothing to confirm. Stay put
      // and let them retry instead of advancing to a success screen.
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={handleClose} style={styles.backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <button onClick={handleClose} style={styles.closeBtn}>
          <X size={20} />
        </button>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          {inputSteps.map((id, i) => (
            <div
              key={id}
              style={{
                flex: 1,
                height: 3,
                background: i < stepIndex ? colors.darkBlue : i === stepIndex ? colors.red : colors.gray200,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <div style={styles.body}>
          {step === 'what' && (
            <Step
              eyebrow="Request a Consultation"
              title="What can we help with today?"
              sub="Pick the closest match. Your account manager can adjust later."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {HELP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setHelp(opt.value)}
                    style={{
                      ...styles.choiceCard,
                      borderColor: help === opt.value ? colors.darkBlue : colors.gray200,
                      background: help === opt.value ? '#f0f5ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: colors.gray500, lineHeight: 1.45 }}>{opt.body}</div>
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 'when' && (
            <Step
              eyebrow={stepLabel}
              title="Pick a day."
              sub={`Weekdays at ${showroom.name}.`}
            >
              <div style={styles.dayGrid}>
                {days.map((d) => {
                  const selected = d.ts === selectedDay;
                  return (
                    <button
                      key={d.ts}
                      onClick={() => setSelectedDay(d.ts)}
                      style={{
                        ...styles.dayChip,
                        borderColor: selected ? colors.darkBlue : colors.gray200,
                        background: selected ? colors.darkBlue : '#fff',
                        color: selected ? '#fff' : colors.gray900,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>{d.day}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{d.date}</div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 'time' && (
            <Step
              eyebrow={stepLabel}
              title="What time suits you?"
              sub={`${host?.name || showroom.name} confirms the final time. ${dayObj.day}, ${dayObj.date}.`}
            >
              <div style={styles.sectionLabel}>Morning</div>
              <div style={styles.timeGrid}>
                {MORNING_TIMES.map((t) => (
                  <TimeSlot key={t} time={t} selected={selectedTime === t} onSelect={setSelectedTime} />
                ))}
              </div>
              <div style={{ ...styles.sectionLabel, marginTop: 18 }}>Afternoon</div>
              <div style={styles.timeGrid}>
                {AFTERNOON_TIMES.map((t) => (
                  <TimeSlot key={t} time={t} selected={selectedTime === t} onSelect={setSelectedTime} />
                ))}
              </div>
            </Step>
          )}

          {step === 'notes' && (
            <Step
              eyebrow={`${stepLabel} · Optional`}
              title="Anything we should know?"
              sub="Specific products, a client we'll be meeting, recordings to bring. Share whatever helps."
            >
              <textarea
                placeholder="Optional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                style={styles.textarea}
              />
              {submitError && (
                <div style={{ ...styles.statusNote, color: colors.red }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>Nothing was sent. {submitError}.</span>
                </div>
              )}
            </Step>
          )}

          {step === 'confirm' && (
            <Step
              eyebrow=""
              title="Request sent."
              sub={`${host?.name || showroom.name} has it. Nothing is booked until they confirm the time with you.`}
            >
              <div style={styles.confirmCard}>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>With</span>
                  <span style={styles.confirmValue}>
                    {host ? `${host.name} · ${host.title}` : 'Your account manager'}
                  </span>
                </div>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>Where</span>
                  <span style={styles.confirmValue}>{showroom.name}</span>
                </div>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>Requested</span>
                  <span style={styles.confirmValue}>{dayObj.day}, {dayObj.date} at {selectedTime}</span>
                </div>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>Topic</span>
                  <span style={styles.confirmValue}>
                    {(HELP_OPTIONS.find((h) => h.value === help) || {}).label || 'Not set'}
                  </span>
                </div>
                {notes.trim() && (
                  <div style={{ ...styles.confirmRow, borderBottom: 'none' }}>
                    <span style={styles.confirmLabel}>Notes</span>
                    <span style={styles.confirmValue}>{notes.trim()}</span>
                  </div>
                )}
              </div>
              {savedToDashboard ? (
                <div style={{ ...styles.statusNote, color: colors.green }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <span>Saved to your dashboard</span>
                </div>
              ) : (
                <div style={{ ...styles.statusNote, color: colors.amber }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{showroom.name} has your request, but it could not be added to your dashboard.</span>
                </div>
              )}
            </Step>
          )}
        </div>

        <div style={styles.nav}>
          {step !== 'confirm' ? (
            <>
              <button
                onClick={goBack}
                disabled={stepIndex === 0 || saving}
                style={{
                  ...styles.navBtnGhost,
                  visibility: stepIndex === 0 ? 'hidden' : 'visible',
                }}
              >← Back</button>
              {step === 'notes' ? (
                <button
                  onClick={submit}
                  disabled={saving}
                  style={{
                    ...styles.navBtnPrimary,
                    opacity: saving ? 0.7 : 1,
                  }}
                >{saving ? 'Sending…' : 'Send request →'}</button>
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
                  Continue →
                </button>
              )}
            </>
          ) : (
            <button onClick={handleClose} style={{ ...styles.navBtnPrimary, marginLeft: 'auto' }}>
              Done
            </button>
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
      <div style={{ marginTop: 22 }}>{children}</div>
    </div>
  );
}

function Avatar({ person, size = 44 }) {
  return (
    <div
      aria-label={person?.name || 'ProSource'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: person?.photoColor || colors.lightBlue,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size / 3.2),
        border: `2px solid ${colors.lightBlue}`,
        flexShrink: 0,
      }}
    >
      {person?.initials || initialsFor(person?.name)}
    </div>
  );
}

function TimeSlot({ time, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(time)}
      style={{
        ...styles.timeChip,
        borderColor: selected ? colors.darkBlue : colors.gray300,
        background: selected ? colors.darkBlue : '#fff',
        color: selected ? '#fff' : colors.gray900,
      }}
    >{time}</button>
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
    background: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    background: 'none', border: 'none', color: colors.gray500,
    cursor: 'pointer', padding: 4, zIndex: 10,
  },
  progressBar: {
    display: 'flex', gap: 4, padding: '16px 16px 0',
  },
  body: {
    padding: '24px 28px 12px',
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
  choiceCard: {
    border: '1.5px solid',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'all 0.12s ease',
  },
  dayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  dayChip: {
    border: '2px solid',
    borderRadius: 10,
    padding: '10px 4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    transition: 'all 0.12s ease',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 600,
    color: colors.gray700, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8,
  },
  timeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  timeChip: {
    border: '1.5px solid',
    borderRadius: 8,
    padding: '9px 6px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
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
    minHeight: 110,
    boxSizing: 'border-box',
  },
  confirmCard: {
    background: colors.gray100,
    borderRadius: 10,
    padding: '4px 16px',
  },
  confirmRow: {
    display: 'flex',
    gap: 16,
    padding: '12px 0',
    borderBottom: `1px solid ${colors.gray200}`,
  },
  confirmLabel: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    minWidth: 56,
  },
  confirmValue: {
    fontSize: 14,
    color: colors.gray900,
    fontWeight: 500,
    flex: 1,
  },
  statusNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    fontSize: 13,
    lineHeight: 1.45,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px 18px',
    borderTop: `1px solid ${colors.gray100}`,
  },
  navBtnGhost: {
    padding: '10px 14px',
    background: 'none',
    color: colors.gray700,
    border: 'none',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navBtnPrimary: {
    padding: '11px 22px',
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

export default AppointmentModal;
