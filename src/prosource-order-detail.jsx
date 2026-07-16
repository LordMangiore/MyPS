import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth-context';
import { customerStatusLabel } from './order-status';
import { useEffectiveOrderStatus, setStatusOverride } from './order-status-overrides';
import RfmsActionModal from './components/RfmsActionModal';
import {
  ArrowLeft,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  Package,
  Truck,
} from 'lucide-react';

const ProSourceOrderDetail = () => {
  const { orderId } = useParams();
  const { userName } = useAuth();
  const userSoldTo = (userName || 'You').toUpperCase();

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
    statusBadge: (status) => {
      let bgColor, textColor;
      switch (status) {
        case 'ready':
          bgColor = '#fef3c7';
          textColor = colors.amber;
          break;
        case 'payment':
          bgColor = '#fee2e2';
          textColor = colors.red;
          break;
        case 'processing':
          bgColor = '#dbeafe';
          textColor = colors.darkBlue;
          break;
        case 'complete':
          bgColor = '#dcfce7';
          textColor = colors.green;
          break;
        case 'on-order':
          bgColor = '#dbeafe';
          textColor = colors.darkBlue;
          break;
        case 'delivered':
          bgColor = '#dcfce7';
          textColor = colors.green;
          break;
        default:
          bgColor = colors.gray100;
          textColor = colors.gray700;
      }
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        background: bgColor,
        color: textColor,
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
    actionsRow: {
      display: 'flex',
      gap: 12,
      marginTop: 24,
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

  // Demo order data keyed by order ID
  const allOrders = {
    'EC099016': {
      id: 'EC099016',
      jobName: 'Beans Kitchen Remodel',
      orderDate: '8/20/2024',
      expectedDelivery: 'Feb 10, 2025',
      status: 'processing',
      statusText: 'Order Being Processed',
      soldTo: userSoldTo,
      client: 'Bubba Beans',
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 1758.42,
      material: 1631.28,
      salesTax: 127.14,
      service: 0,
      totalPaid: 879.21,
      balanceDue: 879.21,
      referralBonus: 87.84,
      lineItems: [
        {
          category: 'FLOORING / LVP',
          product: 'Shaw Endura Plus LVP',
          color: 'Amber Oak',
          brand: 'Shaw',
          quantity: '480 sq ft',
          unitPrice: 2.89,
          subtotal: 1387.20,
          status: 'on-order',
          statusText: 'On Order',
        },
        {
          category: 'FLOORING / ACCESSORIES',
          product: 'Shaw Endura Underlayment',
          color: 'Standard',
          brand: 'Shaw',
          quantity: '5 rolls',
          unitPrice: 34.99,
          subtotal: 174.95,
          status: 'on-order',
          statusText: 'On Order',
        },
        {
          category: 'FLOORING / ACCESSORIES',
          product: 'T-Molding Transition Strip',
          color: 'Amber Oak Match',
          brand: 'Shaw',
          quantity: '3 pieces',
          unitPrice: 23.04,
          subtotal: 69.13,
          status: 'processing',
          statusText: 'Processing',
        },
      ],
    },
    'EC096890': {
      id: 'EC096890',
      jobName: 'Chen Master Bath',
      orderDate: '4/18/2024',
      expectedDelivery: 'May 2, 2024',
      status: 'ready',
      statusText: 'Order Ready for Approval',
      soldTo: userSoldTo,
      client: 'Sarah Chen',
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 4713.89,
      material: 4364.71,
      salesTax: 349.18,
      service: 0,
      totalPaid: 0,
      balanceDue: 4713.89,
      referralBonus: null,
      lineItems: [
        {
          category: 'TILE / FLOOR TILE',
          product: 'Emser Tile Borigni',
          color: 'Beige',
          brand: 'Emser',
          quantity: '210 sq ft',
          unitPrice: 8.49,
          subtotal: 1782.90,
          status: 'pending',
          statusText: 'Awaiting Approval',
        },
        {
          category: 'TILE / WALL TILE',
          product: 'Daltile RevoTile Marble',
          color: 'Carrara White',
          brand: 'Daltile',
          quantity: '95 sq ft',
          unitPrice: 11.29,
          subtotal: 1072.55,
          status: 'pending',
          statusText: 'Awaiting Approval',
        },
        {
          category: 'COUNTERTOPS / QUARTZ',
          product: 'MSI Calacatta Laza Quartz',
          color: 'Calacatta Laza',
          brand: 'MSI',
          quantity: '42 sq ft',
          unitPrice: 24.99,
          subtotal: 1049.58,
          status: 'pending',
          statusText: 'Awaiting Approval',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Delta Trinsic Widespread Faucet',
          color: 'Champagne Bronze',
          brand: 'Delta',
          quantity: '1 unit',
          unitPrice: 459.68,
          subtotal: 459.68,
          status: 'pending',
          statusText: 'Awaiting Approval',
        },
      ],
    },
    'EC094964': {
      id: 'EC094964',
      jobName: 'Wilson Bathroom',
      orderDate: '1/3/2024',
      expectedDelivery: '--',
      status: 'payment',
      statusText: 'Order Down Payment Due',
      soldTo: userSoldTo,
      client: 'Martha Wilson',
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 3241.56,
      material: 2986.50,
      salesTax: 255.06,
      service: 0,
      totalPaid: 0,
      balanceDue: 3241.56,
      referralBonus: null,
      lineItems: [
        {
          category: 'TILE / FLOOR TILE',
          product: 'Daltile Keystones Tile',
          color: 'Desert Gray',
          brand: 'Daltile',
          quantity: '185 sq ft',
          unitPrice: 6.49,
          subtotal: 1200.65,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'TILE / WALL TILE',
          product: 'Daltile Chord Mosaic',
          color: 'Forte White',
          brand: 'Daltile',
          quantity: '62 sq ft',
          unitPrice: 12.99,
          subtotal: 805.38,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Moen Align Shower Faucet',
          color: 'Brushed Nickel',
          brand: 'Moen',
          quantity: '1 unit',
          unitPrice: 489.00,
          subtotal: 489.00,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Moen Align Towel Bar 24"',
          color: 'Brushed Nickel',
          brand: 'Moen',
          quantity: '2 units',
          unitPrice: 74.99,
          subtotal: 149.98,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'CABINETS / VANITY',
          product: 'KraftMaid Durham Vanity 48"',
          color: 'Dove White',
          brand: 'KraftMaid',
          quantity: '1 unit',
          unitPrice: 341.49,
          subtotal: 341.49,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
      ],
    },
    'EC091091': {
      id: 'EC091091',
      jobName: 'Anderson Office Renovation',
      orderDate: '5/26/2023',
      expectedDelivery: 'Jun 15, 2023',
      status: 'payment',
      statusText: 'Order Down Payment Due',
      soldTo: userSoldTo,
      client: 'James Anderson',
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 2847.33,
      material: 2636.42,
      salesTax: 210.91,
      service: 0,
      totalPaid: 0,
      balanceDue: 2847.33,
      referralBonus: null,
      lineItems: [
        {
          category: 'FLOORING / CARPET',
          product: 'Shaw Bellera Carpet',
          color: 'Heather Gray',
          brand: 'Shaw',
          quantity: '320 sq ft',
          unitPrice: 4.29,
          subtotal: 1372.80,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'FLOORING / CARPET PAD',
          product: 'Shaw Total Confidence Pad',
          color: 'Standard',
          brand: 'Shaw',
          quantity: '320 sq ft',
          unitPrice: 1.19,
          subtotal: 380.80,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'FLOORING / LVP',
          product: 'Mohawk SolidTech LVP',
          color: 'Blonde Maple',
          brand: 'Mohawk',
          quantity: '145 sq ft',
          unitPrice: 3.89,
          subtotal: 564.05,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'FLOORING / ACCESSORIES',
          product: 'Reducer Transition Strip',
          color: 'Blonde Maple Match',
          brand: 'Mohawk',
          quantity: '4 pieces',
          unitPrice: 29.69,
          subtotal: 118.77,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
        {
          category: 'FLOORING / ACCESSORIES',
          product: 'Carpet-to-LVP Transition',
          color: 'Satin Nickel',
          brand: 'M-D Building Products',
          quantity: '4 pieces',
          unitPrice: 50.00,
          subtotal: 200.00,
          status: 'pending',
          statusText: 'Awaiting Payment',
        },
      ],
    },
    'EC090657': {
      id: 'EC090657',
      jobName: 'Torres Kitchen Refresh',
      orderDate: '5/4/2023',
      expectedDelivery: 'May 22, 2023',
      status: 'complete',
      statusText: 'Order Complete',
      soldTo: userSoldTo,
      client: 'Bubba Beans',
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 5318.76,
      material: 4924.78,
      salesTax: 393.98,
      service: 0,
      totalPaid: 5318.76,
      balanceDue: 0,
      referralBonus: 87.84,
      lineItems: [
        {
          category: 'CABINETS / WALL CABINET',
          product: 'KraftMaid Lyndale Wall Cabinet 36"',
          color: 'Praline',
          brand: 'KraftMaid',
          quantity: '4 units',
          unitPrice: 339.99,
          subtotal: 1359.96,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'CABINETS / BASE CABINET',
          product: 'KraftMaid Lyndale Base Cabinet 24"',
          color: 'Praline',
          brand: 'KraftMaid',
          quantity: '3 units',
          unitPrice: 349.99,
          subtotal: 1049.97,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'COUNTERTOPS / QUARTZ',
          product: 'MSI Carrara Mist Quartz',
          color: 'Carrara Mist',
          brand: 'MSI',
          quantity: '38 sq ft',
          unitPrice: 27.49,
          subtotal: 1044.62,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Amerock Bar Pull 5"',
          color: 'Matte Black',
          brand: 'Amerock',
          quantity: '14 units',
          unitPrice: 8.99,
          subtotal: 125.86,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Amerock Knob 1.25"',
          color: 'Matte Black',
          brand: 'Amerock',
          quantity: '7 units',
          unitPrice: 5.49,
          subtotal: 38.43,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'TILE / BACKSPLASH',
          product: 'Daltile Color Wheel Mosaic',
          color: 'Arctic White',
          brand: 'Daltile',
          quantity: '48 sq ft',
          unitPrice: 11.41,
          subtotal: 547.68,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'K&B HARDWARE',
          product: 'Moen Adler Kitchen Faucet',
          color: 'Spot Resist Stainless',
          brand: 'Moen',
          quantity: '1 unit',
          unitPrice: 189.00,
          subtotal: 189.00,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'K&B HARDWARE',
          product: 'InSinkErator Badger 5 Disposal',
          color: 'N/A',
          brand: 'InSinkErator',
          quantity: '1 unit',
          unitPrice: 119.00,
          subtotal: 119.00,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'CABINETS / ACCESSORIES',
          product: 'Rev-A-Shelf Lazy Susan 28"',
          color: 'Natural Wood',
          brand: 'Rev-A-Shelf',
          quantity: '1 unit',
          unitPrice: 189.50,
          subtotal: 189.50,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'CABINETS / ACCESSORIES',
          product: 'Rev-A-Shelf Pull-Out Waste Container',
          color: 'Silver/White',
          brand: 'Rev-A-Shelf',
          quantity: '1 unit',
          unitPrice: 165.99,
          subtotal: 165.99,
          status: 'delivered',
          statusText: 'Delivered',
        },
        {
          category: 'TILE / ACCESSORIES',
          product: 'Custom Building Products Grout',
          color: 'Bright White',
          brand: 'Custom',
          quantity: '3 bags',
          unitPrice: 31.59,
          subtotal: 94.77,
          status: 'delivered',
          statusText: 'Delivered',
        },
      ],
    },
  };

  const baseOrder = allOrders[orderId] || allOrders['EC099016'];
  // Demo: honor any locally-flipped status from a prior Approve/Pay click.
  const effectiveStatus = useEffectiveOrderStatus(baseOrder.id, baseOrder.status);
  const order = { ...baseOrder, status: effectiveStatus };

  const [rfmsModal, setRfmsModal] = useState({ open: false, variant: null });
  const openApprove = () => setRfmsModal({ open: true, variant: 'approve' });
  const openPay = () => setRfmsModal({ open: true, variant: 'pay' });
  const closeRfms = () => setRfmsModal({ open: false, variant: null });
  const onRfmsSuccess = () => {
    // 'ready' (Quote ready to approve) → 'payment' (Order Confirmed, down payment due)
    // 'payment' (Down payment due)     → 'processing' (Order Confirmed, in progress)
    if (rfmsModal.variant === 'approve') setStatusOverride(order.id, 'payment');
    else if (rfmsModal.variant === 'pay') setStatusOverride(order.id, 'processing');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <AlertCircle size={14} />;
      case 'payment':
      case 'pending':
        return <Clock size={14} />;
      case 'processing':
        return <Loader size={14} />;
      case 'complete':
      case 'delivered':
        return <CheckCircle size={14} />;
      case 'on-order':
        return <Package size={14} />;
      default:
        return <Package size={14} />;
    }
  };

  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      <Link to="/orders" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Orders
      </Link>

      {/* Order Header */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <div style={styles.orderNumber}>Order {order.id}</div>
            <div style={styles.statusBadge(order.status)}>
              {getStatusIcon(order.status)} {customerStatusLabel(order.status)}
            </div>
          </div>
          <div style={styles.balanceDue}>
            <div style={styles.balanceDueLabel}>Balance Due</div>
            <div style={styles.balanceDueValue(order.balanceDue)}>
              ${order.balanceDue.toFixed(2)}
            </div>
            {order.status === 'ready' && (
              <button
                onClick={openApprove}
                style={{
                  marginTop: 12, padding: '10px 18px',
                  background: '#07542E', color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                Approve order
              </button>
            )}
            {order.status === 'payment' && (
              <button
                onClick={openPay}
                style={{
                  marginTop: 12, padding: '10px 18px',
                  background: '#003087', color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                Pay ${order.balanceDue.toFixed(2)}
              </button>
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
            <div style={styles.detailValue}>{order.client}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Order Date</div>
            <div style={styles.detailValue}>{order.orderDate}</div>
          </div>
          <div>
            <div style={styles.detailLabel}>Expected Delivery</div>
            <div style={styles.detailValue}>{order.expectedDelivery}</div>
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
          {order.lineItems.map((item, i) => (
            <div key={i} style={styles.lineItemCard}>
              <div style={styles.lineItemHeader}>
                <div>
                  <div style={styles.lineItemCategory}>{item.category}</div>
                  <div style={styles.lineItemProduct}>{item.product}</div>
                  <div style={styles.lineItemColor}>{item.color}</div>
                </div>
                <div style={styles.statusBadge(item.status)}>
                  {getStatusIcon(item.status)} {item.statusText}
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
                  <div style={styles.lineItemValue}>${item.unitPrice.toFixed(2)}</div>
                </div>
                <div>
                  <div style={styles.lineItemLabel}>Subtotal</div>
                  <div style={styles.lineItemSubtotal}>${item.subtotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
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
        <h2 style={{ ...styles.sectionTitle, marginBottom: 12 }}>Order Summary</h2>
        <div style={styles.summaryRow(false)}>
          <span>Material</span>
          <span>${order.material.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow(false)}>
          <span>Service</span>
          <span>${order.service.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow(false)}>
          <span>Sales Tax</span>
          <span>${order.salesTax.toFixed(2)}</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryRow(true)}>
          <span>Invoice Total</span>
          <span>${order.invoiceTotal.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow(false)}>
          <span>Total Paid</span>
          <span style={{ color: colors.green }}>${order.totalPaid.toFixed(2)}</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryRow(true)}>
          <span>Balance Due</span>
          <span style={{ color: order.balanceDue > 0 ? colors.red : colors.green }}>
            ${order.balanceDue.toFixed(2)}
          </span>
        </div>

        {order.referralBonus && (
          <div style={styles.referralBadge}>
            <CheckCircle size={16} />
            Referral Bonus Earned: +${order.referralBonus.toFixed(2)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actionsRow}>
        <button style={styles.btnOutline}>
          <FileText size={16} /> View PDF
        </button>
      </div>
    </div>

    <RfmsActionModal
      isOpen={rfmsModal.open}
      onClose={closeRfms}
      variant={rfmsModal.variant}
      amount={order.balanceDue}
      orderId={order.id}
      onSuccess={onRfmsSuccess}
    />
    </div>
  );
};

export default ProSourceOrderDetail;
