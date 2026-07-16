import React, { useState, useEffect, useCallback } from 'react';

/**
 * Admin Product Manager. Reads and writes the real catalog behind
 * /api/products (netlify/functions/products.mjs), which is the same catalog the
 * storefront renders. Edits made here show up there.
 *
 * This file uses Tailwind classes, unlike most of the app.
 */

// Must match the storefront's categories and the function's CATEGORIES list.
const CATEGORIES = [
  'Hardwood',
  'LVP / LVT',
  'Tile & Stone',
  'Carpet',
  'Cabinets',
  'Countertops',
];

const UNITS = ['SF', 'EA', 'BOX'];

const blankProduct = () => ({
  sku: '',
  parentSku: '',
  name: '',
  brand: '',
  category: 'Hardwood',
  subcategory: '',
  listPrice: '',
  unit: 'SF',
  sfPerBox: '',
  image: '',
  colorName: '',
  colorsAvailable: null,
  colorSwatches: [],
  specs: {},
  status: 'active',
});

const money = (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : 'No price');

/* --------------------------------- CSV --------------------------------- */

/** Minimal RFC4180-ish parser: handles quoted fields, escaped quotes, CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

// CSV header → canonical field. Accepts snake_case and camelCase, and `price`
// as an alias for the canonical `listPrice`.
const CSV_FIELDS = {
  sku: 'sku',
  parent_sku: 'parentSku',
  parentsku: 'parentSku',
  name: 'name',
  brand: 'brand',
  category: 'category',
  subcategory: 'subcategory',
  sub_category: 'subcategory',
  price: 'listPrice',
  list_price: 'listPrice',
  listprice: 'listPrice',
  unit: 'unit',
  sf_per_box: 'sfPerBox',
  sfperbox: 'sfPerBox',
  image: 'image',
  image_url: 'image',
  color_name: 'colorName',
  colorname: 'colorName',
  status: 'status',
};

/** CSV text → product objects the API can upsert. Throws on a missing sku column. */
function csvToProducts(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row.');

  const headers = rows[0].map((h) => CSV_FIELDS[h.trim().toLowerCase().replace(/\s+/g, '_')] || null);
  if (!headers.includes('sku')) {
    throw new Error('CSV must have a "sku" column.');
  }

  return rows.slice(1).map((cells) => {
    const p = {};
    headers.forEach((field, i) => {
      if (!field) return;
      const raw = (cells[i] ?? '').trim();
      if (raw === '') return;
      p[field] = raw;
    });
    return p;
  });
}

