import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth-context';
import Select from './components/Select';
import {
  customerStatusLabel,
  CUSTOMER_STATUS_OPTIONS,
  matchesCustomerStatus,
} from './order-status';
import { getStatusOverride, setStatusOverride } from './order-status-overrides';
import RfmsActionModal from './components/RfmsActionModal';
import {
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  X,
  ChevronRight,
  MapPin,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';

// Chip-group for Sort/Filter modals
const ChipGroup = ({ options, value, onChange, colors }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => {
      const isActive = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="px-4 py-2 text-sm rounded-md border transition-colors"
          style={{
            color: isActive ? '#fff' : colors.gray700,
            background: isActive ? colors.darkBlue : '#fff',
            borderColor: isActive ? colors.darkBlue : colors.gray300,
            fontWeight: isActive ? 600 : 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// Bottom-sheet / centered modal used by Sort and Filter
const SortFilterModal = ({ title, onClose, onApply, onReset, children, colors }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold" style={{ color: colors.gray900 }}>{title}</h2>
        <button onClick={onClose} aria-label="Close" className="p-1 -mr-1" style={{ color: colors.darkBlue, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>
      <div className="overflow-auto px-5 py-5 flex-1">
        {children}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-neutral-200">
        {onReset ? (
          <button onClick={onReset} className="text-sm font-medium" style={{ color: colors.darkBlue, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Reset Filters
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-sm font-medium px-4 py-2" style={{ color: colors.gray500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={onApply} className="text-sm font-semibold px-5 py-2 rounded-md text-white" style={{ background: colors.red, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
);

const SORT_OPTIONS = [
  { value: 'jobName', label: 'Job Name' },
  { value: 'orderNumber', label: 'Order Number' },
  { value: 'orderDate', label: 'Order Date' },
  { value: 'orderStatus', label: 'Order Status' },
];

const TIME_OPTIONS = [
  { value: '3year', label: '3 Years' },
  { value: '1year', label: '1 Year' },
  { value: '6mo', label: '6 Months' },
];

const SHOWROOM_OPTIONS = [
  { value: 'all', label: 'All Showrooms' },
  { value: 'stlouis', label: 'ProSource of St. Louis' },
  { value: 'fenton', label: 'ProSource of Fenton' },
];

// Filter dropdown options — pulled from the shared customer-facing
// taxonomy. "Order Confirmed" fans out to the payment/processing/items
// RFMS states under the hood (see matchesCustomerStatus).
const STATUS_OPTIONS = CUSTOMER_STATUS_OPTIONS;

const SEARCH_BY_OPTIONS = [
  { value: 'jobName', label: 'Side Mark/Job Name' },
  { value: 'soldTo', label: 'Sold To' },
  { value: 'invoiceNumber', label: 'Invoice Number' },
];

const SEARCH_BY_PLACEHOLDER = {
  jobName: 'Search by job name…',
  soldTo: 'Search by sold-to…',
  invoiceNumber: 'Search by invoice #…',
};

const ProSourceOrders = () => {
  const { userId, userName, loadUserData } = useAuth();
  const [activeType, setActiveType] = useState('orders');
  const [searchBy, setSearchBy] = useState('jobName');
  const [searchQuery, setSearchQuery] = useState('');
  // Applied state
  const [sortField, setSortField] = useState('orderStatus');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTime, setFilterTime] = useState('3year');
  const [filterShowroom, setFilterShowroom] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  // Modal state
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Draft state for modals (so Cancel reverts)
  const [draftSortField, setDraftSortField] = useState(sortField);
  const [draftSortDir, setDraftSortDir] = useState(sortDir);
  const [draftTime, setDraftTime] = useState(filterTime);
  const [draftShowroom, setDraftShowroom] = useState(filterShowroom);
  const [draftStatus, setDraftStatus] = useState(filterStatus);

  const openSort = () => {
    setDraftSortField(sortField); setDraftSortDir(sortDir); setSortOpen(true);
  };
  const applySort = () => {
    setSortField(draftSortField); setSortDir(draftSortDir); setSortOpen(false);
  };
  const openFilter = () => {
    setDraftTime(filterTime); setDraftShowroom(filterShowroom); setDraftStatus(filterStatus); setFilterOpen(true);
  };
  const applyFilter = () => {
    setFilterTime(draftTime); setFilterShowroom(draftShowroom); setFilterStatus(draftStatus); setFilterOpen(false);
  };
  const resetFilter = () => {
    setDraftTime('3year'); setDraftShowroom('all'); setDraftStatus('all');
  };

  const activeFilterCount = (filterTime !== '3year' ? 1 : 0) + (filterShowroom !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortField)?.label || 'Sort';

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
      cursor: 'pointer',
    },
    pageHeader: {
      marginBottom: 32,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: 700,
      color: colors.gray900,
      marginBottom: 8,
    },
    pageDesc: {
      fontSize: 14,
      color: colors.gray500,
      lineHeight: 1.6,
      maxWidth: 700,
    },
    appLink: {
      color: colors.darkBlue,
      textDecoration: 'none',
      fontWeight: 500,
    },
    searchCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 24,
    },
    searchLabel: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray700,
      marginBottom: 12,
      display: 'block',
    },
    radioGroup: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 16,
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: colors.gray700,
      cursor: 'pointer',
    },
    radioInput: {
      accentColor: colors.darkBlue,
    },
    searchRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
    },
    searchInput: {
      flex: 1,
      padding: '10px 14px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
    },
    btnPrimary: {
      padding: '10px 20px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    },
    btnOutline: {
      padding: '10px 20px',
      background: '#fff',
      color: colors.darkBlue,
      border: `1px solid ${colors.darkBlue}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
    },
    clearLink: {
      color: colors.darkBlue,
      fontSize: 14,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '10px 16px',
    },
    typeToggle: {
      display: 'inline-flex',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 24,
    },
    typeBtn: (isActive) => ({
      padding: '10px 24px',
      background: isActive ? colors.darkBlue : '#fff',
      color: isActive ? '#fff' : colors.gray700,
      border: 'none',
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
    }),
    filterRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sortDropdown: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    },
    sortLabel: {
      fontSize: 13,
      color: colors.gray500,
    },
    sortSelect: {
      padding: '8px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 13,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
    },
    filterBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 13,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
    },
    orderCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      marginBottom: 16,
      overflow: 'hidden',
    },
    orderHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    orderNumber: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
    },
    balanceDueHeader: {
      textAlign: 'right',
    },
    balanceDueLabel: {
      fontSize: 11,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    balanceDueValue: (amount) => ({
      fontSize: 18,
      fontWeight: 700,
      color: amount > 0 ? colors.red : colors.green,
    }),
    orderGrid: {
      gap: 16,
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    orderGridClass: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4',
    orderLabel: {
      fontSize: 11,
      fontWeight: 600,
      color: colors.darkBlue,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    orderValue: {
      fontSize: 14,
      color: colors.gray700,
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
        default:
          bgColor = colors.gray100;
          textColor = colors.gray700;
      }
      return {
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        background: bgColor,
        color: textColor,
      };
    },
    showroomName: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 4,
    },
    totalsGrid: {
      gap: 24,
      padding: '16px 20px',
      alignItems: 'end',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    totalsGridClass: 'flex flex-wrap gap-x-6 gap-y-3 md:grid md:grid-cols-[repeat(4,auto)_1fr_auto]',
    totalItem: {
      textAlign: 'left',
    },
    totalLabel: {
      fontSize: 10,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
    },
    totalPaid: {
      textAlign: 'right',
    },
    orderActions: {
      padding: '12px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewPdfBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 13,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
    },
    viewDetailsLink: {
      color: colors.darkBlue,
      fontSize: 13,
      fontWeight: 500,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    loadMoreBtn: {
      display: 'block',
      width: 'fit-content',
      margin: '24px auto',
      padding: '12px 32px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
    },
    emptyState: {
      padding: 64,
      textAlign: 'center',
      background: colors.gray100,
      borderRadius: 8,
    },
  };

  const FALLBACK_ORDERS = [
    {
      id: 'EC099016',
      jobName: 'Beans Kitchen Remodel',
      orderDate: '8/20/2024',
      status: 'processing',
      statusText: 'Order Being Processed',
      soldTo: (userName || 'You').toUpperCase(),
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 1758.42,
      material: 1631.28,
      salesTax: 127.14,
      service: 0,
      totalPaid: 879.21,
      balanceDue: 879.21,
    },
    {
      id: 'EC096890',
      jobName: 'Chen Master Bath',
      orderDate: '4/18/2024',
      status: 'ready',
      statusText: 'Order Ready for Approval',
      soldTo: (userName || 'You').toUpperCase(),
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 4713.89,
      material: 4364.71,
      salesTax: 349.18,
      service: 0,
      totalPaid: 0,
      balanceDue: 4713.89,
    },
    {
      id: 'EC094964',
      jobName: 'Wilson Bathroom',
      orderDate: '1/3/2024',
      status: 'payment',
      statusText: 'Order Down Payment Due',
      soldTo: (userName || 'You').toUpperCase(),
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 3241.56,
      material: 2986.50,
      salesTax: 255.06,
      service: 0,
      totalPaid: 0,
      balanceDue: 3241.56,
    },
    {
      id: 'EC091091',
      jobName: 'Anderson Office Renovation',
      orderDate: '5/26/2023',
      status: 'payment',
      statusText: 'Order Down Payment Due',
      soldTo: (userName || 'You').toUpperCase(),
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 2847.33,
      material: 2636.42,
      salesTax: 210.91,
      service: 0,
      totalPaid: 0,
      balanceDue: 2847.33,
    },
    {
      id: 'EC090657',
      jobName: 'Torres Kitchen Refresh',
      orderDate: '5/4/2023',
      status: 'complete',
      statusText: 'Order Complete',
      soldTo: (userName || 'You').toUpperCase(),
      showroom: 'ProSource of St. Louis',
      invoiceTotal: 5318.76,
      material: 4924.78,
      salesTax: 393.98,
      service: 0,
      totalPaid: 5318.76,
      balanceDue: 0,
    },
  ];

  const [orders, setOrders] = useState(FALLBACK_ORDERS);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadUserData('orders', null).then((stored) => {
      if (cancelled) return;
      if (Array.isArray(stored?.list) && stored.list.length > 0) {
        setOrders(stored.list);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Demo: any Pay/Approve clicked on the detail page (or here) flips the
  // status via localStorage. Re-read on every render so the list mirrors it.
  const [overrideTick, setOverrideTick] = useState(0);
  useEffect(() => {
    const sync = () => setOverrideTick((n) => n + 1);
    window.addEventListener('prosource-order-overrides-changed', sync);
    window.addEventListener('storage', (e) => {
      if (e.key === 'prosource_order_overrides_v1') sync();
    });
    return () => window.removeEventListener('prosource-order-overrides-changed', sync);
  }, []);
  const ordersWithOverrides = orders.map((o) => ({
    ...o,
    status: getStatusOverride(o.id) || o.status,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }));
  // Reference overrideTick so the memoization re-runs when overrides change.
  // (No-op cast — the value isn't read for its number.)
  void overrideTick;

  const [rfmsModal, setRfmsModal] = useState({ open: false, variant: null, order: null });
  const openRfms = (order, variant) => setRfmsModal({ open: true, variant, order });
  const closeRfms = () => setRfmsModal({ open: false, variant: null, order: null });
  const onRfmsSuccess = () => {
    if (!rfmsModal.order) return;
    if (rfmsModal.variant === 'approve') setStatusOverride(rfmsModal.order.id, 'payment');
    else if (rfmsModal.variant === 'pay') setStatusOverride(rfmsModal.order.id, 'processing');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <AlertCircle size={14} />;
      case 'payment':
        return <Clock size={14} />;
      case 'processing':
        return <Loader size={14} />;
      case 'complete':
        return <CheckCircle size={14} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      {/* Back Link */}
      <Link to="/settings" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* Page Header */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Estimates & Orders</h1>
        <p style={styles.pageDesc}>
          Track open orders and view history for the last three years. Use the filters to narrow down results
          by showroom, status and timeframe. Certain actions like approving and paying for orders and
          scheduling pickup appointments are only available through the Trade Pro App. {' '}
          <a
            style={styles.appLink}
            href="https://apps.apple.com/"
            target="_blank"
            rel="noopener noreferrer"
          >Download the App</a>
        </p>
      </div>

      {/* Tabs: Orders / Estimates */}
      <div className="flex gap-1 border-b border-neutral-200 mb-4">
        {['orders', 'estimates'].map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className="px-4 py-2.5 text-sm font-medium capitalize -mb-px transition-colors"
            style={{
              color: activeType === t ? colors.darkBlue : colors.gray500,
              borderBottom: activeType === t ? `2px solid ${colors.darkBlue}` : '2px solid transparent',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search field (full width) with submit-style icon button */}
      <form
        className="mb-2 flex items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
          // Mimic the real API behavior: this is where the request would fire.
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        }}
      >
        <input
          type="search"
          placeholder={SEARCH_BY_PLACEHOLDER[searchBy]}
          className="flex-1 min-w-0"
          style={{
            ...styles.searchInput,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderRight: 'none',
            boxSizing: 'border-box',
          }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Search"
          className="shrink-0 inline-flex items-center justify-center px-4"
          style={{
            background: colors.darkBlue,
            color: '#fff',
            border: 'none',
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            cursor: 'pointer',
          }}
        >
          <Search size={18} />
        </button>
      </form>

      {/* Options row: Search By + Sort + Filter */}
      <div className="flex flex-wrap items-stretch gap-2 mb-4">
        <Select
          value={searchBy}
          onChange={setSearchBy}
          options={SEARCH_BY_OPTIONS}
          className="flex-1 min-w-[160px]"
          fullWidth
        />
        <button
          onClick={openSort}
          className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white hover:border-neutral-400"
          style={{ color: colors.gray700, fontFamily: 'inherit' }}
        >
          <ArrowUpDown size={15} /> Sort
        </button>
        <button
          onClick={openFilter}
          className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:border-neutral-400"
          style={{
            color: activeFilterCount > 0 ? '#fff' : colors.gray700,
            background: activeFilterCount > 0 ? colors.darkBlue : '#fff',
            borderColor: activeFilterCount > 0 ? colors.darkBlue : colors.gray300,
            fontFamily: 'inherit',
          }}
        >
          <Filter size={15} /> Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </button>
      </div>

      {/* Active state hint */}
      {(activeFilterCount > 0 || sortField !== 'orderStatus' || sortDir !== 'desc') && (
        <div className="text-xs mb-3" style={{ color: colors.gray500 }}>
          Sorted by <strong style={{ color: colors.gray700 }}>{sortLabel}</strong> ({sortDir === 'asc' ? 'asc' : 'desc'})
          {activeFilterCount > 0 && <> · <button onClick={() => { setFilterTime('3year'); setFilterShowroom('all'); setFilterStatus('all'); }} style={{ background: 'none', border: 'none', color: colors.darkBlue, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}>Clear filters</button></>}
        </div>
      )}

      {/* Order Cards */}
      {(() => {
        const q = searchQuery.trim().toLowerCase();
        let matches = ordersWithOverrides.filter(order => {
          if (q) {
            let hit = false;
            if (searchBy === 'jobName') hit = order.jobName.toLowerCase().includes(q);
            else if (searchBy === 'soldTo') hit = order.soldTo.toLowerCase().includes(q);
            else if (searchBy === 'invoiceNumber') hit = order.id.toLowerCase().includes(q);
            if (!hit) return false;
          }
          if (!matchesCustomerStatus(filterStatus, order.status)) return false;
          if (filterShowroom !== 'all') {
            const room = order.showroom.toLowerCase();
            if (filterShowroom === 'stlouis' && !room.includes('st. louis')) return false;
            if (filterShowroom === 'fenton' && !room.includes('fenton')) return false;
          }
          return true;
        });
        matches = [...matches].sort((a, b) => {
          let av, bv;
          if (sortField === 'jobName') { av = a.jobName.toLowerCase(); bv = b.jobName.toLowerCase(); }
          else if (sortField === 'orderNumber') { av = a.id; bv = b.id; }
          else if (sortField === 'orderDate') { av = new Date(a.orderDate); bv = new Date(b.orderDate); }
          else { av = customerStatusLabel(a.status); bv = customerStatusLabel(b.status); }
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
        if (matches.length === 0) {
          return (
            <div style={{ background: '#fff', border: `1px solid ${colors.gray200}`, borderRadius: 8, padding: '40px 24px', textAlign: 'center', color: colors.gray500 }}>
              No {activeType} match these filters.
            </div>
          );
        }
        return matches.map((order) => (
        <div key={order.id} style={styles.orderCard}>
          <div style={styles.orderHeader}>
            <Link to={`/orders/${order.id}`} style={{ ...styles.orderNumber, textDecoration: 'none', color: 'inherit' }}>{order.id}</Link>
            <div style={styles.balanceDueHeader}>
              <div style={styles.balanceDueLabel}>Balance Due</div>
              <div style={styles.balanceDueValue(order.balanceDue)}>${order.balanceDue.toFixed(2)}</div>
            </div>
          </div>

          <div className={styles.orderGridClass} style={styles.orderGrid}>
            <div>
              <div style={styles.orderLabel}>Job Name</div>
              <div style={styles.orderValue}>{order.jobName}</div>
            </div>
            <div>
              <div style={styles.orderLabel}>Order Date</div>
              <div style={styles.orderValue}>{order.orderDate}</div>
            </div>
            <div>
              <div style={styles.orderLabel}>Order Status</div>
              <div style={styles.statusBadge(order.status)}>
                {customerStatusLabel(order.status)}
              </div>
              {order.status === 'ready' && (
                <button
                  onClick={(e) => { e.preventDefault(); openRfms(order, 'approve'); }}
                  style={{
                    marginTop: 8, padding: '6px 12px',
                    background: '#07542E', color: '#fff', border: 'none',
                    borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
              )}
              {order.status === 'payment' && (
                <button
                  onClick={(e) => { e.preventDefault(); openRfms(order, 'pay'); }}
                  style={{
                    marginTop: 8, padding: '6px 12px',
                    background: '#003087', color: '#fff', border: 'none',
                    borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Pay ${order.balanceDue.toFixed(2)}
                </button>
              )}
            </div>
            <div>
              <div style={styles.orderLabel}>Sold To</div>
              <div style={styles.orderValue}>{order.soldTo}</div>
            </div>
            <div>
              <div style={styles.orderLabel}>Showroom Name</div>
              <div style={styles.showroomName}>
                <MapPin size={14} color={colors.red} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={styles.orderValue}>{order.showroom}</span>
              </div>
            </div>
          </div>

          <div className={styles.totalsGridClass} style={styles.totalsGrid}>
            <div style={styles.totalItem}>
              <div style={styles.totalLabel}>Invoice Total:</div>
              <div style={styles.totalValue}>${order.invoiceTotal.toFixed(2)}</div>
            </div>
            <div style={styles.totalItem}>
              <div style={styles.totalLabel}>Material:</div>
              <div style={styles.totalValue}>${order.material.toFixed(2)}</div>
            </div>
            <div style={styles.totalItem}>
              <div style={styles.totalLabel}>Sales Tax:</div>
              <div style={styles.totalValue}>${order.salesTax.toFixed(2)}</div>
            </div>
            <div style={styles.totalItem}>
              <div style={styles.totalLabel}>Service:</div>
              <div style={styles.totalValue}>${order.service.toFixed(2)}</div>
            </div>
            <div />
            <div style={styles.totalPaid}>
              <div style={styles.totalLabel}>Total Paid</div>
              <div style={styles.totalValue}>${order.totalPaid.toFixed(2)}</div>
            </div>
          </div>

          <div style={styles.orderActions}>
            <button style={styles.viewPdfBtn}>
              <FileText size={14} /> View PDF
            </button>
            <Link to={`/orders/${order.id}`} style={{ ...styles.viewDetailsLink, textDecoration: 'none' }}>
              View Details <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        ));
      })()}

      {/* Load More */}
      <button style={styles.loadMoreBtn}>Load More</button>
    </div>

    {/* Sort Modal */}
    {sortOpen && (
      <SortFilterModal title="Sort By" onClose={() => setSortOpen(false)} onApply={applySort} colors={colors}>
        <ChipGroup
          options={SORT_OPTIONS}
          value={draftSortField}
          onChange={setDraftSortField}
          colors={colors}
        />
        <div className="mt-6 mb-3 text-base font-semibold" style={{ color: colors.gray900 }}>Sort Direction</div>
        <ChipGroup
          options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]}
          value={draftSortDir}
          onChange={setDraftSortDir}
          colors={colors}
        />
      </SortFilterModal>
    )}

    {/* Filter Modal */}
    {filterOpen && (
      <SortFilterModal title="Filter By" onClose={() => setFilterOpen(false)} onApply={applyFilter} onReset={resetFilter} colors={colors}>
        <ChipGroup options={TIME_OPTIONS} value={draftTime} onChange={setDraftTime} colors={colors} />
        <div className="border-t border-neutral-200 my-4" />
        <ChipGroup options={SHOWROOM_OPTIONS} value={draftShowroom} onChange={setDraftShowroom} colors={colors} />
        <div className="border-t border-neutral-200 my-4" />
        <ChipGroup options={STATUS_OPTIONS} value={draftStatus} onChange={setDraftStatus} colors={colors} />
      </SortFilterModal>
    )}

    <RfmsActionModal
      isOpen={rfmsModal.open}
      onClose={closeRfms}
      variant={rfmsModal.variant}
      amount={rfmsModal.order?.balanceDue}
      orderId={rfmsModal.order?.id}
      onSuccess={onRfmsSuccess}
    />
    </div>
  );
};

export default ProSourceOrders;
