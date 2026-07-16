import React, { useEffect, useState } from 'react';
import { X, ExternalLink, CheckCircle, ShieldCheck } from 'lucide-react';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  green: '#07542E',
  gray200: '#e9ecef',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

/**
 * Demo modal that stands in for the real RFMS-hosted payment / approval link.
 * In production these are external pages; here we just simulate the round trip
 * with a 1.2s pretend-network delay then call onSuccess().
 *
 * Props:
 *   isOpen, onClose
 *   variant: 'pay' | 'approve'
 *   amount  : number (only used for 'pay')
 *   orderId : string
 *   onSuccess: () => void   // called after the pretend submit completes
 */
export default function RfmsActionModal({ isOpen, onClose, variant, amount, orderId, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setDone(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPay = variant === 'pay';
  const title = isPay ? 'RFMS Secure Payment' : 'RFMS Order Approval';
  const headline = done
    ? (isPay ? 'Payment received.' : 'Order approved.')
    : (isPay ? 'Complete your down payment' : 'Approve this order to begin processing');
  const ctaLabel = submitting
    ? (isPay ? 'Processing…' : 'Approving…')
    : (isPay ? `Pay $${(amount || 0).toFixed(2)}` : 'Approve order');

  const submit = () => {
    setSubmitting(true);
    // Simulated round-trip to RFMS's hosted page.
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      onSuccess?.();
      // Auto-close after the success state so the customer sees the flip.
      setTimeout(onClose, 1100);
    }, 1200);
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
            <ShieldCheck size={16} color={colors.darkBlue} /> {title}
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
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 6 }}>{headline}</div>
              <div style={{ fontSize: 13, color: colors.gray500 }}>
                Order {orderId} updated.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 6 }}>{headline}</div>
              <div style={{ fontSize: 13, color: colors.gray500, lineHeight: 1.55, marginBottom: 16 }}>
                You'd normally be redirected to a secure RFMS-hosted link. For the demo, hit the button below to confirm.
              </div>

              <div style={{
                background: '#f8f9fa', borderRadius: 8, padding: '12px 14px',
                fontSize: 13, color: colors.gray700, marginBottom: 18,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.gray500 }}>Order</span>
                  <span style={{ fontWeight: 600 }}>{orderId}</span>
                </div>
                {isPay && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.gray500 }}>Amount</span>
                    <span style={{ fontWeight: 600 }}>${(amount || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px 18px',
                  background: isPay ? colors.darkBlue : colors.green,
                  color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 15, fontWeight: 700,
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                {ctaLabel} {!submitting && <ExternalLink size={15} />}
              </button>
              <div style={{ fontSize: 11, color: colors.gray500, marginTop: 10, textAlign: 'center' }}>
                Demo only — no charge will be made.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
