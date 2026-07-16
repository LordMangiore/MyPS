import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  customerStatusLabel,
  statusTone,
  statusIcon,
} from './order-status';
import {
  useOrders,
  findOrder,
  availableActions,
  headlineLabel,
  headlineAmount,
  isEstimate,
  docNoun,
  money,
} from './order-model';
import RfmsActionModal from './components/RfmsActionModal';
import {
  ArrowLeft,
  MapPin,
  Package,
  AlertCircle,
  RotateCw,
  SearchX,
} from 'lucide-react';

const ProSourceOrderDetail = () => {
  const { orderId } = useParams();
  // Same hook, same blob, same records as /orders and the project page. This
  // page used to carry its own hardcoded copy of every order (with invented
  // line items), and nothing linked the two datasets together.
  const { orders, status: loadStatus, error: loadError, reload, runAction } = useOrders();

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
    orange: '#ea580c',
    amber: '#d97706',
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
    headerCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    orderNumber: {
      fontSize: 24,
      fontWeight: 700,
      color: colors.gray900,
      marginBottom: 4,
    },
    // Colours come from order-status.js, shared with the list page. It's the
    // only place `items` / `pickup` / line-item states are styled.
    statusBadge: (status) => {
      const tone = statusTone(status);
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      };
    },
    balanceDue: {
      textAlign: 'right',
    },
    balanceDueLabel: {
      fontSize: 12,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    balanceDueValue: (amount) => ({
      fontSize: 24,
      fontWeight: 700,
      color: amount > 0 ? colors.red : colors.green,
    }),
    detailsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 20,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: 600,
      color: colors.darkBlue,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 14,
      color: colors.gray700,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 16,
    },
    lineItemCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 10,
      padding: 20,
      marginBottom: 12,
    },
    lineItemHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    lineItemCategory: {
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: colors.darkBlue,
      marginBottom: 4,
    },
    lineItemProduct: {
      fontSize: 15,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 2,
    },
    lineItemColor: {
      fontSize: 13,
      color: colors.gray500,
    },
    lineItemDetails: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: 16,
      padding: '12px 0',
      borderTop: `1px solid ${colors.gray100}`,
    },
    lineItemLabel: {
      fontSize: 11,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    lineItemValue: {
      fontSize: 14,
      fontWeight: 500,
      color: colors.gray700,
    },
    lineItemSubtotal: {
      fontSize: 16,
      fontWeight: 700,
      color: colors.gray900,
    },
    summaryCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      padding: 24,
      marginTop: 24,
    },
    summaryRow: (isBold) => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      fontSize: isBold ? 16 : 14,
      fontWeight: isBold ? 700 : 400,
      color: isBold ? colors.gray900 : colors.gray700,
    }),
    summaryDivider: {
      borderTop: `1px solid ${colors.gray200}`,
      margin: '8px 0',
    },
    referralBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      background: '#dcfce7',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      color: colors.green,
      marginTop: 12,
    },
    btnOutline: {
      padding: '10px 20px',
      background: '#fff',
      color: colors.gray700,
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    },
  };

  const order = findOrder(orders, orderId);

  const [rfmsModal, setRfmsModal] = useState({ open: false, variant: null });
  const openRfms = (variant) => setRfmsModal({ open: true, variant });
  const closeRfms = () => setRfmsModal({ open: false, variant: null });
  // Real write, real failure. `runAction` moves the status, the totals AND the
  // line items together, so the page can't end up saying "Order Confirmed"
  // next to an untouched red balance the way it used to.
  const submitRfms = () => runAction(order.id, rfmsModal.variant);

  const backLink = (
    <Link to="/orders" style={styles.backLink}>
      <ArrowLeft size={18} /> Back to Orders
    </Link>
  );

  const messageState = (icon, title, body, action = null) => (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {backLink}
        <div style={{
          padding: 64, textAlign: 'center', background: '#fff',
          border: `1px solid ${colors.gray200}`, borderRadius: 12,
        }}>
          <div style={{ marginBottom: 14 }}>{icon}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: colors.gray900, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, color: colors.gray500, marginBottom: action ? 20 : 0 }}>{body}</div>
          {action}
        </div>
      </div>
    </div>
  );

  if (loadStatus === 'loading') {
    return messageState(
      <RotateCw size={32} color={colors.gray400} />,
      'Loading…',
      `Fetching ${orderId}.`
    );
  }

  if (loadStatus === 'error') {
    return messageState(
      <AlertCircle size={32} color={colors.red} />,
      "We couldn't load this order",
      loadError,
      <button onClick={reload} style={styles.btnOutline}>Try again</button>
    );
  }

  // An unknown id used to silently fall back to the Beans demo order. The page
  // would happily show you somebody else's order under the id you asked for.
  if (!order) {
    return messageState(
      <SearchX size={32} color={colors.gray400} />,
      'Order not found',
      `We don't have an order or estimate with the number ${orderId} on your account.`,
      <Link to="/orders" style={{ ...styles.btnOutline, textDecoration: 'none' }}>
        View all orders
      </Link>
    );
  }

  const actions = availableActions(order);
  const StatusIcon = statusIcon(order.status);
  const noun = docNoun(order);

  const actionButton = (action) => {
    const label =
      action === 'approve' ? 'Approve quote'
        : action === 'decline' ? 'Decline'
          : `Pay ${money(order.balanceDue)}`;
    const background =
      action === 'approve' ? colors.green
        : action === 'decline' ? '#fff'
          : colors.darkBlue;
    return (
      <button
        key={action}
        onClick={() => openRfms(action)}
        style={{
          padding: '10px 18px',
          background,
          color: action === 'decline' ? colors.gray700 : '#fff',
          border: action === 'decline' ? `1px solid ${colors.gray300}` : 'none',
          borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      {backLink}

      {/* Order Header */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <div style={styles.orderNumber}>{noun} {order.id}</div>
            <div style={styles.statusBadge(order.status)}>
              {StatusIcon && <StatusIcon size={14} />} {customerStatusLabel(order.status)}
            </div>
          </div>
          <div style={styles.balanceDue}>
            {/* A quote has a total, not a balance due. Nobody owes anything
                until it's approved. */}
            <div style={styles.balanceDueLabel}>{headlineLabel(order)}</div>
            <div style={
              isEstimate(order)
                ? { ...styles.balanceDueValue(0), color: colors.gray900 }
                : styles.balanceDueValue(order.balanceDue)
            }>
              {money(headlineAmount(order))}
            </div>
            {actions.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {actions.map(actionButton)}
              </div>
            )}
          </div>
        </div>

        <div style={styles.detailsGrid}>
          <div>
            <div style={styles.detailLabel}>Job Name</div>
            <div style={styles.detailValue}>{order.jobName}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Client</div>
            <div style={styles.detailValue}>{order.client || '--'}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>{isEstimate(order) ? 'Quote Date' : 'Order Date'}</div>
            <div style={styles.detailValue}>{order.orderDate || '--'}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Expected Delivery</div>
            <div style={styles.detailValue}>{order.expectedDelivery || '--'}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Sold To</div>
            <div style={styles.detailValue}>{order.soldTo}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Showroom</div>
            <div style={{ ...styles.detailValue, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color={colors.red} />
              {order.showroom}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      {order.lineItems.length > 0 && (
        <div>
          <h2 style={styles.sectionTitle}>
            Line Items ({order.lineItems.length})
          </h2>
          {order.lineItems.map((item, i) => {
            const ItemIcon = statusIcon(item.status);
            return (
            <div key={i} style={styles.lineItemCard}>
              <div style={styles.lineItemHeader}>
                <div>
                  <div style={styles.lineItemCategory}>{item.category}</div>
                  <div style={styles.lineItemProduct}>{item.product}</div>
                  <div style={styles.lineItemColor}>{item.color}</div>
                </div>
                <div style={styles.statusBadge(item.status)}>
                  {ItemIcon && <ItemIcon size={14} />} {item.statusText}
                </div>
              </div>
              <div style={styles.lineItemDetails}>
                <div>
                  <div style={styles.lineItemLabel}>Brand</div>
                  <div style={styles.lineItemValue}>{item.brand}</div>
                </div>
                <div>
                  <div style={styles.lineItemLabel}>Quantity</div>
                  <div style={styles.lineItemValue}>{item.quantity}</div>
                </div>
                <div>
                  <div style={styles.lineItemLabel}>Unit Price</div>
                  <div style={styles.lineItemValue}>{money(item.unitPrice)}</div>
                </div>
                <div>
                  <div style={styles.lineItemLabel}>Subtotal</div>
                  <div style={styles.lineItemSubtotal}>{money(item.subtotal)}</div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {order.lineItems.length === 0 && (
        <div style={{
          padding: 48,
          textAlign: 'center',
          background: colors.gray100,
          borderRadius: 12,
          color: colors.gray400,
        }}>
          <Package size={40} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No line items</div>
          <div style={{ fontSize: 14 }}>This order does not have detailed line item data.</div>
        </div>
      )}

      {/* Order Summary */}
      <div style={styles.summaryCard}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: 12 }}>{noun} Summary</h2>
        <div style={styles.summaryRow(false)}>
          <span>Material</span>
          <span>{money(order.material)}</span>
        </div>
        <div style={styles.summaryRow(false)}>
          <span>Service</span>
          <span>{money(order.service)}</span>
        </div>
        <div style={styles.summaryRow(false)}>
          <span>Sales Tax</span>
          <span>{money(order.salesTax)}</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryRow(true)}>
          <span>{isEstimate(order) ? 'Quote Total' : 'Invoice Total'}</span>
          <span>{money(order.invoiceTotal)}</span>
        </div>
        {/* Paid / owed is an order's story. A quote hasn't been accepted, so
            "Balance Due: $1,253.20" on it would be claiming a debt that
            doesn't exist. */}
        {!isEstimate(order) && (
          <>
            <div style={styles.summaryRow(false)}>
              <span>Total Paid</span>
              <span style={{ color: colors.green }}>{money(order.totalPaid)}</span>
            </div>
            <div style={styles.summaryDivider} />
            <div style={styles.summaryRow(true)}>
              <span>Balance Due</span>
              <span style={{ color: order.balanceDue > 0 ? colors.red : colors.green }}>
                {money(order.balanceDue)}
              </span>
            </div>
          </>
        )}

        {order.referralBonus && (
          <div style={styles.referralBadge}>
            <CheckCircle size={16} />
            Referral Bonus Earned: +{money(order.referralBonus)}
          </div>
        )}
      </div>

    </div>

    <RfmsActionModal
      isOpen={rfmsModal.open}
      onClose={closeRfms}
      variant={rfmsModal.variant}
      amount={order.balanceDue}
      orderId={order.id}
      onSubmit={submitRfms}
    />
    </div>
  );
};

export default ProSourceOrderDetail;
