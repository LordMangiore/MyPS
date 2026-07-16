import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './auth-context';
import { money } from './order-model';
import {
  ClipboardList,
  FileText,
  MessageSquare,
  Mail,
  Clock,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  Inbox,
  X,
  DollarSign,
  MapPin,
} from 'lucide-react';

/**
 * The account manager's console: the other side of the glass.
 *
 * Everything else in this app is member-facing, so a quote a member sends sits
 * at "Quote requested" with no numbers on it and nobody able to add any. This
 * screen is where that work arrives and gets priced, which closes the loop:
 * requested, priced, ready to approve, approved, order.
 *
 * Backed entirely by /api/am-queue (see netlify/functions/am-queue.mjs), which
 * is the cross-member index of outstanding work. The member's own blob stays
 * the source of truth for the document itself; pricing reaches into it through
 * the queue's `price` action rather than from here.
 *
 * Mounted only for `userType === 'accountmanager'` (see main.jsx). No auth check
 * here, because nothing in this codebase has one.
 */

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  lightBlue: '#6CACE4',
  green: '#07542E',
  gray100: '#f5f5f5',
  gray200: '#e5e5e5',
  gray300: '#d4d4d4',
  gray400: '#a3a3a3',
  gray500: '#737373',
  gray700: '#404040',
  gray900: '#171717',
  amber: '#d97706',
  amberBg: '#fef3c7',
  blueBg: '#e8effb',
  greenBg: '#dcfce7',
  redBg: '#fee2e2',
};

