import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Filter, ChevronRight, ChevronDown, ChevronLeft,
  Heart, ShoppingCart, Star, Info, X, Check, Minus, Plus,
  Grid, List, SlidersHorizontal, Home, Send, MessageCircle,
  Trash2, Truck, MapPin, Package,
} from 'lucide-react';
import {
  getGuestCart, addToGuestCart, removeFromGuestCart, updateGuestCartQty,
  clearGuestCart, subscribeGuestCart,
} from './guest-cart';
import { useAuth } from './auth-context';
import QuoteWizard from './prosource-quote-wizard';
import { normalizeStored, mergeCartItemsIntoProducts } from './project-model';

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

// Demo product catalog
const allProducts = [
  {
    id: 'prod-001',
    name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
    brand: 'Factory Direct',
    colorName: 'Strawthorne Oak',
    colorsAvailable: 6,
    category: 'Hardwood',
    subcategory: 'Engineered Hardwood',
    listPrice: 7.60,
    unit: 'SF',
    sfPerBox: 32.81,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&h=500&fit=crop',
    colorSwatches: ['#8B7355', '#6B4226', '#A0855B', '#D2B48C', '#C4A882', '#5C4033'],
    specs: {
      'Application': 'Commercial, Residential',
      'Length': 'Random',
      'Width': '6.384 Inches',
      'Construction': 'Engineered',
      'Country Of Origin': 'US',
      'Finish': 'UV-Cured Aluminum Oxide',
      'Grade Level': 'On,Above,Below Grade',
      'Installation': 'Floating, Glue, Nail, Staple',
      'Is ADA Compliant': 'No',
      'Is Recommended Outdoors': 'No',
      'Shade Variation': 'V3 - High Variation',
      'Appearance': 'Wire Brushed',
      'Edge Profile': 'Micro Bevel',
      'End Profile': 'Micro Bevel',
      'Gloss Level': 'Low',
      'Style': 'Plank',
      'Type': 'Pre-Finished',
      'Wood Type': 'Oak',
      'Thickness': '0.375 Inches',
      'Size': '6-3/8"',
    },
    badge: 'ProSource Price Protection',
  },
  {
    id: 'prod-002',
    name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
    brand: 'COREtec',
    colorName: 'Pembroke Pine',
    colorsAvailable: 8,
    category: 'LVP / LVT',
    subcategory: 'Luxury Vinyl Plank',
    listPrice: 4.99,
    unit: 'SF',
    sfPerBox: 36.64,
    image: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=500&h=500&fit=crop',
    colorSwatches: ['#C4A882', '#8B7355', '#A0855B', '#D2C4B0', '#6B4226', '#B8A590', '#7A6652', '#E8DDD0'],
    specs: {
      'Application': 'Commercial, Residential',
      'Width': '7 Inches',
      'Length': '48 Inches',
      'Thickness': '6.5mm',
      'Wear Layer': '20mil',
      'Construction': 'Rigid Core',
      'Installation': 'Floating',
      'Attached Pad': 'Yes - Cork',
      'Waterproof': 'Yes',
    },
    badge: 'Best Seller',
  },
  {
    id: 'prod-003',
    name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
    brand: 'Daltile',
    colorName: 'Brilliant White',
    colorsAvailable: 4,
    category: 'Tile & Stone',
    subcategory: 'Porcelain Tile',
    listPrice: 6.49,
    unit: 'SF',
    sfPerBox: 15.6,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F5F5', '#E0D5C7', '#C4B8A8', '#8A8279'],
    specs: {
      'Application': 'Commercial, Residential',
      'Size': '12x24',
      'Thickness': '3/8 Inches',
      'Finish': 'Polished',
      'PEI Rating': '4',
      'Water Absorption': '<0.5%',
    },
    badge: null,
  },
  {
    id: 'prod-004',
    name: 'Shaw Floorigami Carpet Tile - Peel & Stick',
    brand: 'Shaw',
    colorName: 'Cozy Taupe',
    colorsAvailable: 12,
    category: 'Carpet',
    subcategory: 'Carpet Tile',
    listPrice: 3.29,
    unit: 'SF',
    sfPerBox: 36.0,
    image: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=500&h=500&fit=crop',
    colorSwatches: ['#C4B8A8', '#8B7355', '#A0855B', '#6B6B6B', '#3D3D3D', '#D2C4B0'],
    specs: {
      'Application': 'Residential',
      'Size': '18x18',
      'Fiber': 'PET Polyester',
      'Weight': '24 oz',
      'Installation': 'Peel & Stick',
      'Backing': 'Pressure Sensitive Adhesive',
    },
    badge: null,
  },
  {
    id: 'prod-005',
    name: 'Silestone Calacatta Gold Quartz Countertop',
    brand: 'Silestone',
    colorName: 'Calacatta Gold',
    colorsAvailable: 1,
    category: 'Countertops',
    subcategory: 'Quartz',
    listPrice: 72.00,
    unit: 'SF',
    sfPerBox: null,
    image: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F0E8'],
    specs: {
      'Application': 'Residential, Commercial',
      'Thickness': '2cm / 3cm',
      'Finish': 'Polished',
      'Stain Resistant': 'Yes',
      'Heat Resistant': 'Yes',
    },
    badge: 'New',
  },
  {
    id: 'prod-006',
    name: 'KraftMaid Durham Maple Shaker Cabinet',
    brand: 'KraftMaid',
    colorName: 'Dove White',
    colorsAvailable: 6,
    category: 'Cabinets',
    subcategory: 'Base Cabinet',
    listPrice: 485.00,
    unit: 'EA',
    sfPerBox: null,
    image: 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=500&h=500&fit=crop',
    colorSwatches: ['#F5F0E8', '#D2C4B0', '#8B7355', '#3D3D3D', '#A0855B', '#C4A882'],
    specs: {
      'Style': 'Shaker',
      'Material': 'Maple',
      'Construction': 'All Plywood',
      'Door Type': 'Full Overlay',
      'Soft Close': 'Yes',
      'Width Options': '12" - 36"',
    },
    badge: null,
  },
];

