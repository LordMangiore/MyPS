import React, { useEffect, useState } from 'react';
import { X, ExternalLink, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  green: '#07542E',
  gray200: '#e9ecef',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

const COPY = {
  pay: {
    title: 'RFMS Secure Payment',
    headline: 'Complete your payment',
    doneHeadline: 'Payment received.',
    busy: 'Processing…',
    accent: colors.darkBlue,
  },
  approve: {
    title: 'RFMS Order Approval',
    headline: 'Approve this quote to place the order',
    doneHeadline: 'Quote approved.',
    busy: 'Approving…',
    accent: colors.green,
  },
  decline: {
    title: 'RFMS Order Approval',
    headline: 'Decline this quote?',
    doneHeadline: 'Quote declined.',
    busy: 'Declining…',
    accent: colors.red,
  },
};

/**
 * Stands in for the real RFMS-hosted payment / approval link. In production
 * these are external pages; here the button confirms in place.
 *
 * The round trip is NOT simulated. `onSubmit` does the real write and this
 * modal reports what actually happened. It used to be a setTimeout that always
 * "succeeded", which meant a failed save still showed a green checkmark.
 *
 * Props:
 *   isOpen, onClose
 *   variant : 'pay' | 'approve' | 'decline'
 *   amount  : number (only used for 'pay')
 *   orderId : string
 *   onSubmit: () => Promise<void>   // rejects → the error is shown, not hidden
 */
export default function RfmsActionModal({ isOpen, onClose, variant, amount, orderId, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setDone(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = COPY[variant] || COPY.approve;
  const isPay = variant === 'pay';
  const ctaLabel = submitting
    ? copy.busy
    : isPay
      ? `Pay $${(amount || 0).toFixed(2)}`
      : variant === 'decline'
        ? 'Decline quote'
        : 'Approve quote';

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit?.();
      setDone(true);
      // Auto-close after the success state so the customer sees the flip.
      setTimeout(onClose, 1100);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={submitting ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12,
          width: '100%', maxWidth: 420,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', borderBottom: `1px solid ${colors.gray200}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: colors.gray700 }}>
            <ShieldCheck size={16} color={colors.darkBlue} /> {copy.title}
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ background: 'none', border: 'none', cursor: submitting ? 'default' : 'pointer', color: colors.gray500, padding: 0 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '22px 22px 18px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#e8f5e9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <CheckCircle size={30} color={colors.green} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 6 }}>{copy.doneHeadline}</div>
              <div style={{ fontSize: 13, color: colors.gray500 }}>
                {orderId} updated.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 6 }}>{copy.headline}</div>
              <div style={{ fontSize: 13, color: colors.gray500, lineHeight: 1.55, marginBottom: 16 }}>
                {variant === 'decline'
                  ? "We'll let your account manager know this quote isn't going ahead. Nothing will be ordered and you won't be charged."
                  : "You'd normally be redirected to a secure RFMS-hosted link. For the demo, hit the button below to confirm."}
              </div>

              <div style={{
                background: '#f8f9fa', borderRadius: 8, padding: '12px 14px',
                fontSize: 13, color: colors.gray700, marginBottom: 18,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.gray500 }}>{variant === 'pay' ? 'Order' : 'Quote'}</span>
                  <span style={{ fontWeight: 600 }}>{orderId}</span>
                </div>
                {isPay && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.gray500 }}>Amount</span>
                    <span style={{ fontWeight: 600 }}>${(amount || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: '#fee2e2', borderRadius: 8, padding: '10px 12px',
                  fontSize: 13, color: colors.red, marginBottom: 14, lineHeight: 1.5,
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px 18px',
                  background: copy.accent,
                  color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 15, fontWeight: 700,
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                {error && !submitting ? 'Try again' : ctaLabel}
                {!submitting && !error && variant !== 'decline' && <ExternalLink size={15} />}
              </button>
              <div style={{ fontSize: 11, color: colors.gray500, marginTop: 10, textAlign: 'center' }}>
                Demo only. No charge will be made.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