/* ------------------------------- component ------------------------------ */

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busySku, setBusySku] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err.message || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Upsert one product. Returns the saved product, or throws. */
  const postProduct = async (product) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
    return data.saved?.[0];
  };

  /** Merge a saved product into local state without a full refetch. */
  const mergeSaved = (saved) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.sku === saved.sku);
      const next = exists
        ? prev.map((p) => (p.sku === saved.sku ? saved : p))
        : [...prev, saved];
      return next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });
  };

  const handleSave = async (updatedProduct) => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...updatedProduct,
        listPrice: updatedProduct.listPrice === '' ? null : updatedProduct.listPrice,
        sfPerBox: updatedProduct.sfPerBox === '' ? null : updatedProduct.sfPerBox,
        parentSku: updatedProduct.parentSku === '' ? null : updatedProduct.parentSku,
      };
      const saved = await postProduct(payload);
      if (saved) mergeSaved(saved);
      setEditingProduct(null);
      setIsNewProduct(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (product) => {
    const next = product.status === 'active' ? 'inactive' : 'active';
    setBusySku(product.sku);
    setError(null);
    try {
      // Partial upsert. The function merges onto the stored product, so this
      // touches status only.
      const saved = await postProduct({ sku: product.sku, status: next });
      if (saved) mergeSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySku(null);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete ${product.name} (${product.sku})? This removes it from the storefront too.`)) return;
    setBusySku(product.sku);
    setError(null);
    try {
      const res = await fetch(`/api/products?sku=${encodeURIComponent(product.sku)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      setProducts((prev) => prev.filter((p) => p.sku !== product.sku));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySku(null);
    }
  };

  const handleAddProduct = () => {
    setSaveError(null);
    setIsNewProduct(true);
    setEditingProduct(blankProduct());
  };

  const handleEdit = (product) => {
    setSaveError(null);
    setIsNewProduct(false);
    setEditingProduct({ ...product, specs: { ...product.specs } });
  };

  const handleCsvFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = csvToProducts(text);
      if (!rows.length) throw new Error('No data rows found in that CSV.');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setImportResult({
        savedCount: data.savedCount || 0,
        errors: data.errors || [],
        total: rows.length,
      });
      await load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const addSpec = () => {
    const k = specKey.trim();
    if (!k || !editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      specs: { ...editingProduct.specs, [k]: specValue },
    });
    setSpecKey('');
    setSpecValue('');
  };

  const removeSpec = (key) => {
    const next = { ...editingProduct.specs };
    delete next[key];
    setEditingProduct({ ...editingProduct, specs: next });
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q);
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-900 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">ProSource Product Manager</h1>
            <p className="text-blue-200 text-sm">STL-001 - South County</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUpload(true); setImportResult(null); setImportError(null); }}
              className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded flex items-center gap-2"
            >
              <span>📄</span> Upload CSV
            </button>
            <button
              onClick={handleAddProduct}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded flex items-center gap-2"
            >
              <span>+</span> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto p-4">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <span>{error}</span>
            <button onClick={load} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
              Retry
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search by name, SKU, or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="text-gray-500 text-sm">
              {loading ? 'Loading…' : `${filteredProducts.length} products`}
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading catalog…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {products.length === 0
                ? 'No products in the catalog yet. Use “Add Product” or “Upload CSV” to create some.'
                : 'No products match those filters.'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-600">Product</th>
                  <th className="text-left p-4 font-semibold text-gray-600">SKU</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Category</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Price</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Updated</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.sku} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded bg-gray-100"
                        />
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.brand}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-sm">{product.sku}</div>
                      <div className="text-xs text-gray-400">
                        {product.parentSku ? `Parent: ${product.parentSku}` : 'No parent'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{money(product.listPrice)}</div>
                      <div className="text-xs text-gray-400">per {product.unit}</div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleStatusToggle(product)}
                        disabled={busySku === product.sku}
                        className={`px-3 py-1 rounded-full text-sm font-medium disabled:opacity-50 ${
                          product.status === 'active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {busySku === product.sku ? '…' : product.status}
                      </button>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {product.updatedAt}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={busySku === product.sku}
                          className="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{isNewProduct ? 'Add Product' : 'Edit Product'}</h2>
                <button
                  onClick={() => { setEditingProduct(null); setIsNewProduct(false); setSaveError(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {saveError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex gap-4">
                  {editingProduct.image ? (
                    <img
                      src={editingProduct.image}
                      alt={editingProduct.name}
                      className="w-32 h-32 object-cover rounded bg-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-400 text-sm">
                      No image
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={editingProduct.image || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                      placeholder="https://…"
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Paste a hosted image URL. The preview updates as you type.
                    </p>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    disabled={!isNewProduct}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    placeholder={isNewProduct ? 'e.g. SW-VENOAK-ENG-NAT' : ''}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isNewProduct ? '' : 'bg-gray-50 text-gray-500'
                    }`}
                  />
                  {isNewProduct && (
                    <p className="text-xs text-gray-400 mt-1">Letters, digits, dot, dash, underscore.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent SKU
                  </label>
                  <input
                    type="text"
                    value={editingProduct.parentSku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, parentSku: e.target.value })}
                    placeholder="Groups colour variants. Leave blank for none"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    value={editingProduct.subcategory || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, subcategory: e.target.value })}
                    placeholder="e.g. Engineered Hardwood"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colour Name
                  </label>
                  <input
                    type="text"
                    value={editingProduct.colorName || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, colorName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    List Price
                  </label>
                  <div className="flex">
                    <span className="px-3 py-2 bg-gray-100 border border-r-0 rounded-l-lg">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.listPrice ?? ''}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        listPrice: e.target.value === '' ? '' : parseFloat(e.target.value),
                      })}
                      className="w-full px-4 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SF per Box
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.sfPerBox ?? ''}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      sfPerBox: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })}
                    placeholder="Blank if not sold by the box"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-medium mb-3">Specifications</h3>
                  {Object.keys(editingProduct.specs || {}).length === 0 && (
                    <p className="text-sm text-gray-400 mb-3">No specifications yet.</p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(editingProduct.specs || {}).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-gray-500">
                            {key}
                          </label>
                          <button
                            onClick={() => removeSpec(key)}
                            className="text-xs text-gray-400 hover:text-red-600"
                            title={`Remove ${key}`}
                          >
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, [key]: e.target.value },
                          })}
                          className="w-full px-3 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <input
                      type="text"
                      value={specKey}
                      onChange={(e) => setSpecKey(e.target.value)}
                      placeholder="Spec name (e.g. Thickness)"
                      className="flex-1 px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={specValue}
                      onChange={(e) => setSpecValue(e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addSpec}
                      disabled={!specKey.trim()}
                      className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => { setEditingProduct(null); setIsNewProduct(false); setSaveError(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(editingProduct)}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : isNewProduct ? 'Create Product' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Upload Products CSV</h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  handleCsvFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleCsvFile(e.dataTransfer.files?.[0]);
                }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="text-4xl mb-3">📄</div>
                {importing ? (
                  <p className="text-gray-600">Importing…</p>
                ) : (
                  <>
                    <p className="text-gray-600 mb-2">Drag and drop your CSV file here</p>
                    <p className="text-gray-400 text-sm mb-4">or</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Browse Files
                    </button>
                  </>
                )}
              </div>

              {importError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                  <p className="font-medium text-green-800">
                    Imported {importResult.savedCount} of {importResult.total} rows.
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-red-700">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>{e.sku || '(no sku)'}: {e.error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Expected columns:</p>
                <p className="text-xs text-gray-500 font-mono">
                  sku, parent_sku, name, brand, category, subcategory, price, unit, sf_per_box, image, color_name, status
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Only <span className="font-mono">sku</span> is required. Rows matching an existing SKU update
                  just the columns present. Category must be one of: {CATEGORIES.join(', ')}.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
