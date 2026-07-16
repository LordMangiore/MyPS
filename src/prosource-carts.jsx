import React, { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import {
  loadSavedCartIntoActive, saveActiveAsNewCart, guestCartCount,
} from './guest-cart';
import { Link, useNavigate } from 'react-router-dom';
import Select from './components/Select';
import {
  Search,
  Plus,
  Filter,
  ShoppingCart,
  ArrowLeft,
  Trash2,
  Share2,
  ChevronDown,
  ChevronUp,
  Image,
  MoreHorizontal,
  Clock,
  Package,
  Copy,
  Pencil,
  Check,
  X,
} from 'lucide-react';

const ProSourceCarts = () => {
  const { userId, userName, loadUserData, saveUserData } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCart, setExpandedCart] = useState(null);
  const [sortBy, setSortBy] = useState('updated');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

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
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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
      maxWidth: 600,
    },
    btnPrimaryNoWrap: 'whitespace-nowrap shrink-0',
    btnPrimary: {
      padding: '12px 20px',
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
      padding: '10px 16px',
      background: '#fff',
      color: colors.darkBlue,
      border: `1px solid ${colors.darkBlue}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    },
    searchFilterRow: {
      gap: 12,
      marginBottom: 24,
    },
    searchFilterRowClass: 'flex flex-col sm:flex-row',
    searchInput: {
      width: '100%',
      padding: '10px 14px 10px 40px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
    },
    searchWrapper: {
      position: 'relative',
      flex: 2,
      minWidth: 0,
    },
    searchWrapperClass: 'w-full sm:min-w-[400px]',
    searchIcon: {
      position: 'absolute',
      left: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      color: colors.gray400,
    },
    sortSelect: {
      padding: '10px 14px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
      minWidth: 180,
    },
    statsRow: {
      gap: 16,
      marginBottom: 32,
    },
    statsRowClass: 'grid grid-cols-1 sm:grid-cols-3 gap-4',
    statCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 8,
      padding: 20,
      textAlign: 'center',
    },
    statNumber: {
      fontSize: 32,
      fontWeight: 700,
      color: colors.darkBlue,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.gray500,
    },
    cartCard: {
      background: '#fff',
      border: `1px solid ${colors.gray200}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    cartHeader: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 20,
      borderBottom: `1px solid ${colors.gray100}`,
    },
    cartTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    cartMeta: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      fontSize: 13,
      color: colors.gray500,
    },
    cartMetaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    cartActions: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      padding: '8px 14px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 13,
      color: colors.gray700,
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    addToCartBtn: {
      padding: '8px 14px',
      border: 'none',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      color: '#fff',
      background: colors.darkBlue,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
    },
    deleteBtn: {
      padding: '8px 14px',
      border: `1px solid ${colors.red}`,
      borderRadius: 6,
      fontSize: 13,
      color: colors.red,
      background: '#fff',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
    },
    productsPreview: {
      display: 'flex',
      gap: 8,
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.gray100}`,
      overflowX: 'auto',
    },
    productThumb: {
      width: 64,
      height: 64,
      borderRadius: 6,
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    },
    moreProducts: {
      width: 64,
      height: 64,
      borderRadius: 6,
      background: colors.gray100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 13,
      fontWeight: 600,
      color: colors.gray500,
    },
    cartFooter: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      background: colors.gray100,
    },
    showDetailsBtn: {
      background: 'none',
      border: 'none',
      color: colors.darkBlue,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    shareBtn: {
      background: 'none',
      border: 'none',
      color: colors.gray500,
      fontSize: 13,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    expandedContent: {
      padding: 20,
      borderTop: `1px solid ${colors.gray200}`,
      background: colors.gray100,
    },
    productList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
    productRow: {
      gap: 12,
      padding: 12,
      background: '#fff',
      borderRadius: 8,
      border: `1px solid ${colors.gray200}`,
    },
    productImage: {
      borderRadius: 6,
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    productInfo: {
      minWidth: 0,
    },
    productName: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    productSku: {
      fontSize: 12,
      color: colors.gray500,
      marginBottom: 4,
    },
    productCategory: {
      fontSize: 12,
      color: colors.gray500,
    },
    productQty: {
      textAlign: 'center',
      minWidth: 80,
    },
    qtyLabel: {
      fontSize: 11,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    qtyValue: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
    },
    productPrice: {
      textAlign: 'right',
      minWidth: 100,
    },
    priceLabel: {
      fontSize: 11,
      color: colors.gray500,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    priceValue: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.gray900,
    },
    removeItemBtn: {
      padding: 8,
      background: 'none',
      border: 'none',
      color: colors.gray400,
      cursor: 'pointer',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      padding: 64,
      textAlign: 'center',
      background: colors.gray100,
      borderRadius: 12,
    },
    emptyIcon: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.gray500,
      marginBottom: 20,
    },
  };

  // /carts is the *saved carts library*, members only. Guests don't have a
  // library; their active cart lives at /cart, so we send them there.
  const [carts, setCarts] = useState([]);

  useEffect(() => {
    if (!userId) {
      navigate('/cart', { replace: true });
      return;
    }
    let cancelled = false;
    loadUserData('carts', null).then((stored) => {
      if (cancelled) return;
      setCarts(Array.isArray(stored?.list) ? stored.list : []);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /**
   * "Add to Cart" now means add to cart.
   *
   * It used to call loadSavedCartIntoActive, which *replaced* the active cart
   * wholesale: click it with a cart in progress and that cart was gone, with
   * no warning and no undo. It merges now: quantities stack, and nothing the
   * user already had is lost.
   */
  const loadCart = (cart) => {
    const before = guestCartCount();
    loadSavedCartIntoActive(cart, { mode: 'merge' });
    const added = guestCartCount() - before;
    setFlash(
      before === 0
        ? `Added ${cart.itemCount} item${cart.itemCount !== 1 ? 's' : ''} to your cart`
        : `Merged into your cart (${added > 0 ? `+${added}` : 'no new'} item${added === 1 ? '' : 's'})`
    );
    navigate('/cart');
  };

  const touch = (cart) => {
    const now = Date.now();
    return {
      ...cart,
      updatedAt: new Date(now).toLocaleDateString('en-US'),
      updatedAtTs: now,
      updatedBy: userName || 'You',
    };
  };

  const commitRename = (cart) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name || name === cart.name) return;
    setCarts((prev) => {
      const next = prev.map((c) => (c.id === cart.id ? touch({ ...c, name }) : c));
      persistCarts(next);
      return next;
    });
  };

  const duplicateCart = (cart) => {
    const now = Date.now();
    setCarts((prev) => {
      const copy = {
        ...cart,
        id: `cart-${now}`,
        name: `${cart.name} (copy)`,
        updatedAt: new Date(now).toLocaleDateString('en-US'),
        updatedAtTs: now,
        updatedBy: userName || 'You',
        // Deep-ish copy so editing one cart's lines can't mutate the other's.
        products: (cart.products || []).map((p) => ({ ...p })),
      };
      const next = [copy, ...prev];
      persistCarts(next);
      return next;
    });
    setFlash('Cart duplicated');
  };

  const deleteCart = (cart) => {
    setConfirmDeleteId(null);
    setCarts((prev) => {
      const next = prev.filter((c) => c.id !== cart.id);
      persistCarts(next);
      return next;
    });
    setFlash(`Deleted "${cart.name}"`);
  };

  /**
   * The empty state's "Create Cart" button was dead, and `saveActiveAsNewCart`
   * was imported by nobody, so there was no way to save a cart from anywhere
   * in the app. This is that entry point: snapshot whatever is in the active
   * cart into the library.
   */
  const createCartFromActive = async () => {
    if (busy) return;
    if (guestCartCount() === 0) {
      // Nothing to snapshot, so send them to fill a cart rather than creating an
      // empty shell that the library can't render.
      navigate('/shop');
      return;
    }
    setBusy(true);
    try {
      const saved = await saveActiveAsNewCart({ userId, userName, loadUserData, saveUserData });
      if (saved) {
        setCarts((prev) => [saved, ...prev]);
        setFlash(`Saved "${saved.name}"`);
      }
    } catch (err) {
      console.warn('Create cart failed:', err.message);
      setFlash('Could not save your active cart.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (cart, product) => {
    const key = product.sku || String(product.id);
    setCarts(prev => {
      const next = prev
        .map(c => {
          if (c.id !== cart.id) return c;
          const products = c.products.filter(p => (p.sku || String(p.id)) !== key);
          return touch({
            ...c,
            products,
            itemCount: products.reduce((n, p) => n + (p.qty || 1), 0),
          });
        })
        // A cart emptied to zero drops out of the library. There's an explicit
        // Delete now, but this still keeps a 0-item husk out of the list.
        .filter(c => c.products && c.products.length > 0);
      persistCarts(next);
      return next;
    });
  };

  // The `carts` blob holds both the saved-cart library (`list`) and the mirror
  // of the user's active cart (`active`, written by guest-cart.js). Read before
  // write so saving the library doesn't wipe the active cart.
  const persistCarts = (next) => {
    if (!userId) return;
    loadUserData('carts', null)
      .then((stored) => saveUserData('carts', { ...(stored || {}), list: next }))
      .catch((err) => console.warn('Carts save failed:', err.message));
  };

  // The sort control was a stub: it had state and a dropdown, and the value was
  // never read. It sorts now.
  const filteredCarts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hits = q
      ? carts.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.products || []).some(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q)
          )
        )
      : carts;
    const out = [...hits];
    if (sortBy === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'items') out.sort((a, b) => (b.itemCount || 0) - (a.itemCount || 0));
    else out.sort((a, b) => (b.updatedAtTs || 0) - (a.updatedAtTs || 0));
    return out;
  }, [carts, searchQuery, sortBy]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div style={styles.wrapper}>
    <div style={styles.container}>
      {/* Back Link */}
      <Link to="/settings" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* Page Header */}
      <div style={styles.pageHeader}>
        <div className="flex-1 min-w-0">
          <h1 style={styles.pageTitle}>Saved Carts</h1>
          <p style={styles.pageDesc}>
            Snapshots you've saved for later. Adding one merges its items into your
            active cart, so nothing you already had gets replaced.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            style={styles.btnOutline}
            onClick={createCartFromActive}
            disabled={busy}
            title="Snapshot your active cart into this library"
          >
            <Plus size={16} /> {busy ? 'Saving…' : 'Save active cart'}
          </button>
          <Link to="/cart" style={styles.btnPrimary} className={styles.btnPrimaryNoWrap}>
            <ShoppingCart size={16} /> View active cart
          </Link>
        </div>
      </div>

      {flash && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, background: '#e8f5e9',
          border: `1px solid #c8e6c9`, color: colors.green, fontSize: 13,
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={15} /> {flash}
        </div>
      )}

      {/* Search + Sort (saved-carts mode for logged-in users only) */}
      {userId && (
      <div className="flex flex-wrap items-stretch gap-2 mb-6">
        <div className="flex-1 min-w-[180px]" style={{ position: 'relative' }}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search carts..."
            style={{ ...styles.searchInput, width: '100%', boxSizing: 'border-box' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'updated', label: 'Last Updated' },
            { value: 'name', label: 'Name' },
            { value: 'items', label: 'Item Count' },
          ]}
          className="shrink-0 min-w-[150px]"
        />
      </div>
      )}

      {/* Cart Cards */}
      {filteredCarts.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <ShoppingCart size={48} color={colors.gray300} />
          </div>
          <div style={styles.emptyTitle}>No saved carts found</div>
          <div style={styles.emptyText}>
            {searchQuery
              ? 'Try adjusting your search terms'
              : guestCartCount() > 0
                ? 'Save the cart you have going and it will show up here.'
                : 'Add products to your cart, then save it here to come back to later.'}
          </div>
          {/* This button used to do nothing at all. */}
          <button style={styles.btnPrimary} onClick={createCartFromActive} disabled={busy}>
            <Plus size={16} />
            {busy ? 'Saving…' : guestCartCount() > 0 ? 'Save my active cart' : 'Browse products'}
          </button>
        </div>
      ) : (
        filteredCarts.map(cart => (
          <div key={cart.id} style={styles.cartCard}>
            <div style={styles.cartHeader}>
              <div className="min-w-0">
                {renamingId === cart.id ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(cart);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      style={{
                        ...styles.searchInput, padding: '6px 10px', fontSize: 16,
                        fontWeight: 600, width: 260, maxWidth: '100%',
                      }}
                    />
                    <button style={styles.actionBtn} onClick={() => commitRename(cart)} title="Save name">
                      <Check size={14} />
                    </button>
                    <button style={styles.actionBtn} onClick={() => setRenamingId(null)} title="Cancel">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={styles.cartTitle} className="truncate">{cart.name}</div>
                )}
                <div style={styles.cartMeta}>
                  <span style={styles.cartMetaItem}>
                    <Clock size={14} />
                    Updated {cart.updatedAt} by {cart.updatedBy}
                  </span>
                  <span style={styles.cartMetaItem}>
                    <Package size={14} />
                    {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div style={styles.cartActions}>
                {userId && (
                  <>
                    <button
                      style={styles.addToCartBtn}
                      onClick={() => loadCart(cart)}
                      title="Merge these items into your active cart"
                    >
                      <ShoppingCart size={14} /> Add to Cart
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={() => { setRenamingId(cart.id); setRenameDraft(cart.name); }}
                      title="Rename cart"
                    >
                      <Pencil size={14} /> Rename
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={() => duplicateCart(cart)}
                      title="Duplicate cart"
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                    {confirmDeleteId === cart.id ? (
                      <>
                        <button style={styles.deleteBtn} onClick={() => deleteCart(cart)}>
                          <Trash2 size={14} /> Confirm delete
                        </button>
                        <button style={styles.actionBtn} onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        style={styles.actionBtn}
                        onClick={() => setConfirmDeleteId(cart.id)}
                        title="Delete cart"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Items always render inline: no Show/Hide toggle, no thumbnail grid above. */}
            {cart.products.length > 0 && (
              <div style={styles.expandedContent}>
                <div style={styles.productList}>
                  {cart.products.map(product => (
                    <div key={product.sku || product.id} className="flex items-start gap-3 sm:items-center" style={styles.productRow}>
                      {/* saveActiveAsNewCart has always persisted `image`, yet this
                          rendered a grey placeholder icon regardless. */}
                      <div className="w-14 h-14 sm:w-20 sm:h-20 overflow-hidden" style={styles.productImage}>
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            className="w-full h-full"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <Image size={28} color={colors.gray400} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0" style={styles.productInfo}>
                        <div style={styles.productName} className="truncate">
                          {/* Item names were plain text, and dead ends. They link
                              to the product page now. */}
                          <Link
                            to={`/shop/${encodeURIComponent(product.sku || product.id)}`}
                            style={{ color: colors.gray900, textDecoration: 'none' }}
                          >
                            {product.isSample && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: colors.darkBlue,
                                background: '#e8f0fe', padding: '2px 5px', borderRadius: 3, marginRight: 6,
                              }}>SAMPLE</span>
                            )}
                            {product.name}
                          </Link>
                        </div>
                        <div style={styles.productSku}>SKU: {product.sku}</div>
                        <div style={styles.productCategory}>
                          {product.category}
                          {product.colorName ? ` · ${product.colorName}` : ''}
                        </div>
                        <div className="flex sm:hidden flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                          <span style={{ color: colors.gray500 }}>Qty <span style={{ color: colors.gray900, fontWeight: 600 }}>{product.qty}</span></span>
                          <span style={{ color: colors.gray500 }}>List <span style={{ color: colors.gray900, fontWeight: 600 }}>{product.price > 0 ? `$${product.price.toFixed(2)}` : 'N/A'}</span></span>
                          <span style={{ color: colors.gray500 }}>Quote <span style={{ color: colors.darkBlue, fontWeight: 600 }}>To be quoted</span></span>
                        </div>
                      </div>
                      <div className="hidden sm:block" style={styles.productQty}>
                        <div style={styles.qtyLabel}>Qty</div>
                        <div style={styles.qtyValue}>{product.qty}</div>
                      </div>
                      <div className="hidden sm:block" style={styles.productPrice}>
                        <div style={styles.priceLabel}>List</div>
                        <div style={{ ...styles.priceValue, color: colors.gray500, fontWeight: 500 }}>
                          {product.price > 0 ? `$${product.price.toFixed(2)}` : 'N/A'}
                        </div>
                      </div>
                      <div className="hidden sm:block" style={styles.productPrice}>
                        <div style={styles.priceLabel}>Quote</div>
                        <div style={{ ...styles.priceValue, fontSize: 13, color: colors.darkBlue }}>
                          To be quoted
                        </div>
                      </div>
                      <button
                        className="shrink-0"
                        style={styles.removeItemBtn}
                        onMouseOver={(e) => e.currentTarget.style.color = colors.red}
                        onMouseOut={(e) => e.currentTarget.style.color = colors.gray400}
                        title="Remove item"
                        onClick={() => removeItem(cart, product)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}

    </div>
    </div>
  );
};

export default ProSourceCarts;
