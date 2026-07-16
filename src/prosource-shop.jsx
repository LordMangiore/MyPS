import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Search, Filter, ChevronRight, ChevronDown, ChevronLeft,
  Heart, ShoppingCart, Star, Info, X, Check, Minus, Plus,
  Grid, List, SlidersHorizontal, Home, Send, MessageCircle,
  Trash2, Truck, MapPin, Package, AlertTriangle, Save,
} from 'lucide-react';
import {
  getGuestCart, addToGuestCart, removeFromGuestCart, updateGuestCartQty,
  clearGuestCart, subscribeGuestCart, migrateActiveCartKeys, saveActiveAsNewCart,
} from './guest-cart';
import { useAuth } from './auth-context';
import QuoteWizard from './prosource-quote-wizard';
import Select from './components/Select';
import { normalizeStored, mergeCartItemsIntoProducts } from './project-model';
import {
  fetchCatalog, CATEGORIES, DEPARTMENTS, resolveProduct, migrateItemKeys,
  colorVariants,
} from './shop-catalog';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  lightBlue: '#6CACE4',
  green: '#07542E',
  gray50: '#f9f9f8',
  gray100: '#f5f5f5',
  gray200: '#e5e5e5',
  gray300: '#d4d4d4',
  gray400: '#a3a3a3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray900: '#171717',
};

// The catalog is served by /api/products and bundled as FALLBACK_PRODUCTS in
// shop-catalog.js, which also owns SKU resolution for legacy stored cart keys.
const categories = CATEGORIES;
const departments = DEPARTMENTS;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A-Z' },
];