const styles = {
  wrapper: {
    background: '#fafafa',
    minHeight: '100vh',
    fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '32px 24px',
  },
  pageHeader: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.gray900,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  pageDesc: {
    fontSize: 14,
    color: colors.gray500,
    lineHeight: 1.6,
    maxWidth: 700,
  },
  showroomRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  showroomStatic: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: colors.gray700,
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 6,
    padding: '8px 12px',
  },
  showroomBtn: (isActive) => ({
    padding: '8px 14px',
    background: isActive ? colors.darkBlue : '#fff',
    color: isActive ? '#fff' : colors.gray700,
    border: `1px solid ${isActive ? colors.darkBlue : colors.gray300}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  tabRow: {
    display: 'flex',
    gap: 4,
    borderBottom: `1px solid ${colors.gray200}`,
    marginBottom: 20,
  },
  tabBtn: (isActive) => ({
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: isActive ? colors.darkBlue : colors.gray500,
    borderBottom: isActive ? `2px solid ${colors.darkBlue}` : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: isActive ? colors.darkBlue : 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: -1,
  }),
  card: (isHandled) => ({
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    opacity: isHandled ? 0.75 : 1,
  }),
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    padding: '16px 20px',
    borderBottom: `1px solid ${colors.gray100}`,
  },
  memberName: {
    fontSize: 17,
    fontWeight: 600,
    color: colors.gray900,
    marginBottom: 4,
  },
  memberEmail: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: colors.gray500,
  },
  typeBadge: (type) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    background: type === 'quote' ? colors.blueBg : colors.amberBg,
    color: type === 'quote' ? colors.darkBlue : colors.amber,
  }),
  handledBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    background: colors.greenBg,
    color: colors.green,
  },
  cardBody: {
    padding: '16px 20px',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.darkBlue,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.gray700,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 24,
    marginTop: 14,
  },
  timeText: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: colors.gray500,
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 20px',
    borderTop: `1px solid ${colors.gray100}`,
    background: '#fcfcfc',
  },
  btnPrimary: {
    padding: '8px 16px',
    background: colors.darkBlue,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnGreen: {
    padding: '8px 16px',
    background: colors.green,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnOutline: {
    padding: '8px 16px',
    background: '#fff',
    color: colors.gray700,
    border: `1px solid ${colors.gray300}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  priceForm: {
    padding: '18px 20px',
    borderTop: `1px solid ${colors.gray100}`,
    background: colors.gray100,
  },
  priceGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
  },
  priceField: {
    flex: '1 1 140px',
    minWidth: 130,
  },
  inputLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: colors.gray700,
    marginBottom: 6,
  },
  moneyInputWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: `1px solid ${colors.gray300}`,
    borderRadius: 6,
    padding: '0 10px',
  },
  moneyPrefix: {
    fontSize: 14,
    color: colors.gray500,
    marginRight: 2,
  },
  moneyInput: {
    flex: 1,
    minWidth: 0,
    padding: '9px 4px',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontFamily: 'inherit',
    color: colors.gray900,
    background: 'transparent',
  },
  noteInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    border: `1px solid ${colors.gray300}`,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    color: colors.gray900,
    outline: 'none',
    resize: 'vertical',
  },
  totalPanel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
    padding: '12px 14px',
    background: '#fff',
    border: `1px solid ${colors.gray200}`,
    borderRadius: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.gray500,
    textTransform: 'uppercase',
  },
  totalHint: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.gray900,
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  formError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: '10px 12px',
    background: colors.redBg,
    border: `1px solid ${colors.red}`,
    borderRadius: 6,
    fontSize: 13,
    color: colors.red,
    lineHeight: 1.5,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    margin: '0 0 16px',
    padding: '12px 14px',
    background: colors.greenBg,
    border: `1px solid ${colors.green}`,
    borderRadius: 6,
    fontSize: 13,
    color: colors.green,
    lineHeight: 1.5,
  },
  panelState: {
    padding: 64,
    textAlign: 'center',
    background: colors.gray100,
    borderRadius: 8,
    color: colors.gray500,
    fontSize: 14,
    // textAlign centres the text but cannot centre the icon: Tailwind's preflight
    // sets svg{display:block}, so it is a block element and sits hard against the
    // left edge. Flex-centre the column so the icon lines up with its own text.
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

/** "3 minutes ago" style, with the absolute time alongside it for the record. */
const relativeTime = (ts) => {
  if (!ts) return 'Unknown time';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
};

const absoluteTime = (ts) =>
  ts ? new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

/**
 * Parse a money field the way the backend does: blank is not zero, it is
 * missing. Returns null for anything that is not a number >= 0, which is what
 * keeps Submit disabled rather than letting the API reject it.
 */
const parseMoney = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

/** Blank reads as 0 for the running total only, so the number moves as they type. */
const forTotal = (raw) => parseMoney(raw) ?? 0;

const round2 = (n) => Math.round(n * 100) / 100;

const EMPTY_FORM = { material: '', salesTax: '', service: '', note: '' };

/**
 * The pricing form for one quote.
 *
 * The live total is the number the member will see on their Estimates tab, so
 * it is shown as it is typed rather than only after a submit. `onSubmit` throws
 * on failure, and the throw is caught here and rendered: a failed write must
 * never leave a success on screen.
 */
const PriceForm = ({ item, onSubmit, onCancel }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const material = parseMoney(form.material);
  const salesTax = parseMoney(form.salesTax);
  const service = parseMoney(form.service);
  const complete = material !== null && salesTax !== null && service !== null;

  // Mirrors the backend's sum exactly (material + salesTax + service, rounded to
  // cents). If these two ever disagree the member is shown one number and
  // charged another, so the arithmetic is deliberately the same shape.
  const liveTotal = round2(forTotal(form.material) + forTotal(form.salesTax) + forTotal(form.service));

  const submit = async (e) => {
    e.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ material, salesTax, service, note: form.note.trim() });
      // Deliberately no local success state: the parent re-reads the queue and
      // reports what the server actually wrote. Nothing here claims a write
      // landed on this component's say-so.
    } catch (err) {
      setError(err.message || 'The quote could not be priced. Nothing was saved.');
      setSubmitting(false);
    }
  };

  return (
    <form style={styles.priceForm} onSubmit={submit}>
      <div style={styles.priceGrid}>
        {[
          { field: 'material', label: 'Material' },
          { field: 'salesTax', label: 'Sales tax' },
          { field: 'service', label: 'Service' },
        ].map(({ field, label }) => (
          <div key={field} style={styles.priceField}>
            <label style={styles.inputLabel} htmlFor={`${item.id}-${field}`}>{label}</label>
            <div style={styles.moneyInputWrap}>
              <span style={styles.moneyPrefix}>$</span>
              <input
                id={`${item.id}-${field}`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form[field]}
                onChange={set(field)}
                disabled={submitting}
                style={styles.moneyInput}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={styles.inputLabel} htmlFor={`${item.id}-note`}>Note to the member (optional)</label>
        <textarea
          id={`${item.id}-note`}
          rows={2}
          placeholder="Lead time, substitutions, anything they should know before approving."
          value={form.note}
          onChange={set('note')}
          disabled={submitting}
          style={styles.noteInput}
        />
      </div>

      <div style={styles.totalPanel}>
        <div>
          <div style={styles.totalLabel}>Invoice total</div>
          <div style={styles.totalHint}>
            {complete
              ? 'This is the number the member sees on their quote.'
              : 'Enter material, sales tax and service to send this quote.'}
          </div>
        </div>
        <div style={styles.totalValue}>{money(liveTotal)}</div>
      </div>

      {error && (
        <div style={styles.formError}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Not saved.</strong> {error}
          </div>
        </div>
      )}

      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} disabled={submitting} style={styles.btnOutline}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!complete || submitting}
          style={{ ...styles.btnGreen, ...(!complete || submitting ? styles.btnDisabled : {}) }}
        >
          {submitting
            ? <><RotateCw size={14} /> Sending…</>
            : <><DollarSign size={14} /> Send priced quote</>}
        </button>
      </div>
    </form>
  );
};