const categories = ['All', 'Hardwood', 'LVP / LVT', 'Tile & Stone', 'Carpet', 'Cabinets', 'Countertops'];

const departments = {
  Flooring: ['Hardwood', 'LVP / LVT', 'Tile & Stone', 'Carpet'],
  Cabinets: ['Cabinets'],
  Countertops: ['Countertops'],
  Kitchen: ['Cabinets', 'Countertops', 'Tile & Stone'],
  Bath: ['Tile & Stone', 'Cabinets', 'Countertops'],
};

export default function ProSourceShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, userName, userEmail, showroom, accountManager, loadUserData, saveUserData } = useAuth();
  const selectedProductId = searchParams.get('product');
  // Rich quote/cart page is the same view whether you're on /cart or the legacy ?view=quote URL.
  const viewQuotePage = location.pathname === '/cart' || searchParams.get('view') === 'quote';
  const activeDept = searchParams.get('dept');
  const deptCategories = activeDept && departments[activeDept] ? departments[activeDept] : null;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  // Mirror the shared active-cart store. All mutations go through the store
  // helpers so the nav badge and /carts page stay in sync.
  const [quoteCart, setQuoteCart] = useState(() => getGuestCart().items);
  useEffect(() => {
    const sync = () => setQuoteCart(getGuestCart().items);
    sync();
    return subscribeGuestCart(sync);
  }, []);
  const [showCart, setShowCart] = useState(false);
  const [cartSubmitted, setCartSubmitted] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeSpecTab, setActiveSpecTab] = useState('specifications');
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
  // Quote form fields. Pickup-only — no delivery address. Members rely on
  // what's already on their account; the guest contact fields are kept as
  // state in case we want to pre-fill the wizard later.
  const [quoteFirstName, setQuoteFirstName] = useState('');
  const [quoteLastName, setQuoteLastName] = useState('');
  const [quoteEmail, setQuoteEmail] = useState('');
  const [quoteCompany, setQuoteCompany] = useState('');
  const [quotePhone, setQuotePhone] = useState('');
  const [quoteZip, setQuoteZip] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  const selectedProduct = selectedProductId ? allProducts.find(p => p.id === selectedProductId) : null;

  const filteredProducts = allProducts.filter(p => {
    const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !deptCategories || deptCategories.includes(p.category);
    const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchSearch && matchDept && matchCategory;
  });

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
    colorName: product.colorName,
    sfPerBox: product.sfPerBox,
  });

  const addToQuote = (product, qty = 1) => {
    addToGuestCart(snapshotProduct(product, qty));
    setShowCart(true);
  };

  const addSampleToQuote = (product) => {
    const sku = `sample-${productSku(product)}`;
    // One sample per product — bail if it's already in the cart.
    if (getGuestCart().items.some((i) => i.sku === sku)) {
      setShowCart(true);
      return;
    }
    addToGuestCart({
      id: `sample-${product.id}`,
      sku,
      name: `${product.name} (sample)`,
      category: product.category,
      price: 0,
      qty: 1,
      isSample: true,
      image: product.image,
      colorName: product.colorName,
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

  const submitQuote = () => {
    // Guests go through the wizard: project type, zip, timing, OTP. The
    // wizard creates their account + project and clears the cart on success.
    if (!userId) {
      setWizardIntent('quote');
      setQuoteWizardOpen(true);
      return;
    }
    setCartSubmitted(true);
    clearGuestCart();
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
   * and keeps the FULL item snapshot — image, colorName, sfPerBox and all.
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
              products: mergeCartItemsIntoProducts(p.products, items, roomId),
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

  // "Add To Project" on the product detail page — this one product, at the
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
              <div style={{ fontSize: 15, color: colors.gray500, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 28px' }}>
                {userId ? (
                  <>
                    {accountManager?.name ? (
                      <>Your account manager <strong style={{ color: colors.gray900 }}>{accountManager.name}</strong> will review your cart and reach out within 1 business day with member pricing and a pickup time.</>
                    ) : (
                      <>Your account manager will review your cart and reach out within 1 business day with member pricing and a pickup time.</>
                    )}
                  </>
                ) : (
                  <>We'll match you to the nearest ProSource showroom and an account manager will reach out within 1 business day with pricing and a pickup time.</>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  style={{ ...s.addToQuoteBtn, width: 'auto', padding: '12px 24px' }}
                  onClick={() => { clearGuestCart(); setCartSubmitted(false); navigate('/shop'); }}
                >
                  Continue Shopping
                </button>
                {userId && (
                  <Link to="/" style={{
                    padding: '12px 24px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
                    fontSize: 14, fontWeight: 500, color: colors.gray700, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
                  }}>
                    Back to Dashboard
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
                          {item.isSample ? '🔲 SAMPLE · ' : ''}{item.name}
                        </div>
                        <div style={{ fontSize: 12, color: colors.gray500 }}>
                          {item.colorName}
                          {item.isSample ? ' · Sample' : item.sfPerBox ? ` (${item.sfPerBox} SF/Box)` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Availability removed — placeholder shipping data; the
                        real fulfillment timeline gets set by the AM during quote. */}
                    <div />


                    {/* Quantity */}
                    <div style={{ textAlign: 'center' }}>
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
                      {item.sfPerBox && (
                        <div style={{ fontSize: 12, color: colors.gray500, marginTop: 4 }}>
                          {(item.sfPerBox * item.qty).toFixed(2)} SF
                        </div>
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
                      style={{
                        width: '100%', padding: '14px 24px', background: colors.darkBlue, color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      Send to my account manager <ChevronRight size={18} />
                    </button>
                    {/* Lightweight save-for-later. Pops a project → room picker
                        so the user doesn't have to commit to a quote right now. */}
                    <div style={{ position: 'relative', textAlign: 'center', marginTop: 14 }}>
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
                      {saveError && (
                        <div style={{ fontSize: 12, color: colors.red, marginTop: 6 }}>{saveError}</div>
                      )}
                    </div>
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

  // ========== PRODUCT DETAIL VIEW ==========
  if (selectedProduct) {
    const p = selectedProduct;
    const specEntries = Object.entries(p.specs);
    const halfSpecs = Math.ceil(specEntries.length / 2);

    return (
      <div style={s.wrapper}>
        <div style={s.container}>
          {/* Breadcrumb */}
          <div style={s.breadcrumb}>
            <span style={s.breadcrumbLink} onClick={() => setSearchParams({})}>
              <Home size={14} style={{ marginBottom: -2 }} />
            </span>
            <ChevronRight size={12} />
            <span style={s.breadcrumbLink} onClick={() => { setSelectedCategory(p.category); setSearchParams({}); }}>{p.category}</span>
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
            {/* Left - Image */}
            <div>
              <img src={p.image} alt={p.name} style={s.detailImage} />
              <div style={{ textAlign: 'center', fontSize: 12, color: colors.gray400, marginTop: 8 }}>
                Hover Over Image to Zoom
              </div>
            </div>

            {/* Right - Info */}
            <div>
              <div style={s.detailName}>{p.name}</div>
              <div style={s.detailColorName}>{p.colorName} · {p.colorsAvailable} colors available</div>

              <div style={s.detailPriceLabel}>List Price</div>
              <div style={s.detailPrice}>
                US$ {p.listPrice.toFixed(2)} <span style={s.detailUnit}>/{p.unit}</span>
              </div>

              {/* Color swatches */}
              <div style={{ fontSize: 13, color: colors.gray700, marginBottom: 8 }}>
                Color: <strong>{p.colorName}</strong>
              </div>
              <div style={s.swatchRow}>
                {p.colorSwatches.map((c, i) => (
                  <div key={i} style={s.swatch(c, i === selectedColor)} onClick={() => setSelectedColor(i)} />
                ))}
              </div>

              {/* Size */}
              {p.specs.Size && (
                <div style={s.sizeBox}>
                  <div>
                    <div style={s.sizeLabel}>Size</div>
                    <div style={s.sizeValue}>{p.specs.Size}</div>
                  </div>
                </div>
              )}

              {/* Shipping/Pickup placeholders removed — we don't have real
                  fulfillment data for products yet, and "Request a Quote" is
                  redundant with the primary CTA below. */}

              {/* SF Needed + Quantity */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.gray900 }}>Enter Total Square Feet</span>
                  <input
                    type="number"
                    placeholder="SF needed"
                    value={sfNeeded}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSfNeeded(val);
                      if (val && Number(val) > 0 && p.sfPerBox) {
                        setBoxQty(Math.max(1, Math.ceil(Number(val) / p.sfPerBox)));
                      }
                    }}
                    style={{
                      width: 110, padding: '8px 12px', border: `1.5px solid ${colors.gray200}`, borderRadius: 6,
                      fontSize: 13, fontFamily: 'inherit', textAlign: 'right', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: colors.gray500 }}>
                    {p.sfPerBox ? `1 box covers ${p.sfPerBox} SF` : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <button
                      onClick={() => { const nq = Math.max(1, boxQty - 1); setBoxQty(nq); setSfNeeded(''); }}
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

              {/* Add to Project — members get a project → room picker; guests
                  go through the wizard, which creates the project for them. */}
              <div style={{ position: 'relative' }}>
                <button
                  style={s.addToProjectBtn}
                  onClick={() => {
                    if (!userId) {
                      // No account yet — carry this product into the wizard,
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

              {/* Compare */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.gray700, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: colors.darkBlue }} />
                Compare
              </label>
            </div>
          </div>

          {/* Specifications */}
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${colors.gray200}`, padding: '0 24px 24px', marginBottom: 48 }}>
            <div style={s.specTabs}>
              {['Specifications', 'Warranty', 'Overview'].map(tab => (
                <button
                  key={tab}
                  style={s.specTab(activeSpecTab === tab.toLowerCase())}
                  onClick={() => setActiveSpecTab(tab.toLowerCase())}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeSpecTab === 'specifications' && (
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

            {activeSpecTab === 'warranty' && (
              <div style={{ padding: '20px 0', fontSize: 14, color: colors.gray700, lineHeight: 1.7 }}>
                <p style={{ marginBottom: 12 }}><strong>Limited Lifetime Residential Warranty</strong></p>
                <p>This product is covered by the manufacturer's limited lifetime residential warranty and a 10-year light commercial warranty. Contact your ProSource account manager for full warranty details and documentation.</p>
              </div>
            )}

            {activeSpecTab === 'overview' && (
              <div style={{ padding: '20px 0', fontSize: 14, color: colors.gray700, lineHeight: 1.7 }}>
                <p>This premium product is available through your local ProSource showroom. Visit to see samples, get expert advice, and take advantage of your member pricing. Your account manager can help with product selection, quantity calculations, and installation coordination.</p>
              </div>
            )}
          </div>
        </div>

        {/* The top-nav cart icon already shows the count and links to /carts —
            no need for a duplicate floating button on this page. */}

        {/* Cart drawer */}
        {showCart && renderCartDrawer()}

        {/* Guests reach this from "Add To Project" — the wizard is what turns
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
   * always an offer — a product with no room still lands in the project and
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
                        {item.name}
                      </div>
                      <div style={s.cartItemPrice}>
                        {item.isSample
                          ? 'Product sample'
                          : item.price != null
                            ? `List: $${Number(item.price).toFixed(2)}`
                            : 'To be quoted'}
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
        {/* Search */}
        <div style={s.searchBar}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} color={colors.gray400} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              style={s.searchInput}
              placeholder="Search products by name, brand, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Cart count lives in the top nav now — no inline button needed here. */}
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
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={s.productGrid}>
          {filteredProducts.map(product => (
            <div
              key={product.id}
              style={{
                ...s.productCard,
                ...(hoveredProduct === product.id ? s.productCardHover : {}),
              }}
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
              onClick={() => setSearchParams({ product: product.id })}
            >
              <div style={{ position: 'relative' }}>
                <img src={product.image} alt={product.name} style={s.productImage} />
                {product.badge && <div style={s.productBadge(product.badge)}>{product.badge}</div>}
                <button
                  style={{
                    ...s.heartBtn,
                    color: savedProducts.includes(product.id) ? colors.red : colors.gray400,
                  }}
                  onClick={(e) => { e.stopPropagation(); toggleSaved(product.id); }}
                >
                  <Heart size={16} fill={savedProducts.includes(product.id) ? colors.red : 'none'} />
                </button>
              </div>
              <div style={s.productInfo}>
                <div style={s.productBrand}>{product.brand}</div>
                <div style={s.productName}>{product.name}</div>
                <div style={s.productColor}>{product.colorName} · {product.colorsAvailable} colors</div>
                <div style={s.productPriceRow}>
                  <div>
                    <span style={s.productPrice}>${product.listPrice.toFixed(2)}</span>
                    <span style={s.productUnit}> / {product.unit}</span>
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
      </div>

      {/* Cart drawer */}
      {showCart && renderCartDrawer()}
    </div>
  );
}