const sortProducts = (list, sortBy) => {
  const out = [...list];
  // Products with no list price sort last in both price directions: a null
  // price means "call for pricing", not "free".
  const byPrice = (dir) => (a, b) => {
    if (a.listPrice == null && b.listPrice == null) return 0;
    if (a.listPrice == null) return 1;
    if (b.listPrice == null) return -1;
    return (a.listPrice - b.listPrice) * dir;
  };
  if (sortBy === 'price-asc') out.sort(byPrice(1));
  else if (sortBy === 'price-desc') out.sort(byPrice(-1));
  else if (sortBy === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
};

export default function ProSourceShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { userId, userName, userEmail, showroom, accountManager, loadUserData, saveUserData } = useAuth();
  // Canonical PDP route is /shop/:sku. `?product=<id>` is the old link shape.
  // Still honored, resolved through the catalog and redirected below so old
  // bookmarks and stored links don't rot.
  const routeSku = params.sku ? decodeURIComponent(params.sku) : null;
  const legacyProductId = searchParams.get('product');
  // Rich quote/cart page is the same view whether you're on /cart or the legacy ?view=quote URL.
  const viewQuotePage = location.pathname === '/cart' || searchParams.get('view') === 'quote';
  const activeDept = searchParams.get('dept');
  const deptCategories = activeDept && departments[activeDept] ? departments[activeDept] : null;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');

  // ---- Catalog ----
  // Fetched from /api/products, with a bundled fallback so the shop never
  // renders empty just because a function hiccuped. `catalogSource` drives an
  // honest banner when we're showing the bundled copy.
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSource, setCatalogSource] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetchCatalog().then(({ products: list, source, error }) => {
      if (cancelled) return;
      setProducts(list);
      setCatalogSource(source);
      setCatalogError(error);
      setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [catalogReloadKey]);

  // Mirror the shared active-cart store. All mutations go through the store
  // helpers so the nav badge and /carts page stay in sync.
  const [quoteCart, setQuoteCart] = useState(() => getGuestCart().items);
  useEffect(() => {
    const sync = () => setQuoteCart(getGuestCart().items);
    sync();
    return subscribeGuestCart(sync);
  }, []);

  // Stored carts predate SKUs, so they hold the synthesized `sku-prod-001`.
  // Re-key them onto whatever the catalog calls those products now, so adding
  // the same product again bumps the qty instead of forking a second line.
  //
  // Keyed on the cart, not just the catalog: sign-in adoption pulls the
  // account's stored cart down *after* the first pass would have run, and those
  // items can still be on legacy keys. Terminates because the helper doesn't
  // write when nothing changed.
  useEffect(() => {
    if (products.length === 0) return;
    migrateActiveCartKeys(migrateItemKeys, products);
  }, [products, quoteCart]);
  const [showCart, setShowCart] = useState(false);
  const [cartSubmitted, setCartSubmitted] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState('specifications');
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [sfNeeded, setSfNeeded] = useState('');
  const [boxQty, setBoxQty] = useState(1);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [savedProducts, setSavedProducts] = useState([]);

  // Guests submit through the QuoteWizard (project type → zip → timing →
  // contact → OTP), which doubles as account creation. Members submit
  // inline straight to their account manager.
  // Intent controls what the backend does on submit:
  //   'quote' → notify the AM that a quote was requested (the hot path)
  //   'save'  → just create the project + account, no quote signal. AM still
  //             gets the lead in their dashboard but it's flagged as "not yet
  //             requested pricing" so they treat it as a warm relationship
  //             rather than a hot lead.
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [wizardIntent, setWizardIntent] = useState('quote');
  // Members annotate their submission for their AM. Guests answer the same
  // question inside the QuoteWizard (its own `notes` step), so this is the
  // member-only field. The guest contact fields that used to live here
  // (name/email/company/phone/zip) were never rendered and never passed to the
  // wizard; the wizard collects contact details itself. Deleted rather than
  // wired: duplicating them here would just be a second source of truth.
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedQuoteId, setSubmittedQuoteId] = useState(null);

  // PDP target: the canonical /shop/:sku route first, then a legacy
  // `?product=<id>` link resolved through the catalog.
  const selectedProduct = React.useMemo(() => {
    if (products.length === 0) return null;
    const key = routeSku || legacyProductId;
    if (!key) return null;
    return resolveProduct(key, products);
  }, [products, routeSku, legacyProductId]);

  // A key we can't resolve is a real 404, not a silent fall-through to the
  // catalog. Only assert that once the catalog has actually loaded.
  const productNotFound =
    !catalogLoading && !selectedProduct && !!(routeSku || legacyProductId);

  // Old `?product=` links get upgraded to the canonical URL in place, so a
  // share from this page is always the shareable form.
  useEffect(() => {
    if (!legacyProductId || routeSku || !selectedProduct) return;
    navigate(`/shop/${encodeURIComponent(selectedProduct.sku)}`, { replace: true });
  }, [legacyProductId, routeSku, selectedProduct, navigate]);

  const filteredProducts = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const hits = products.filter(p => {
      if (p.status === 'inactive') return false;
      // Search across the fields people actually type: name, brand, sku,
      // category/subcategory and colour, not just name+brand.
      const matchSearch = !term || [
        p.name, p.brand, p.sku, p.category, p.subcategory, p.colorName,
      ].some((f) => f && String(f).toLowerCase().includes(term));
      const matchDept = !deptCategories || deptCategories.includes(p.category);
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchDept && matchCategory;
    });
    return sortProducts(hits, sortBy);
  }, [products, searchTerm, deptCategories, selectedCategory, sortBy]);

  // Build a flat, self-contained cart item from a product so it renders on
  // /carts without re-fetching the product catalog.
  const productSku = (product) => product.sku || `sku-${product.id}`;
  // Catalog products carry `listPrice`; admin/cart shapes use `price`. Reading
  // only `price` here silently dropped the list price on every single item.
  const snapshotProduct = (product, qty) => ({
    id: product.id,
    sku: productSku(product),
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.listPrice ?? product.price ?? null,
    unit: product.unit,
    qty,
    image: product.image,
    // Colour is part of the order, so it belongs in the snapshot. In this
    // catalog a colour IS a SKU (see `parentSku`), so `colorName` identifies
    // exactly what was ordered; the hex rides along for rendering a chip.
    colorName: product.colorName,
    colorHex: (product.colorSwatches || [])[0] || null,
    sfPerBox: product.sfPerBox,
  });

  const addToQuote = (product, qty = 1) => {
    addToGuestCart(snapshotProduct(product, qty));
    setShowCart(true);
  };

  const addSampleToQuote = (product) => {
    const sku = `sample-${productSku(product)}`;
    // One sample per product, so bail if it's already in the cart.
    if (getGuestCart().items.some((i) => i.sku === sku)) {
      setShowCart(true);
      return;
    }
    addToGuestCart({
      id: `sample-${product.id}`,
      sku,
      name: `${product.name} (sample)`,
      brand: product.brand,
      category: product.category,
      price: 0,
      qty: 1,
      isSample: true,
      image: product.image,
      colorName: product.colorName,
      colorHex: (product.colorSwatches || [])[0] || null,
    });
    setShowCart(true);
  };

  const updateQty = (itemSku, delta) => {
    const item = getGuestCart().items.find((i) => i.sku === itemSku);
    if (!item) return;
    updateGuestCartQty(itemSku, Math.max(1, (item.qty || 1) + delta));
  };

  const removeFromCart = (itemSku) => {
    removeFromGuestCart(itemSku);
  };

  const toggleSaved = (productId) => {
    setSavedProducts(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const goToQuotePage = () => {
    setShowCart(false);
    navigate('/cart');
  };

  /**
   * Member quote submit.
   *
   * This used to flip a local flag and clear the cart. The "your account
   * manager will review your cart" confirmation was a lie, and `quoteNotes`
   * went in the bin. It now writes a real quote record into the user's
   * `orders` blob (the same collection Estimates & Orders reads), carrying the
   * notes and the full item snapshot, and only clears the cart once the write
   * has actually landed.
   *
   * The record is read back before writing because three pages write this
   * blob; `user-data` replaces it wholesale.
   */
  const submitQuote = async () => {
    // Guests go through the wizard: project type, zip, timing, OTP. The
    // wizard creates their account + project and clears the cart on success.
    if (!userId) {
      setWizardIntent('quote');
      setQuoteWizardOpen(true);
      return;
    }
    if (submitting || quoteCart.length === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const now = Date.now();
      const quoteId = `Q${String(now).slice(-8)}`;
      // A quote has no invoice yet; the AM sets pricing. Everything money-ish
      // stays null rather than being faked as 0, which would render as "$0.00".
      const quote = {
        id: quoteId,
        kind: 'quote',
        projectId: null,
        jobName: `Cart quote · ${quoteCart.length} item${quoteCart.length !== 1 ? 's' : ''}`,
        orderDate: new Date(now).toLocaleDateString('en-US'),
        submittedAt: now,
        // 'ready' is the customer-facing "quote" state in order-status.js; a
        // freshly submitted request isn't ready to approve yet, so it gets the
        // pre-state the taxonomy calls "In progress".
        status: 'requested',
        statusText: 'Quote Requested',
        soldTo: (userName || 'You').toUpperCase(),
        showroom: showroom?.name || null,
        accountManager: accountManager?.name || null,
        notes: quoteNotes.trim() || null,
        invoiceTotal: null,
        material: null,
        salesTax: null,
        service: null,
        totalPaid: null,
        balanceDue: null,
        // Full snapshot: what was actually in the cart at submit time, prices
        // and colours included. The cart gets cleared, so this is the record.
        items: quoteCart.map((i) => ({ ...i })),
        listSubtotal: quoteCart.reduce(
          (sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0
        ),
      };
      const stored = await loadUserData('orders', null);
      const list = Array.isArray(stored?.list) ? stored.list : [];
      await saveUserData('orders', { ...(stored || {}), list: [quote, ...list] });
      setSubmittedQuoteId(quoteId);
      setCartSubmitted(true);
      setQuoteNotes('');
      clearGuestCart();
    } catch (err) {
      console.warn('Quote submit failed:', err.message);
      setSubmitError("Couldn't send your quote request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Snapshot the active cart into the saved-carts library. The store helper
   * existed but nothing imported it, so there was no way to save a cart at all.
   */
  const [savingCart, setSavingCart] = useState(false);
  const [savedCartMsg, setSavedCartMsg] = useState('');
  const saveCartForLater = async () => {
    if (!userId || savingCart || quoteCart.length === 0) return;
    setSavingCart(true);
    try {
      const saved = await saveActiveAsNewCart({
        userId, userName, loadUserData, saveUserData,
      });
      setSavedCartMsg(saved ? `Saved as "${saved.name}"` : '');
      setTimeout(() => setSavedCartMsg(''), 4000);
    } catch (err) {
      console.warn('Save cart failed:', err.message);
      setSavedCartMsg('Could not save this cart.');
      setTimeout(() => setSavedCartMsg(''), 4000);
    } finally {
      setSavingCart(false);
    }
  };

  /**
   * What a quantity actually means for a product.
   *
   * The PDP used to assume every product was boxed: the SF→box conversion only
   * fired when `sfPerBox` existed, so a slab countertop priced per SF showed an
   * "Enter Total Square Feet" box that did nothing to the qty. Three real cases:
   *   boxed: unit SF *and* sfPerBox, so qty is boxes and SF drives the count
   *   area:  unit SF, no sfPerBox, so qty *is* the SF, entered directly
   *   each:  unit EA/BOX, so qty is a plain count with no SF input
   */
  const qtyMode = (product) => {
    if (product.unit === 'SF') return product.sfPerBox ? 'boxed' : 'area';
    return 'each';
  };

  const qtyLabel = (product) => {
    const mode = qtyMode(product);
    if (mode === 'boxed') return 'Boxes';
    if (mode === 'area') return 'Square feet';
    return product.unit === 'BOX' ? 'Boxes' : 'Quantity';
  };

  /** Sub-caption under a cart line's stepper: the real-world amount. */
  const qtyCaption = (item) => {
    if (item.sfPerBox) return `${(item.sfPerBox * (item.qty || 1)).toFixed(2)} SF`;
    if (item.unit === 'SF') return `${item.qty || 1} SF`;
    return `${item.qty || 1} ${item.unit === 'BOX' ? 'boxes' : 'ea'}`;
  };

  /** Canonical PDP link for a cart line, resolved through the catalog. */
  const pdpHref = (item) => {
    const product = resolveProduct(item.sku || item.id, products, item);
    return product ? `/shop/${encodeURIComponent(product.sku)}` : null;
  };

  // Guest version of "Save to a project". Same wizard, no quote signal.
  const guestSaveToProject = () => {
    setWizardIntent('save');
    setQuoteWizardOpen(true);
  };

  // Save-to-project: members can append the active cart to one of their
  // existing projects. Lazy-loaded so guests don't pay the network call.
  const [projectsForSave, setProjectsForSave] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [saveProjectOpen, setSaveProjectOpen] = useState(false);
  const [addToProjectOpen, setAddToProjectOpen] = useState(false);
  // Save-to-project is two-stage: pick a project, then pick a room inside it.
  const [pickerProject, setPickerProject] = useState(null);
  const [savingToProjectId, setSavingToProjectId] = useState(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!userId || projectsLoaded) return;
    let cancelled = false;
    loadUserData('projects', null).then((stored) => {
      if (cancelled) return;
      // normalizeStored migrates legacy string rooms so the room picker below
      // always sees real room objects.
      const list = normalizeStored(stored);
      // Only show non-archived working projects in the picker.
      setProjectsForSave(list.filter((p) => !p.archived));
      setProjectsLoaded(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const closePickers = () => {
    setSaveProjectOpen(false);
    setAddToProjectOpen(false);
    setPickerProject(null);
  };

  /**
   * Append items to a project, optionally pinned to one of its rooms.
   * Re-reads the collection right before writing (three pages write this blob)
   * and keeps the FULL item snapshot: image, colorName, sfPerBox and all.
   */
  const saveItemsToProject = async (project, roomId, items, { clearCart = false } = {}) => {
    if (!userId || !project || !items || items.length === 0) return;
    setSavingToProjectId(project.id);
    setSaveError('');
    try {
      const stored = await loadUserData('projects', null);
      const list = normalizeStored(stored);
      const next = list.map((p) =>
        p.id !== project.id
          ? p
          : {
              ...p,
              // Re-key this project's existing products onto canonical SKUs
              // before merging. Products saved before the catalog had SKUs hold
              // the synthesized `sku-prod-001`; without this, adding the same
              // product again would append a second line instead of bumping
              // the qty on the one that's already there.
              products: mergeCartItemsIntoProducts(
                migrateItemKeys(p.products, products).items,
                migrateItemKeys(items, products).items,
                roomId
              ),
              updatedAt: Date.now(),
            }
      );
      await saveUserData('projects', { list: next });
      if (clearCart) clearGuestCart();
      navigate(`/projects/${project.id}?tab=products`);
    } catch (err) {
      console.warn('Save to project failed:', err.message);
      setSaveError('Could not save to project.');
      setTimeout(() => setSaveError(''), 2500);
    } finally {
      setSavingToProjectId(null);
      closePickers();
    }
  };

  const saveCartToProject = (project, roomId) =>
    saveItemsToProject(project, roomId, quoteCart, { clearCart: true });

  // "Add To Project" on the product detail page: this one product, at the
  // quantity currently in the stepper.
  const addProductToProject = (project, roomId) => {
    if (!selectedProduct) return;
    return saveItemsToProject(project, roomId, [snapshotProduct(selectedProduct, boxQty)]);
  };

  const totalItems = quoteCart.reduce((sum, item) => sum + (item.qty || 1), 0);

  const s = {
    wrapper: { background: '#fafafa', minHeight: '100vh', fontFamily: "'Open Sans', -apple-system, sans-serif" },
    container: { maxWidth: 1140, margin: '0 auto', padding: '0 16px' },
    // Breadcrumb
    breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', fontSize: 13, color: colors.gray500 },
    breadcrumbLink: { color: colors.darkBlue, textDecoration: 'none', fontWeight: 500, cursor: 'pointer' },
    // Search bar
    searchBar: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: `1px solid ${colors.gray200}`,
      flexWrap: 'wrap',
    },
    searchInput: {
      flex: 1, padding: '10px 14px 10px 40px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
      fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', position: 'relative',
    },
    // Category tabs
    categoryTabs: { display: 'flex', gap: 4, padding: '16px 0', flexWrap: 'wrap' },
    categoryTab: (isActive) => ({
      padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: isActive ? 600 : 400,
      border: `1px solid ${isActive ? colors.darkBlue : colors.gray200}`,
      background: isActive ? colors.darkBlue : '#fff', color: isActive ? '#fff' : colors.gray700,
      cursor: 'pointer', transition: 'all 0.15s',
    }),
    // Product grid (responsive handled via Tailwind className below)
    productGrid: { padding: '24px 0 48px' },
    productCard: {
      background: '#fff', borderRadius: 10, border: `1px solid ${colors.gray200}`, overflow: 'hidden',
      cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
    },
    productCardHover: { boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' },
    productImage: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: colors.gray100 },
    productInfo: { padding: '16px' },
    productBrand: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: colors.gray500, marginBottom: 4 },
    productName: { fontSize: 14, fontWeight: 600, color: colors.gray900, lineHeight: 1.4, marginBottom: 4 },
    productColor: { fontSize: 12, color: colors.gray500, marginBottom: 8 },
    productPriceRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
    productPrice: { fontSize: 18, fontWeight: 700, color: colors.gray900 },
    productUnit: { fontSize: 12, color: colors.gray500 },
    productBadge: (type) => ({
      position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: type === 'Best Seller' ? '#fef3c7' : type === 'New' ? '#dbeafe' : '#e8f5e9',
      color: type === 'Best Seller' ? '#92400e' : type === 'New' ? colors.darkBlue : colors.green,
    }),
    heartBtn: {
      position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%',
      background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    // Product detail (responsive handled via Tailwind className below)
    detailLayout: { padding: '24px 0 48px' },
    detailImage: { width: '100%', borderRadius: 8, background: colors.gray100, aspectRatio: '1', objectFit: 'cover' },
    detailBrand: { fontSize: 12, color: colors.gray500, marginBottom: 4 },
    detailName: { fontSize: 22, fontWeight: 700, color: colors.darkBlue, lineHeight: 1.3, marginBottom: 4 },
    detailColorName: { fontSize: 14, color: colors.gray500, marginBottom: 4 },
    detailPriceLabel: { fontSize: 12, color: colors.gray500, marginBottom: 2 },
    detailPrice: { fontSize: 32, fontWeight: 700, color: colors.gray900, marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 4 },
    detailStrike: { textDecoration: 'line-through', color: colors.gray400 },
    detailUnit: { fontSize: 14, fontWeight: 400, color: colors.gray500 },
    // Swatches
    swatchRow: { display: 'flex', gap: 8, marginBottom: 20 },
    swatch: (color, isActive) => ({
      width: 32, height: 32, borderRadius: 4, background: color, cursor: 'pointer',
      border: isActive ? `2px solid ${colors.darkBlue}` : `1px solid ${colors.gray300}`,
      outline: isActive ? `2px solid ${colors.lightBlue}` : 'none', outlineOffset: 1,
    }),
    // Size selector
    sizeBox: {
      border: `1.5px solid ${colors.gray200}`, borderRadius: 6, padding: '12px 16px', marginBottom: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    sizeLabel: { fontSize: 11, color: colors.gray500, fontWeight: 500, marginBottom: 2 },
    sizeValue: { fontSize: 14, color: colors.gray900, fontWeight: 500 },
    // Project + room picker (shared by the cart page and the PDP)
    pickerPanel: {
      position: 'absolute', marginTop: 6, minWidth: 260, maxHeight: 280, overflow: 'auto',
      background: '#fff', border: `1px solid ${colors.gray200}`, borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 50, textAlign: 'left',
    },
    pickerHeader: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
      fontSize: 11, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase',
      letterSpacing: 0.5, borderBottom: `1px solid ${colors.gray100}`,
    },
    pickerBack: {
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      display: 'flex', alignItems: 'center', color: colors.darkBlue,
    },
    pickerItem: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
      background: 'transparent', cursor: 'pointer', fontSize: 14, color: colors.gray900,
      fontFamily: 'inherit',
    },
    // Add to project / quote
    addToProjectBtn: {
      width: '100%', padding: '14px', borderRadius: 6, border: `1.5px solid ${colors.gray200}`,
      background: '#fff', fontSize: 14, fontWeight: 500, color: colors.gray700, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
      fontFamily: 'inherit',
    },
    addToQuoteBtn: {
      width: '100%', padding: '14px', borderRadius: 6, border: 'none',
      background: colors.darkBlue, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
      fontFamily: 'inherit',
    },
    // Spec table
    specTabs: { display: 'flex', gap: 24, borderBottom: `2px solid ${colors.gray200}`, marginBottom: 20 },
    specTab: (isActive) => ({
      padding: '12px 0', fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? colors.darkBlue : colors.gray500,
      cursor: 'pointer', borderBottom: isActive ? `2px solid ${colors.darkBlue}` : '2px solid transparent',
      marginBottom: -2, background: 'none', border: 'none', fontFamily: 'inherit',
    }),
    specTable: { width: '100%', borderCollapse: 'collapse' },
    specRow: (i) => ({ background: i % 2 === 0 ? colors.gray100 : '#fff' }),
    specKey: { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: colors.gray700, textAlign: 'left', width: '45%' },
    specVal: { padding: '10px 16px', fontSize: 13, color: colors.gray900, textAlign: 'right' },
    // Quote cart
    cartOverlay: {
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 400, background: '#fff',
      boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', flexDirection: 'column',
    },
    cartBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 },
    cartHeader: {
      padding: '20px 24px', borderBottom: `1px solid ${colors.gray200}`, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
    },
    cartTitle: { fontSize: 18, fontWeight: 600, color: colors.gray900 },
    cartBody: { flex: 1, overflow: 'auto', padding: 24 },
    cartItem: {
      display: 'flex', gap: 12, padding: '16px 0', borderBottom: `1px solid ${colors.gray100}`,
    },
    cartItemImage: { width: 64, height: 64, borderRadius: 6, objectFit: 'cover', background: colors.gray100 },
    cartItemName: { fontSize: 13, fontWeight: 600, color: colors.gray900, marginBottom: 2 },
    cartItemPrice: { fontSize: 12, color: colors.gray500 },
    cartQtyRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
    cartQtyBtn: {
      width: 24, height: 24, borderRadius: 4, border: `1px solid ${colors.gray300}`,
      background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0,
    },
    cartQty: { fontSize: 13, fontWeight: 600, color: colors.gray900, minWidth: 24, textAlign: 'center' },
    cartFooter: { padding: 24, borderTop: `1px solid ${colors.gray200}` },
    cartBadge: {
      position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
      background: colors.red, color: '#fff', fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    // Price protection badge
    priceProtection: {
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.darkBlue,
      fontWeight: 500, marginBottom: 16,
    },
    // Showroom info
    showroomInfo: {
      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.gray500, marginBottom: 20,
    },
  };

  // ========== QUOTE REQUEST PAGE ==========
  if (viewQuotePage) {
    const qInput = {
      width: '100%', padding: '11px 14px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
      fontSize: 14, fontFamily: 'inherit', color: colors.gray900, background: '#fff', outline: 'none',
      boxSizing: 'border-box',
    };

    if (cartSubmitted) {
      return (
        <div style={s.wrapper}>
          <div style={s.container}>
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: '#e8f5e9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <Check size={36} color={colors.green} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: colors.gray900, marginBottom: 8 }}>
                Quote request sent
              </div>
              {submittedQuoteId && (
                <div style={{ fontSize: 13, color: colors.gray500, marginBottom: 12 }}>
                  Reference <strong style={{ color: colors.gray900 }}>{submittedQuoteId}</strong>
                </div>
              )}
              <div style={{ fontSize: 15, color: colors.gray500, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 28px' }}>
                {userId ? (
                  <>
                    Your request is saved to your account and waiting on{' '}
                    {accountManager?.name ? (
                      <>your account manager <strong style={{ color: colors.gray900 }}>{accountManager.name}</strong></>
                    ) : (
                      <>your account manager</>
                    )}
                    , who reviews it with member pricing and a pickup time. You can see it any
                    time under Estimates &amp; Orders.
                  </>
                ) : (
                  <>We'll match you to the nearest ProSource showroom and an account manager will reach out within 1 business day with pricing and a pickup time.</>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  style={{ ...s.addToQuoteBtn, width: 'auto', padding: '12px 24px' }}
                  onClick={() => { setCartSubmitted(false); setSubmittedQuoteId(null); navigate('/shop'); }}
                >
                  Continue Shopping
                </button>
                {userId && (
                  <Link to="/orders" style={{
                    padding: '12px 24px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
                    fontSize: 14, fontWeight: 500, color: colors.gray700, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
                  }}>
                    View in Estimates &amp; Orders
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={s.wrapper}>
        <div style={s.container}>
          {/* Header */}
          <div style={{ padding: '24px 0 20px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: colors.gray900 }}>My Cart</div>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto" style={{ background: '#fff', borderRadius: 10, border: `1px solid ${colors.gray200}`, marginBottom: 32 }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 200px 160px 100px',
              padding: '14px 24px', borderBottom: `1px solid ${colors.gray200}`, background: colors.gray50,
              minWidth: 720,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Product</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Availability</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Quantity</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Total</div>
            </div>

            {/* Cart items */}
            {quoteCart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: colors.gray400 }}>
                <ShoppingCart size={32} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14 }}>Your cart is empty</div>
                <button
                  onClick={() => navigate('/shop')}
                  style={{ ...s.addToQuoteBtn, width: 'auto', padding: '10px 20px', marginTop: 16, display: 'inline-flex' }}
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                {quoteCart.map(item => (
                  <div key={item.sku || item.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 200px 160px 100px',
                    padding: '20px 24px', borderBottom: `1px solid ${colors.gray100}`, alignItems: 'center',
                    minWidth: 720,
                  }}>
                    {/* Product */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      {item.image ? (
                        <img src={item.image} alt="" style={{ width: 72, height: 72, borderRadius: 6, objectFit: 'cover', background: colors.gray100 }} />
                      ) : (
                        <div style={{ width: 72, height: 72, borderRadius: 6, background: colors.gray100 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, lineHeight: 1.4, marginBottom: 2 }}>
                          {item.isSample ? '🔲 SAMPLE · ' : ''}
                          {/* Names link to the product they came from. Falls back
                              to plain text for a line the catalog no longer has. */}
                          {pdpHref(item) ? (
                            <Link to={pdpHref(item)} style={{ color: colors.gray900, textDecoration: 'none' }}
                              onMouseOver={(e) => e.currentTarget.style.color = colors.darkBlue}
                              onMouseOut={(e) => e.currentTarget.style.color = colors.gray900}
                            >{item.name}</Link>
                          ) : item.name}
                        </div>
                        <div style={{ fontSize: 12, color: colors.gray500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.colorHex && (
                            <span style={{
                              width: 10, height: 10, borderRadius: 2, background: item.colorHex,
                              border: `1px solid ${colors.gray300}`, display: 'inline-block',
                            }} />
                          )}
                          <span>
                            {item.colorName}
                            {item.isSample ? ' · Sample' : item.sfPerBox ? ` (${item.sfPerBox} SF/Box)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Availability removed: it was placeholder shipping data. The
                        real fulfillment timeline gets set by the AM during quote. */}
                    <div />


                    {/* Quantity. Samples are one-per-product; the drawer always
                        knew that, but this table used to offer a stepper that let
                        you "order" 4 of the same free sample. */}
                    <div style={{ textAlign: 'center' }}>
                      {item.isSample ? (
                        <div style={{ fontSize: 13, color: colors.gray500 }}>Qty 1</div>
                      ) : (
                        <>
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.gray200}`, borderRadius: 6, overflow: 'hidden' }}>
                            <button
                              onClick={() => updateQty(item.sku || item.id, -1)}
                              style={{ width: 32, height: 36, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${colors.gray200}` }}
                            >
                              <Minus size={14} color={colors.gray500} />
                            </button>
                            <span style={{ width: 40, fontSize: 14, fontWeight: 600, color: colors.gray900, textAlign: 'center' }}>{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.sku || item.id, 1)}
                              style={{ width: 32, height: 36, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${colors.gray200}` }}
                            >
                              <Plus size={14} color={colors.gray500} />
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: colors.gray500, marginTop: 4 }}>
                            {qtyCaption(item)}
                          </div>
                        </>
                      )}
                      <button
                        onClick={() => removeFromCart(item.sku || item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 4 }}
                      >
                        <Trash2 size={14} color={colors.gray400} />
                      </button>
                    </div>

                    {/* Total */}
                    <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: colors.gray700 }}>
                      To be quoted
                    </div>
                  </div>
                ))}

                {/* Subtotal */}
                <div style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: colors.gray900 }}>
                    Subtotal: To be quoted
                  </span>
                </div>
              </>
            )}
          </div>

          {quoteCart.length > 0 && (
            <>
              {/* Quote details. Members: optional notes + direct submit.
                  Guests: short CTA that opens the QuoteWizard (project type,
                  zip, timing, contact, OTP) so we collect enough to spin up
                  a project + account on submit. */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${colors.gray200}`, padding: 28, marginBottom: 24 }}>
                {userId ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, color: colors.gray900, marginBottom: 8 }}>
                      Notes for your account manager <span style={{ fontSize: 13, fontWeight: 400, color: colors.gray500 }}>(optional)</span>
                    </div>
                    <textarea
                      style={{ ...qInput, minHeight: 90, resize: 'vertical', marginBottom: 20 }}
                      placeholder="Project details, timing, anything else we should know…"
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                    />
                    <button
                      onClick={submitQuote}
                      disabled={submitting}
                      style={{
                        width: '100%', padding: '14px 24px',
                        background: submitting ? colors.gray400 : colors.darkBlue, color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700,
                        cursor: submitting ? 'default' : 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {submitting ? (
                        <>Sending…</>
                      ) : (
                        <>Send to my account manager <ChevronRight size={18} /></>
                      )}
                    </button>
                    {submitError && (
                      <div style={{
                        fontSize: 13, color: colors.red, marginTop: 10, textAlign: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <AlertTriangle size={14} /> {submitError}
                      </div>
                    )}
                    {/* Two ways to not-commit-yet: park the cart in the saved
                        library, or file it against a project. The library one
                        had no entry point anywhere in the app until now. */}
                    <div style={{
                      display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14,
                      flexWrap: 'wrap', alignItems: 'center',
                    }}>
                      <button
                        onClick={saveCartForLater}
                        disabled={savingCart}
                        style={{
                          background: 'none', border: 'none',
                          cursor: savingCart ? 'default' : 'pointer',
                          color: colors.darkBlue, fontSize: 13, fontWeight: 500,
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Save size={14} /> {savingCart ? 'Saving…' : 'Save this cart for later'}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => {
                            setPickerProject(null);
                            setSaveProjectOpen((v) => !v);
                          }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: colors.darkBlue, fontSize: 13, fontWeight: 500,
                            fontFamily: 'inherit',
                          }}
                        >
                          Save to a project instead
                        </button>
                        {saveProjectOpen && renderProjectRoomPicker(saveCartToProject, {
                          top: '100%', left: '50%', transform: 'translateX(-50%)',
                        })}
                      </div>
                    </div>
                    {savedCartMsg && (
                      <div style={{ fontSize: 12, color: colors.green, marginTop: 8, textAlign: 'center' }}>
                        {savedCartMsg} · <Link to="/carts" style={{ color: colors.darkBlue }}>View saved carts</Link>
                      </div>
                    )}
                    {saveError && (
                      <div style={{ fontSize: 12, color: colors.red, marginTop: 6, textAlign: 'center' }}>{saveError}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, color: colors.gray900, marginBottom: 8 }}>
                      Ready for member pricing?
                    </div>
                    <div style={{ fontSize: 14, color: colors.gray500, lineHeight: 1.5, marginBottom: 20 }}>
                      A few quick questions about your project (about 90 seconds) so we can match you to the right showroom and account manager. We'll create your member account at the same time.
                    </div>
                    <button
                      onClick={submitQuote}
                      style={{
                        width: '100%', padding: '14px 24px', background: colors.darkBlue, color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      Get a Quote <ChevronRight size={18} />
                    </button>
                    <div style={{ fontSize: 12, color: colors.gray500, marginTop: 12, textAlign: 'center' }}>
                      No payment, no obligation.
                    </div>
                    {/* Soft path: same wizard, but the backend doesn't send
                        a hot-quote signal to the AM. They still get a real
                        project + account + assigned showroom. */}
                    <div style={{ textAlign: 'center', marginTop: 14 }}>
                      <button
                        onClick={guestSaveToProject}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.darkBlue, fontSize: 13, fontWeight: 500,
                          fontFamily: 'inherit',
                        }}
                      >
                        Not ready? Save to a project instead
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Back link */}
              <div style={{ textAlign: 'center', paddingBottom: 48 }}>
                <button
                  onClick={() => navigate('/shop')}
                  style={{ background: 'none', border: 'none', color: colors.darkBlue, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ← Continue Shopping
                </button>
              </div>
            </>
          )}
        </div>

        <QuoteWizard
          isOpen={quoteWizardOpen}
          onClose={() => setQuoteWizardOpen(false)}
          cartItems={quoteCart}
          intent={wizardIntent}
        />
      </div>
    );
  }

  // ========== PRODUCT NOT FOUND ==========
  // An unknown sku used to fall through and silently render the whole catalog,
  // so a dead link looked like a working shop page.
  if (productNotFound) {
    return (
      <div style={s.wrapper}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: colors.gray100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <Package size={30} color={colors.gray400} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.gray900, marginBottom: 8 }}>
              We couldn't find that product
            </div>
            <div style={{ fontSize: 14, color: colors.gray500, lineHeight: 1.7, maxWidth: 460, margin: '0 auto 24px' }}>
              <code style={{ background: colors.gray100, padding: '2px 6px', borderRadius: 4 }}>
                {routeSku || legacyProductId}
              </code>{' '}
              isn't in the catalog. It may have been discontinued or re-numbered.
              {catalogSource === 'fallback' && (
                <> We're also showing a cached catalog right now, so it may just be temporarily missing.</>
              )}
            </div>
            <button
              onClick={() => navigate('/shop')}
              style={{ ...s.addToQuoteBtn, width: 'auto', padding: '12px 24px', display: 'inline-flex' }}
            >
              Browse all products
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== PRODUCT DETAIL VIEW ==========
  if (selectedProduct) {
    const p = selectedProduct;
    const specEntries = Object.entries(p.specs);
    const halfSpecs = Math.ceil(specEntries.length / 2);
    const mode = qtyMode(p);
    // Colour variants are sibling SKUs (`parentSku`). When the catalog has
    // them the swatches are real navigation; when it doesn't, they're a
    // read-only palette. See the swatch block below.
    const variants = colorVariants(p, products);
    // Tabs only exist when there's real content behind them. Warranty and
    // Overview used to render the same hardcoded blurb for every product.
    const tabs = [
      { id: 'specifications', label: 'Specifications', has: specEntries.length > 0 },
      { id: 'warranty', label: 'Warranty', has: !!(p.warranty || p.specs.Warranty) },
      { id: 'overview', label: 'Overview', has: !!(p.description || p.overview) },
    ].filter((t) => t.has);
    const tabId = tabs.some((t) => t.id === activeSpecTab) ? activeSpecTab : tabs[0]?.id;

    return (
      <div style={s.wrapper}>
        <div style={s.container}>
          {/* Breadcrumb */}
          <div style={s.breadcrumb}>
            <span style={s.breadcrumbLink} onClick={() => navigate('/shop')}>
              <Home size={14} style={{ marginBottom: -2 }} />
            </span>
            <ChevronRight size={12} />
            <span style={s.breadcrumbLink} onClick={() => { setSelectedCategory(p.category); navigate('/shop'); }}>{p.category}</span>
            <ChevronRight size={12} />
            <span style={{ color: colors.gray700 }}>{p.name}</span>
          </div>

          {/* Showroom + Price Protection row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={s.showroomInfo}>
              <Info size={12} />
              Independently Owned Showrooms
            </div>
            {p.badge === 'ProSource Price Protection' && (
              <div style={s.priceProtection}>
                ProSource Price Protection <Info size={14} />
              </div>
            )}
          </div>

          {/* Detail layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10" style={s.detailLayout}>
            {/* Left - Image. The caption promised zoom and nothing zoomed;
                now it's a real magnifier: hover scales the image around the
                cursor via background-position. */}
            <div>
              <div
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({
                    on: true,
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                }}
                onMouseLeave={() => setZoom({ on: false, x: 50, y: 50 })}
                style={{
                  ...s.detailImage,
                  backgroundImage: `url(${p.image})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: zoom.on ? '220%' : 'cover',
                  backgroundPosition: zoom.on ? `${zoom.x}% ${zoom.y}%` : 'center',
                  cursor: p.image ? 'zoom-in' : 'default',
                  transition: 'background-size 0.15s ease',
                }}
                role="img"
                aria-label={p.name}
              />
              <div style={{ textAlign: 'center', fontSize: 12, color: colors.gray400, marginTop: 8 }}>
                Hover over image to zoom
              </div>
            </div>

            {/* Right - Info */}
            <div>
              <div style={s.detailName}>{p.name}</div>
              <div style={s.detailColorName}>
                {p.colorName}
                {p.colorsAvailable > 1 ? ` · ${p.colorsAvailable} colors available` : ''}
              </div>

              <div style={s.detailPriceLabel}>List Price</div>
              <div style={s.detailPrice}>
                {p.listPrice != null ? (
                  <>US$ {p.listPrice.toFixed(2)} <span style={s.detailUnit}>/{p.unit}</span></>
                ) : (
                  <span style={{ fontSize: 22, color: colors.gray500 }}>Call for pricing</span>
                )}
              </div>

              {/* Colour.
                  In this catalog a colour IS a SKU. That's what `parentSku` is
                  for. So when the catalog gives us sibling SKUs, each swatch is
                  a real link to that colour's own page, and the colour you
                  ordered is recorded because the SKU records it.
                  When it doesn't (every product below is its own family), the
                  swatches are NOT options: there are no SKUs behind them and
                  no names for them. They used to be clickable and moved a
                  border and nothing else, which is exactly the kind of control
                  that lies. They're now a read-only palette. */}
              <div style={{ fontSize: 13, color: colors.gray700, marginBottom: 8 }}>
                Color: <strong>{p.colorName}</strong>
              </div>
              {variants.length > 1 ? (
                <div style={s.swatchRow}>
                  {variants.map((v) => (
                    <Link
                      key={v.sku}
                      to={`/shop/${encodeURIComponent(v.sku)}`}
                      title={v.colorName}
                      aria-label={v.colorName}
                      style={s.swatch((v.colorSwatches || [])[0] || colors.gray200, v.sku === p.sku)}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ ...s.swatchRow, marginBottom: 6 }}>
                    {p.colorSwatches.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          ...s.swatch(c, false),
                          cursor: 'default',
                          ...(i === 0 ? { border: `2px solid ${colors.darkBlue}` } : {}),
                        }}
                        title={i === 0 ? p.colorName : undefined}
                      />
                    ))}
                  </div>
                  {p.colorsAvailable > 1 && (
                    <div style={{ fontSize: 12, color: colors.gray500, marginBottom: 20 }}>
                      {p.colorsAvailable} colors in this range. Your account manager can
                      quote any of them, and samples are on hand at the showroom.
                    </div>
                  )}
                </>
              )}

              {/* Size */}
              {p.specs.Size && (
                <div style={s.sizeBox}>
                  <div>
                    <div style={s.sizeLabel}>Size</div>
                    <div style={s.sizeValue}>{p.specs.Size}</div>
                  </div>
                </div>
              )}

              {/* Shipping/Pickup placeholders removed: we don't have real
                  fulfillment data for products yet, and "Request a Quote" is
                  redundant with the primary CTA below. */}

              {/* Quantity.
                  Only boxed products get an SF→box calculator. An SF-priced
                  slab has no boxes, so the SF field IS the quantity; an EA
                  product gets a plain counter and no SF field at all. */}
              <div style={{ marginBottom: 16 }}>
                {mode === 'boxed' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: colors.gray900 }}>Enter Total Square Feet</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="SF needed"
                      value={sfNeeded}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSfNeeded(val);
                        if (val && Number(val) > 0) {
                          setBoxQty(Math.max(1, Math.ceil(Number(val) / p.sfPerBox)));
                        }
                      }}
                      style={{
                        width: 110, padding: '8px 12px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
                        fontSize: 13, fontFamily: 'inherit', textAlign: 'right', outline: 'none',
                      }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: colors.gray500 }}>
                    {mode === 'boxed'
                      ? `${qtyLabel(p)} · 1 box covers ${p.sfPerBox} SF`
                      : qtyLabel(p)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <button
                      onClick={() => { setBoxQty(Math.max(1, boxQty - 1)); setSfNeeded(''); }}
                      style={{
                        width: 36, height: 36, border: `1.5px solid ${colors.gray200}`, borderRight: 'none',
                        borderRadius: '6px 0 0 6px', background: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><Minus size={14} color={colors.gray700} /></button>
                    <div style={{
                      width: 44, height: 36, border: `1.5px solid ${colors.gray200}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600, color: colors.gray900,
                    }}>{boxQty}</div>
                    <button
                      onClick={() => { setBoxQty(boxQty + 1); setSfNeeded(''); }}
                      style={{
                        width: 36, height: 36, border: `1.5px solid ${colors.gray200}`, borderLeft: 'none',
                        borderRadius: '0 6px 6px 0', background: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><Plus size={14} color={colors.gray700} /></button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 14, color: colors.gray700 }}>
                  {mode === 'boxed' && (
                    <div style={{ fontSize: 12, color: colors.gray500, marginBottom: 2 }}>
                      Covers {(p.sfPerBox * boxQty).toFixed(2)} SF
                    </div>
                  )}
                  Total: <strong style={{ color: colors.gray900, fontSize: 15 }}>TO BE QUOTED</strong>
                </div>
              </div>

              {/* Order Sample + Add to Quote buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                <button style={{
                  width: '100%', padding: '14px', borderRadius: 6, border: `2px solid ${colors.darkBlue}`,
                  background: '#fff', fontSize: 13, fontWeight: 600, color: colors.darkBlue, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: 0.5,
                }} onClick={() => addSampleToQuote(p)}>
                  Order Sample
                </button>
                <button style={{
                  width: '100%', padding: '14px', borderRadius: 6, border: 'none',
                  background: colors.darkBlue, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: 0.5,
                }} onClick={() => addToQuote(p, boxQty)}>
                  Add to Quote
                </button>
              </div>

              {/* Add to Project. Members get a project → room picker; guests
                  go through the wizard, which creates the project for them. */}
              <div style={{ position: 'relative' }}>
                <button
                  style={s.addToProjectBtn}
                  onClick={() => {
                    if (!userId) {
                      // No account yet, so carry this product into the wizard,
                      // which creates the account + project on submit.
                      addToGuestCart(snapshotProduct(p, boxQty));
                      guestSaveToProject();
                      return;
                    }
                    setPickerProject(null);
                    setAddToProjectOpen((v) => !v);
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Heart size={16} color={colors.gray500} /> Add To Project
                  </span>
                  <ChevronDown size={16} color={colors.gray500} />
                </button>
                {addToProjectOpen && renderProjectRoomPicker(addProductToProject, {
                  top: '100%', left: 0, right: 0,
                })}
                {saveError && (
                  <div style={{ fontSize: 12, color: colors.red, marginBottom: 8 }}>{saveError}</div>
                )}
              </div>

              {/* "Compare" used to live here: a checkbox wired to nothing, with
                  no compare tray, no compare page, and no second product to
                  compare against. Removed rather than faked: building a real
                  comparison surface is its own piece of work. */}
            </div>
          </div>

          {/* Specifications.
              Warranty and Overview used to render one hardcoded blurb for every
              product: the same "limited lifetime residential warranty" claim on
              a quartz slab as on a carpet tile. A warranty claim we haven't got
              data for is worse than no tab, so each tab now only appears when
              the product record actually carries that content. */}
          {tabs.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${colors.gray200}`, padding: '0 24px 24px', marginBottom: 48 }}>
            {tabs.length > 1 ? (
              <div style={s.specTabs}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    style={s.specTab(tabId === tab.id)}
                    onClick={() => setActiveSpecTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ ...s.specTabs, gap: 0 }}>
                <div style={{ ...s.specTab(true), cursor: 'default' }}>{tabs[0].label}</div>
              </div>
            )}

            {tabId === 'specifications' && (
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 0 }}>
                <table style={s.specTable}>
                  <tbody>
                    {specEntries.slice(0, halfSpecs).map(([key, val], i) => (
                      <tr key={key} style={s.specRow(i)}>
                        <td style={s.specKey}>{key}</td>
                        <td style={s.specVal}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table style={s.specTable}>
                  <tbody>
                    {specEntries.slice(halfSpecs).map(([key, val], i) => (
                      <tr key={key} style={s.specRow(i)}>
                        <td style={s.specKey}>{key}</td>
                        <td style={s.specVal}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tabId === 'warranty' && (
              <div style={{ padding: '20px 0', fontSize: 14, color: colors.gray700, lineHeight: 1.7 }}>
                <p>{p.warranty || p.specs.Warranty}</p>
              </div>
            )}

            {tabId === 'overview' && (
              <div style={{ padding: '20px 0', fontSize: 14, color: colors.gray700, lineHeight: 1.7 }}>
                <p>{p.description || p.overview}</p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* The top-nav cart icon already shows the count and links to /carts,
            so there's no need for a duplicate floating button on this page. */}

        {/* Cart drawer */}
        {showCart && renderCartDrawer()}

        {/* Guests reach this from "Add To Project". The wizard is what turns
            them into a member with a real project. */}
        <QuoteWizard
          isOpen={quoteWizardOpen}
          onClose={() => setQuoteWizardOpen(false)}
          cartItems={quoteCart}
          intent={wizardIntent}
        />
      </div>
    );
  }

  /**
   * Two-stage dropdown: project → room. Rooms are optional, so "Unassigned" is
   * always an offer: a product with no room still lands in the project and
   * shows up in the Unassigned group on the Products tab.
   */
  function renderProjectRoomPicker(onPick, panelStyle) {
    const rooms = pickerProject ? (pickerProject.rooms || []) : [];
    return (
      <div style={{ ...s.pickerPanel, ...panelStyle }}>
        {!pickerProject ? (
          <>
            <div style={s.pickerHeader}>Pick a project</div>
            {projectsForSave.length === 0 ? (
              <button
                style={s.pickerItem}
                onClick={() => navigate('/projects/new')}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: colors.darkBlue, fontWeight: 500 }}>+ Create a project</span>
              </button>
            ) : (
              projectsForSave.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPickerProject(p)}
                  disabled={savingToProjectId === p.id}
                  style={s.pickerItem}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {savingToProjectId === p.id ? 'Saving…' : p.name}
                  </span>
                  <ChevronRight size={14} color={colors.gray400} />
                </button>
              ))
            )}
          </>
        ) : (
          <>
            <div style={s.pickerHeader}>
              <button
                style={s.pickerBack}
                onClick={() => setPickerProject(null)}
                title="Back to projects"
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pickerProject.name} · room
              </span>
            </div>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onPick(pickerProject, room.id)}
                disabled={savingToProjectId === pickerProject.id}
                style={s.pickerItem}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Home size={14} color={colors.darkBlue} /> {room.name}
                </span>
              </button>
            ))}
            <button
              onClick={() => onPick(pickerProject, null)}
              disabled={savingToProjectId === pickerProject.id}
              style={{
                ...s.pickerItem,
                color: colors.gray500,
                borderTop: rooms.length ? `1px solid ${colors.gray100}` : 'none',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {rooms.length ? 'No specific room' : 'Add without a room'}
            </button>
          </>
        )}
      </div>
    );
  }

  // ========== CATALOG LIST VIEW ==========
  function renderCartDrawer() {
    return (
      <>
        <div style={s.cartBackdrop} onClick={() => setShowCart(false)} />
        <div style={s.cartOverlay}>
          <div style={s.cartHeader}>
            <div style={s.cartTitle}>Quote Request ({totalItems})</div>
            <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color={colors.gray500} />
            </button>
          </div>

          <div style={s.cartBody}>
            {cartSubmitted ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#e8f5e9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Check size={28} color={colors.green} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: colors.gray900, marginBottom: 6 }}>Quote Submitted!</div>
                <div style={{ fontSize: 13, color: colors.gray500, lineHeight: 1.6 }}>
                  Your account manager will review and send you a detailed quote with member pricing.
                </div>
              </div>
            ) : quoteCart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: colors.gray400 }}>
                <ShoppingCart size={32} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14 }}>Your quote is empty</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Add products to request pricing</div>
              </div>
            ) : (
              quoteCart.map(item => {
                const key = item.sku || item.id;
                return (
                  <div key={key} style={s.cartItem}>
                    {item.image ? (
                      <img src={item.image} alt="" style={s.cartItemImage} />
                    ) : (
                      <div style={s.cartItemImage} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={s.cartItemName}>
                        {item.isSample && <span style={{ fontSize: 11, fontWeight: 700, color: colors.darkBlue, background: '#e8f0fe', padding: '2px 6px', borderRadius: 3, marginRight: 6 }}>SAMPLE</span>}
                        {pdpHref(item) ? (
                          <Link
                            to={pdpHref(item)}
                            onClick={() => setShowCart(false)}
                            style={{ color: colors.gray900, textDecoration: 'none' }}
                          >{item.name}</Link>
                        ) : item.name}
                      </div>
                      <div style={s.cartItemPrice}>
                        {item.isSample
                          ? 'Product sample'
                          : item.price != null
                            ? `List: $${Number(item.price).toFixed(2)}${item.unit ? `/${item.unit}` : ''}`
                            : 'To be quoted'}
                        {item.colorName ? ` · ${item.colorName}` : ''}
                      </div>
                      {item.isSample ? (
                        <div style={s.cartQtyRow}>
                          <span style={{ fontSize: 12, color: colors.gray500 }}>Qty: 1</span>
                          <button
                            onClick={() => removeFromCart(key)}
                            style={{ ...s.cartQtyBtn, marginLeft: 'auto', borderColor: colors.red, color: colors.red }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div style={s.cartQtyRow}>
                          <button style={s.cartQtyBtn} onClick={() => updateQty(key, -1)}><Minus size={12} /></button>
                          <span style={s.cartQty}>{item.qty}</span>
                          <button style={s.cartQtyBtn} onClick={() => updateQty(key, 1)}><Plus size={12} /></button>
                          <button
                            onClick={() => removeFromCart(key)}
                            style={{ ...s.cartQtyBtn, marginLeft: 'auto', borderColor: colors.red, color: colors.red }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {quoteCart.length > 0 && !cartSubmitted && (
            <div style={s.cartFooter}>
              <div style={{ fontSize: 12, color: colors.gray500, marginBottom: 12, lineHeight: 1.5 }}>
                Your account manager will provide member pricing. List prices shown are for reference only.
              </div>
              <button
                style={{ ...s.addToQuoteBtn, marginBottom: 8 }}
                onClick={goToQuotePage}
              >
                <ShoppingCart size={16} /> Review &amp; Submit Quote
              </button>
              <button
                style={{ ...s.addToProjectBtn, justifyContent: 'center', gap: 8 }}
                onClick={() => setShowCart(false)}
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div style={s.wrapper}>
      <div style={s.container}>
        {activeDept && deptCategories && (
          <div style={{ padding: '20px 0 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.gray900, margin: 0 }}>{activeDept}</h1>
            <button
              onClick={() => setSearchParams({})}
              style={{
                fontSize: 12, color: colors.darkBlue, background: 'none', border: 'none',
                cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit',
              }}
            >Clear filter ×</button>
          </div>
        )}
        {/* Catalog degraded to the bundled copy, so say so rather than quietly
            serving stale data as if it were live. */}
        {catalogSource === 'fallback' && !catalogLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 0',
            padding: '10px 14px', borderRadius: 6, background: '#fef3c7',
            border: '1px solid #fde68a', fontSize: 13, color: '#92400e',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Showing our saved catalog. Live pricing and availability couldn't be reached
              {catalogError ? ` (${catalogError})` : ''}.
            </span>
            <button
              onClick={() => setCatalogReloadKey((k) => k + 1)}
              style={{
                background: 'none', border: '1px solid #d97706', color: '#92400e',
                borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >Retry</button>
          </div>
        )}

        {/* Search */}
        <div style={s.searchBar}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} color={colors.gray400} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              style={s.searchInput}
              placeholder="Search by name, brand, SKU, category, or color…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
            className="shrink-0 min-w-[170px]"
          />
          {/* Cart count lives in the top nav now, so no inline button is needed here. */}
        </div>

        {/* Category tabs */}
        <div style={s.categoryTabs}>
          {categories.map(cat => (
            <button key={cat} style={s.categoryTab(selectedCategory === cat)} onClick={() => setSelectedCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div style={{ fontSize: 13, color: colors.gray500, paddingBottom: 8 }}>
          {catalogLoading
            ? 'Loading catalog…'
            : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
        </div>

        {/* Product grid */}
        {catalogLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={s.productGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ ...s.productCard, cursor: 'default' }}>
                <div style={{ ...s.productImage, background: colors.gray100 }} />
                <div style={s.productInfo}>
                  <div style={{ height: 10, width: '40%', background: colors.gray100, borderRadius: 3, marginBottom: 10 }} />
                  <div style={{ height: 12, width: '90%', background: colors.gray100, borderRadius: 3, marginBottom: 6 }} />
                  <div style={{ height: 12, width: '60%', background: colors.gray100, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 16px', color: colors.gray500 }}>
            <Search size={32} color={colors.gray300} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.gray900, marginBottom: 6 }}>
              No products match
            </div>
            <div style={{ fontSize: 14, marginBottom: 20 }}>
              {searchTerm ? <>Nothing for "{searchTerm}" in this category.</> : 'Try a different category.'}
            </div>
            {(searchTerm || selectedCategory !== 'All' || activeDept) && (
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSearchParams({}); }}
                style={{ ...s.addToQuoteBtn, width: 'auto', padding: '10px 20px', display: 'inline-flex' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={s.productGrid}>
          {filteredProducts.map(product => (
            <div
              key={product.sku}
              style={{
                ...s.productCard,
                ...(hoveredProduct === product.sku ? s.productCardHover : {}),
              }}
              onMouseEnter={() => setHoveredProduct(product.sku)}
              onMouseLeave={() => setHoveredProduct(null)}
              onClick={() => navigate(`/shop/${encodeURIComponent(product.sku)}`)}
            >
              <div style={{ position: 'relative' }}>
                <img src={product.image} alt={product.name} style={s.productImage} />
                {product.badge && <div style={s.productBadge(product.badge)}>{product.badge}</div>}
                <button
                  style={{
                    ...s.heartBtn,
                    color: savedProducts.includes(product.sku) ? colors.red : colors.gray400,
                  }}
                  onClick={(e) => { e.stopPropagation(); toggleSaved(product.sku); }}
                  aria-label="Save product"
                >
                  <Heart size={16} fill={savedProducts.includes(product.sku) ? colors.red : 'none'} />
                </button>
              </div>
              <div style={s.productInfo}>
                <div style={s.productBrand}>{product.brand}</div>
                <div style={s.productName}>{product.name}</div>
                <div style={s.productColor}>
                  {product.colorName}
                  {product.colorsAvailable > 1 ? ` · ${product.colorsAvailable} colors` : ''}
                </div>
                <div style={s.productPriceRow}>
                  <div>
                    {product.listPrice != null ? (
                      <>
                        <span style={s.productPrice}>${product.listPrice.toFixed(2)}</span>
                        <span style={s.productUnit}> / {product.unit}</span>
                      </>
                    ) : (
                      <span style={{ ...s.productPrice, fontSize: 14, color: colors.gray500 }}>Call for pricing</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); addToQuote(product); }}
                    style={{
                      padding: '6px 12px', background: colors.darkBlue, color: '#fff', border: 'none',
                      borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + Quote
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Cart drawer */}
      {showCart && renderCartDrawer()}
    </div>
  );
}
