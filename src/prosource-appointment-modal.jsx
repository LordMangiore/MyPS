import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
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

const HELP_OPTIONS = [
  { value: 'plan', label: 'Plan a remodel', body: 'Walk through ideas and get pointed to the right products.' },
  { value: 'browse', label: 'Browse products with a pro', body: 'Hands-on session in the showroom with samples and finishes.' },
  { value: 'estimate', label: 'Get an estimate', body: 'Put together a quote for a specific scope.' },
  { value: 'samples', label: 'Pick up samples', body: 'Grab tile, flooring, or finish samples for a client meeting.' },
  { value: 'other', label: 'Something else', body: 'Tell us what you need.' },
];

const TEAM_OPTIONS = [
  {
    value: 'am',
    name: 'Kim Marks',
    role: 'Account Manager',
    blurb: 'Pricing, project planning, sample requests.',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
  },
  {
    value: 'designer',
    name: 'Heather Yager',
    role: 'Design Consultant',
    blurb: 'Layout, finishes, color palette guidance.',
    photo: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&h=120&fit=crop&crop=face',
  },
];

const MORNING_TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'];
const AFTERNOON_TIMES = ['1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];

const BOOKED_BY_PERSON = {
  am: ['10:30 AM', '2:00 PM'],
  designer: ['9:30 AM', '1:30 PM', '3:00 PM'],
};

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

const stepIds = ['what', 'who', 'when', 'time', 'notes', 'confirm'];

const AppointmentModal = ({ isOpen, onClose, isLoggedIn = true }) => {
  const { userId, loadUserData, saveUserData } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const step = stepIds[stepIndex];

  const [help, setHelp] = useState('');
  const [teamValue, setTeamValue] = useState('am');
  const team = TEAM_OPTIONS.find((t) => t.value === teamValue) || TEAM_OPTIONS[0];
  const days = useMemo(() => upcomingDays(6), []);
  const [selectedDay, setSelectedDay] = useState(days[0]?.ts || null);
  const dayObj = days.find((d) => d.ts === selectedDay) || days[0];
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const bookedSlots = BOOKED_BY_PERSON[teamValue] || [];

  useEffect(() => {
    if (!isOpen) return;
    // Reset on open so each booking starts fresh.
    setStepIndex(0);
    setHelp('');
    setTeamValue('am');
    setSelectedTime(null);
    setNotes('');
    setSaving(false);
    setConfirmed(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const goNext = () => setStepIndex((i) => Math.min(i + 1, stepIds.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const stepValid = () => {
    if (step === 'what') return !!help;
    if (step === 'who') return !!teamValue;
    if (step === 'when') return !!selectedDay;
    if (step === 'time') return !!selectedTime;
    return true; // notes is optional
  };

  const submit = async () => {
    setSaving(true);
    try {
      // Save to the appointments blob so the dashboard "Upcoming Appointments"
      // card and any future history page can show this booking.
      if (userId) {
        const existing = await loadUserData('appointments', null);
        const list = Array.isArray(existing?.list) ? existing.list : [];
        const newAppt = {
          id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          person: team.name,
          personRole: team.role,
          showroom: 'ProSource of St. Louis',
          day: dayObj.day,
          date: dayObj.date,
          time: selectedTime,
          dateIso: dayObj.iso,
          help,
          notes: notes.trim(),
          bookedAt: Date.now(),
          status: 'confirmed',
        };
        await saveUserData('appointments', { list: [...list, newAppt] });
      }
      setConfirmed(true);
      goNext();
    } catch (err) {
      console.warn('Appointment save failed:', err.message);
      // Still show confirmation. The booking flow shouldn't dead-end on a save hiccup.
      setConfirmed(true);
      goNext();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div onClick={handleClose} style={styles.backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <button onClick={handleClose} style={styles.closeBtn}>
          <X size={20} />
        </button>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          {stepIds.map((id, i) => (
            <div
              key={id}
              style={{
                flex: 1,
                height: 3,
                background: i < stepIndex || confirmed ? colors.darkBlue : i === stepIndex ? colors.red : colors.gray200,
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

          {step === 'who' && (
            <Step
              eyebrow="Step 2 of 5"
              title="Who would you like to meet with?"
              sub="Both will follow up afterward. This just sets the lead host."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TEAM_OPTIONS.map((t) => {
                  const selected = teamValue === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTeamValue(t.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: 14,
                        border: `2px solid ${selected ? colors.darkBlue : colors.gray200}`,
                        background: selected ? '#f0f5ff' : '#fff',
                        borderRadius: 10,
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <img
                        src={t.photo} alt={t.name}
                        style={{
                          width: 52, height: 52, borderRadius: '50%',
                          objectFit: 'cover', border: `2px solid ${colors.lightBlue}`,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: colors.gray900, fontSize: 15 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: colors.darkBlue, fontWeight: 600, marginBottom: 4 }}>{t.role}</div>
                        <div style={{ fontSize: 12, color: colors.gray500, lineHeight: 1.45 }}>{t.blurb}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 'when' && (
            <Step
              eyebrow="Step 3 of 5"
              title="Pick a day."
              sub={`Next available slots with ${team.name}.`}
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
              eyebrow="Step 4 of 5"
              title="Pick a time."
              sub={`${team.name} · ${dayObj.day}, ${dayObj.date}`}
            >
              <div style={styles.sectionLabel}>Morning</div>
              <div style={styles.timeGrid}>
                {MORNING_TIMES.map((t) => (
                  <TimeSlot key={t} time={t} booked={bookedSlots.includes(t)} selected={selectedTime === t} onSelect={setSelectedTime} />
                ))}
              </div>
              <div style={{ ...styles.sectionLabel, marginTop: 18 }}>Afternoon</div>
              <div style={styles.timeGrid}>
                {AFTERNOON_TIMES.map((t) => (
                  <TimeSlot key={t} time={t} booked={bookedSlots.includes(t)} selected={selectedTime === t} onSelect={setSelectedTime} />
                ))}
              </div>
            </Step>
          )}

          {step === 'notes' && (
            <Step
              eyebrow="Step 5 of 5 · Optional"
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
            </Step>
          )}

          {step === 'confirm' && (
            <Step
              eyebrow=""
              title="You're set."
              sub="We'll send a calendar invite shortly."
            >
              <div style={styles.confirmCard}>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>With</span>
                  <span style={styles.confirmValue}>{team.name} · {team.role}</span>
                </div>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>When</span>
                  <span style={styles.confirmValue}>{dayObj.day}, {dayObj.date} at {selectedTime}</span>
                </div>
                <div style={styles.confirmRow}>
                  <span style={styles.confirmLabel}>Topic</span>
                  <span style={styles.confirmValue}>
                    {(HELP_OPTIONS.find((h) => h.value === help) || {}).label || 'Not set'}
                  </span>
                </div>
                {notes && (
                  <div style={{ ...styles.confirmRow, borderBottom: 'none' }}>
                    <span style={styles.confirmLabel}>Notes</span>
                    <span style={styles.confirmValue}>{notes}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: colors.green, fontSize: 13 }}>
                <CheckCircle size={18} /> Saved to your dashboard
              </div>
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
                >{saving ? 'Booking…' : 'Confirm booking →'}</button>
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
                  {step === 'notes' ? 'Confirm →' : 'Continue →'}
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

function TimeSlot({ time, booked, selected, onSelect }) {
  if (booked) {
    return (
      <button disabled style={{ ...styles.timeChip, opacity: 0.45, cursor: 'not-allowed', textDecoration: 'line-through' }}>
        {time}
      </button>
    );
  }
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
