import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Select from './components/Select';
import {
  customerStatusLabel,
  CUSTOMER_STATUS_OPTIONS,
  matchesCustomerStatus,
  statusTone,
  statusIcon,
} from './order-status';
import {
  useOrders,
  availableActions,
  headlineLabel,
  headlineAmount,
  isEstimate,
  withinTimeRange,
  TIME_RANGE_OPTIONS,
  DEFAULT_TIME_RANGE,
  money,
} from './order-model';
import RfmsActionModal from './components/RfmsActionModal';
import {
  Search,
  Filter,
  ArrowUpDown,
  X,
  ChevronRight,
  MapPin,
  ArrowLeft,
  FileText,
  AlertCircle,
  RotateCw,
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

const SHOWROOM_OPTIONS = [
  { value: 'all', label: 'All Showrooms' },
  { value: 'stlouis', label: 'ProSource of St. Louis' },
  { value: 'fenton', label: 'ProSource of Fenton' },
];

// Filter dropdown options: pulled from the shared customer-facing
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
  const { orders: allDocs, status: loadStatus, error: loadError, reload, runAction } = useOrders();
  const [activeType, setActiveType] = useState('orders');
  const [searchBy, setSearchBy] = useState('jobName');
  const [searchQuery, setSearchQuery] = useState('');
  // Applied state
  const [sortField, setSortField] = useState('orderStatus');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTime, setFilterTime] = useState(DEFAULT_TIME_RANGE);
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
    setDraftTime(DEFAULT_TIME_RANGE); setDraftShowroom('all'); setDraftStatus('all');
  };

  const activeFilterCount = (filterTime !== DEFAULT_TIME_RANGE ? 1 : 0) + (filterShowroom !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);
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
    // Colours come from order-status.js so this page and the detail page can't
    // drift apart (and so `items` / `pickup` don't fall through to grey).
    statusBadge: (status) => {
      const tone = statusTone(status);
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
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
      justifyContent: 'flex-end',
      alignItems: 'center',
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
    emptyState: {
      padding: 64,
      textAlign: 'center',
      background: colors.gray100,
      borderRadius: 8,
      color: colors.gray500,
      fontSize: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray700,
      marginBottom: 6,
    },
    resultCount: {
      fontSize: 12,
      color: colors.gray500,
      margin: '20px 0 8px',
      textAlign: 'center',
    },
  };

  // Orders and estimates come from ONE place: the user's `orders` blob, read
  // through useOrders(), the same hook /orders/:id and the project page use.
  // This page used to render five fabricated orders whenever the blob was
  // empty, which meant the list and the detail page disagreed about what an
  // order even was.
  const docs = allDocs.filter((d) =>
    activeType === 'estimates' ? isEstimate(d) : !isEstimate(d)
  );

  const [rfmsModal, setRfmsModal] = useState({ open: false, variant: null, order: null });
  const openRfms = (order, variant) => setRfmsModal({ open: true, variant, order });
  const closeRfms = () => setRfmsModal({ open: false, variant: null, order: null });
  // Throws on failure. The modal catches it and shows the error instead of a
  // fake success.
  const submitRfms = () => runAction(rfmsModal.order.id, rfmsModal.variant);

  const actionButton = (order, action) => {
    const label =
      action === 'approve' ? 'Approve'
        : action === 'decline' ? 'Decline'
          : `Pay ${money(order.balanceDue)}`;
    const background =
      action === 'approve' ? colors.green
        : action === 'decline' ? '#fff'
          : colors.darkBlue;
    return (
      <button
        key={action}
        onClick={(e) => { e.preventDefault(); openRfms(order, action); }}
        style={{
          padding: '6px 12px',
          background,
          color: action === 'decline' ? colors.gray700 : '#fff',
          border: action === 'decline' ? `1px solid ${colors.gray300}` : 'none',
          borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
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

      {/* Search field (full width) with submit-style icon button.
          The list filters live as you type; the whole collection is already
          local, so there's no request to fire. Submit just dismisses the
          on-screen keyboard, which is what the button is for on mobile. */}
      <form
        className="mb-2 flex items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
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
          {activeFilterCount > 0 && <> · <button onClick={() => { setFilterTime(DEFAULT_TIME_RANGE); setFilterShowroom('all'); setFilterStatus('all'); }} style={{ background: 'none', border: 'none', color: colors.darkBlue, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}>Clear filters</button></>}
        </div>
      )}

      {/* Loading / error / empty. These three used to not exist: the page
          always had five fake orders to fall back on, so a broken fetch was
          indistinguishable from a working one. */}
      {loadStatus === 'loading' && (
        <div style={styles.emptyState}>
          <RotateCw size={28} color={colors.gray400} style={{ marginBottom: 12 }} />
          <div style={styles.emptyTitle}>Loading your {activeType}…</div>
        </div>
      )}

      {loadStatus === 'error' && (
        <div style={styles.emptyState}>
          <AlertCircle size={28} color={colors.red} style={{ marginBottom: 12 }} />
          <div style={styles.emptyTitle}>We couldn't load your {activeType}</div>
          <div style={{ marginBottom: 16 }}>{loadError}</div>
          <button onClick={reload} style={styles.btnOutline}>Try again</button>
        </div>
      )}

      {loadStatus === 'ready' && docs.length === 0 && (
        <div style={styles.emptyState}>
          <FileText size={28} color={colors.gray400} style={{ marginBottom: 12 }} />
          <div style={styles.emptyTitle}>No {activeType} yet</div>
          <div>
            {activeType === 'estimates'
              ? 'Quotes your account manager prepares for you will show up here.'
              : 'Once you approve a quote it becomes an order and appears here.'}
          </div>
        </div>
      )}

      {/* Order / estimate cards */}
      {loadStatus === 'ready' && docs.length > 0 && (() => {
        const q = searchQuery.trim().toLowerCase();
        let matches = docs.filter(order => {
          if (q) {
            let hit = false;
            if (searchBy === 'jobName') hit = order.jobName.toLowerCase().includes(q);
            else if (searchBy === 'soldTo') hit = order.soldTo.toLowerCase().includes(q);
            else if (searchBy === 'invoiceNumber') hit = order.id.toLowerCase().includes(q);
            if (!hit) return false;
          }
          if (!matchesCustomerStatus(filterStatus, order.status)) return false;
          // The time range used to be selectable, count toward the filter
          // badge, and then never get applied.
          if (!withinTimeRange(order, filterTime)) return false;
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
          else if (sortField === 'orderDate') { av = a.orderDateTs || 0; bv = b.orderDateTs || 0; }
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
        return (
          <>
            {matches.map((order) => {
              const StatusIcon = statusIcon(order.status);
              const actions = availableActions(order);
              return (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <Link to={`/orders/${order.id}`} style={{ ...styles.orderNumber, textDecoration: 'none', color: 'inherit' }}>{order.id}</Link>
                    <div style={styles.balanceDueHeader}>
                      {/* A quote owes nothing until it's approved, so it shows a
                          total rather than a balance due in red. */}
                      <div style={styles.balanceDueLabel}>{headlineLabel(order)}</div>
                      <div style={
                        isEstimate(order)
                          ? { ...styles.balanceDueValue(0), color: colors.gray900 }
                          : styles.balanceDueValue(order.balanceDue)
                      }>
                        {money(headlineAmount(order))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.orderGridClass} style={styles.orderGrid}>
                    <div>
                      <div style={styles.orderLabel}>Job Name</div>
                      <div style={styles.orderValue}>{order.jobName}</div>
                    </div>
                    <div>
                      <div style={styles.orderLabel}>{isEstimate(order) ? 'Quote Date' : 'Order Date'}</div>
                      <div style={styles.orderValue}>{order.orderDate || '--'}</div>
                    </div>
                    <div>
                      <div style={styles.orderLabel}>Status</div>
                      <div style={styles.statusBadge(order.status)}>
                        {StatusIcon && <StatusIcon size={12} />}
                        {customerStatusLabel(order.status)}
                      </div>
                      {actions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {actions.map((action) => actionButton(order, action))}
                        </div>
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
                      <div style={styles.totalLabel}>{isEstimate(order) ? 'Quote Total:' : 'Invoice Total:'}</div>
                      <div style={styles.totalValue}>{money(order.invoiceTotal)}</div>
                    </div>
                    <div style={styles.totalItem}>
                      <div style={styles.totalLabel}>Material:</div>
                      <div style={styles.totalValue}>{money(order.material)}</div>
                    </div>
                    <div style={styles.totalItem}>
                      <div style={styles.totalLabel}>Sales Tax:</div>
                      <div style={styles.totalValue}>{money(order.salesTax)}</div>
                    </div>
                    <div style={styles.totalItem}>
                      <div style={styles.totalLabel}>Service:</div>
                      <div style={styles.totalValue}>{money(order.service)}</div>
                    </div>
                    <div />
                    <div style={styles.totalPaid}>
                      <div style={styles.totalLabel}>Total Paid</div>
                      <div style={styles.totalValue}>{money(order.totalPaid)}</div>
                    </div>
                  </div>

                  <div style={styles.orderActions}>
                    <Link to={`/orders/${order.id}`} style={{ ...styles.viewDetailsLink, textDecoration: 'none' }}>
                      View Details <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
            {/* Replaces a "Load More" button that had nothing to load: the whole
                collection is already on screen. */}
            <div style={styles.resultCount}>
              Showing {matches.length} of {docs.length} {docs.length === 1 ? activeType.replace(/s$/, '') : activeType}
            </div>
          </>
        );
      })()}

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
        <ChipGroup options={TIME_RANGE_OPTIONS} value={draftTime} onChange={setDraftTime} colors={colors} />
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
      onSubmit={submitRfms}
    />
    </div>
  );
};

export default ProSourceOrders;