const ProSourceAmConsole = () => {
  const { showrooms, userName } = useAuth();

  // The AM's own showroom(s), never a hardcoded id. `showrooms` is always at
  // least [showroom] (see deriveShowrooms in auth-context), so the first entry
  // is the primary and the right default.
  const [showroomId, setShowroomId] = useState(null);
  const activeShowroomId = showroomId || showrooms?.[0]?.id || null;
  const activeShowroom = useMemo(
    () => (showrooms || []).find((s) => s.id === activeShowroomId) || null,
    [showrooms, activeShowroomId]
  );

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('open');
  const [pricingId, setPricingId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState(null);

  /**
   * Read the whole queue, open and handled together, and split it below. One
   * request rather than one per tab: the queue is a showroom's work, not a
   * dataset, and switching tabs should not be able to fail.
   */
  const load = useCallback(async () => {
    if (!activeShowroomId) return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`/api/am-queue?showroomId=${encodeURIComponent(activeShowroomId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not load the queue (${res.status})`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load the queue');
      setStatus('error');
    }
  }, [activeShowroomId]);

  useEffect(() => { load(); }, [load]);

  // A showroom switch is a different queue: drop anything that belonged to the
  // one we just left rather than leaving a stale banner or a half-typed form
  // hanging over someone else's work.
  useEffect(() => {
    setPricingId(null);
    setDismissingId(null);
    setActionError('');
    setNotice(null);
    setTab('open');
  }, [activeShowroomId]);

  const openItems = useMemo(() => items.filter((i) => i?.status === 'open'), [items]);
  const handledItems = useMemo(() => items.filter((i) => i?.status === 'handled'), [items]);
  const visible = tab === 'open' ? openItems : handledItems;

  /**
   * Price one quote. Throws on any failure so the form can render it: the
   * caller must not be able to mistake a rejected write for a saved one.
   */
  const priceItem = async (item, { material, salesTax, service, note }) => {
    setActionError('');
    const res = await fetch('/api/am-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'price',
        showroomId: activeShowroomId,
        itemId: item.id,
        memberUserId: item.memberUserId,
        docId: item.docId,
        material,
        salesTax,
        service,
        ...(note ? { note } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    // `ok` is checked as well as the HTTP status: a 200 that did not confirm
    // the write is not a success either.
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Pricing failed (${res.status})`);
    }
    setPricingId(null);
    // Report the total the SERVER wrote, not the one this page added up. If the
    // two ever differ, the member's copy is the true one and this says so.
    setNotice({
      tone: 'success',
      text: `${item.memberName}'s quote is priced at ${money(data.doc?.invoiceTotal)}. They can approve it now.`,
    });
    await load();
  };

  const dismissItem = async (item) => {
    setDismissingId(item.id);
    setActionError('');
    setNotice(null);
    try {
      const res = await fetch('/api/am-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', showroomId: activeShowroomId, itemId: item.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Could not dismiss this item (${res.status})`);
      setNotice({ tone: 'success', text: `Dismissed. It is still in Handled if you need it back.` });
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not dismiss this item. Nothing changed.');
    } finally {
      setDismissingId(null);
    }
  };

  // An account whose session carries no showroom cannot have a queue: say that
  // plainly rather than firing a request with `showroomId=undefined`.
  if (!activeShowroomId) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.container}>
          <div style={styles.panelState}>
            <AlertCircle size={28} color={colors.red} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>No showroom on this account</div>
            <div>A work queue belongs to a showroom, and this account is not assigned to one yet.</div>
          </div>
        </div>
      </div>
    );
  }

  const renderItem = (item) => {
    const isQuote = item.type === 'quote';
    const isHandled = item.status === 'handled';
    // Only a quote names a document to price. A consultation is a guest lead
    // with a null docId and possibly no account at all, and the backend refuses
    // to price one, so the console must not offer the action in the first place.
    const canPrice = isQuote && !isHandled && !!item.docId && !!item.memberUserId;
    const isPricing = pricingId === item.id;

    return (
      <div key={item.id} style={styles.card(isHandled)}>
        <div style={styles.cardHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.memberName}>{item.memberName || 'Member'}</div>
            {item.memberEmail && (
              <div style={styles.memberEmail}>
                <Mail size={13} /> {item.memberEmail}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={styles.typeBadge(item.type)}>
              {isQuote ? <FileText size={12} /> : <MessageSquare size={12} />}
              {isQuote ? 'Quote to price' : 'Consultation lead'}
            </span>
            {isHandled && (
              <span style={styles.handledBadge}>
                <CheckCircle2 size={12} /> Handled
              </span>
            )}
          </div>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.fieldLabel}>Summary</div>
          <div style={styles.fieldValue}>{item.summary}</div>

          <div style={styles.metaRow}>
            <div>
              <div style={styles.fieldLabel}>Submitted</div>
              <div style={styles.timeText} title={absoluteTime(item.submittedAt)}>
                <Clock size={13} /> {relativeTime(item.submittedAt)}
              </div>
            </div>
            {item.itemCount != null && (
              <div>
                <div style={styles.fieldLabel}>Items</div>
                <div style={styles.fieldValue}>{item.itemCount}</div>
              </div>
            )}
            {item.docId && (
              <div>
                <div style={styles.fieldLabel}>Document</div>
                <div style={styles.fieldValue}>{item.docId}</div>
              </div>
            )}
            {isHandled && item.handledAt && (
              <div>
                <div style={styles.fieldLabel}>Handled</div>
                <div style={styles.timeText} title={absoluteTime(item.handledAt)}>
                  <CheckCircle2 size={13} /> {relativeTime(item.handledAt)}
                </div>
              </div>
            )}
          </div>

          {!isQuote && !isHandled && (
            <div style={{ ...styles.timeText, marginTop: 14, color: colors.amber }}>
              <MessageSquare size={13} />
              There is no document to price on a consultation. Follow up with them, then dismiss it.
            </div>
          )}
        </div>

        {isPricing && (
          <PriceForm
            item={item}
            onSubmit={(values) => priceItem(item, values)}
            onCancel={() => setPricingId(null)}
          />
        )}

        {!isHandled && !isPricing && (
          <div style={styles.cardActions}>
            <button
              onClick={() => dismissItem(item)}
              disabled={dismissingId === item.id}
              style={{ ...styles.btnOutline, ...(dismissingId === item.id ? styles.btnDisabled : {}) }}
            >
              {dismissingId === item.id ? 'Dismissing…' : 'Dismiss'}
            </button>
            {canPrice && (
              <button
                onClick={() => { setPricingId(item.id); setNotice(null); setActionError(''); }}
                style={styles.btnPrimary}
              >
                <DollarSign size={14} /> Price this quote
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>
            <ClipboardList size={26} color={colors.darkBlue} />
            Work queue
          </h1>
          <p style={styles.pageDesc}>
            {userName ? `${userName}, this is` : 'This is'} everything your showroom's members are waiting on.
            Price a quote here and it lands on their Estimates tab straight away, ready for them to approve.
          </p>
        </div>

        {/* One showroom is not a choice worth making them make, so it reads as a
            label. More than one and it becomes a switcher. */}
        <div style={styles.showroomRow}>
          {showrooms.length > 1 ? (
            showrooms.map((s) => (
              <button
                key={s.id}
                onClick={() => setShowroomId(s.id)}
                style={styles.showroomBtn(s.id === activeShowroomId)}
              >
                {s.name || s.id}
              </button>
            ))
          ) : (
            <span style={styles.showroomStatic}>
              <MapPin size={14} color={colors.red} />
              {activeShowroom?.name || activeShowroomId}
            </span>
          )}
          <button onClick={load} disabled={status === 'loading'} style={{ ...styles.btnOutline, ...(status === 'loading' ? styles.btnDisabled : {}) }}>
            {status === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {notice && (
          <div style={styles.successBanner}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>{notice.text}</div>
            <button
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              style={{ background: 'none', border: 'none', color: colors.green, cursor: 'pointer', padding: 0, lineHeight: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {actionError && (
          <div style={styles.formError}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>{actionError}</div>
          </div>
        )}

        {/* Handled work does not vanish: it moves to its own tab, with the time
            it was dealt with on it. The queue is an index of what is
            outstanding, and it is also the only record the AM has of what they
            already did. */}
        <div style={styles.tabRow}>
          {[
            { key: 'open', label: `Open (${openItems.length})` },
            { key: 'handled', label: `Handled (${handledItems.length})` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={styles.tabBtn(tab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {status === 'loading' && items.length === 0 && (
          <div style={styles.panelState}>
            <RotateCw size={28} color={colors.gray400} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>Loading the queue…</div>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.panelState}>
            <AlertCircle size={28} color={colors.red} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>We couldn't load the queue</div>
            <div style={{ marginBottom: 16 }}>{error}</div>
            <button onClick={load} style={styles.btnOutline}>Try again</button>
          </div>
        )}

        {/* An empty queue is the good state, not a failure. Nothing is waiting
            because nothing is waiting. */}
        {status === 'ready' && visible.length === 0 && (
          <div style={styles.panelState}>
            <Inbox size={28} color={colors.gray400} style={{ marginBottom: 12 }} />
            <div style={styles.stateTitle}>
              {tab === 'open' ? 'Nothing waiting' : 'Nothing handled yet'}
            </div>
            <div>
              {tab === 'open'
                ? 'Every quote and consultation for this showroom has been dealt with. New work lands here as members send it.'
                : 'Quotes you price and items you dismiss are kept here so you can see what you have already done.'}
            </div>
          </div>
        )}

        {status !== 'error' && visible.length > 0 && visible.map(renderItem)}
      </div>
    </div>
  );
};

export default ProSourceAmConsole;
