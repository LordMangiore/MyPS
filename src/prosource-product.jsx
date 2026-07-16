import React, { useState } from 'react';

// Sample data
const initialProducts = [
  {
    sku: "ABC123",
    parentSku: "OAK-001",
    name: "Venetian Oak Hardwood",
    brand: "Shaw",
    category: "hardwood",
    subcategory: "engineered",
    price: 4.29,
    unit: "sqft",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
    status: "active",
    updatedAt: "2026-01-15",
    specs: {
      thickness: "3/8 in",
      width: "5 in",
      finish: "hand scraped"
    }
  },
  {
    sku: "DEF456",
    parentSku: "TILE-002",
    name: "Carrara Marble Tile",
    brand: "Daltile",
    category: "tile",
    subcategory: "porcelain",
    price: 6.99,
    unit: "sqft",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=200&h=200&fit=crop",
    status: "active",
    updatedAt: "2026-01-12",
    specs: {
      thickness: "3/8 in",
      size: "12x24",
      finish: "polished"
    }
  },
  {
    sku: "GHI789",
    parentSku: "CARPET-001",
    name: "Plush Comfort Carpet",
    brand: "Mohawk",
    category: "carpet",
    subcategory: "plush",
    price: 3.49,
    unit: "sqft",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
    status: "inactive",
    updatedAt: "2026-01-10",
    specs: {
      weight: "40 oz",
      fiber: "nylon",
      backing: "action back"
    }
  },
  {
    sku: "JKL012",
    parentSku: "LVP-001",
    name: "Waterproof LVP - Gray Oak",
    brand: "COREtec",
    category: "lvp",
    subcategory: "waterproof",
    price: 4.99,
    unit: "sqft",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=200&h=200&fit=crop",
    status: "active",
    updatedAt: "2026-01-20",
    specs: {
      thickness: "6mm",
      wearlayer: "20mil",
      attached_pad: "yes"
    }
  }
];

export default function ProductManager() {
  const [products, setProducts] = useState(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingProduct, setEditingProduct] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || p.category === filterCategory;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSave = (updatedProduct) => {
    setProducts(products.map(p => p.sku === updatedProduct.sku ? updatedProduct : p));
    setEditingProduct(null);
  };

  const handleStatusToggle = (sku) => {
    setProducts(products.map(p => {
      if (p.sku === sku) {
        return { ...p, status: p.status === "active" ? "inactive" : "active" };
      }
      return p;
    }));
  };

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
              onClick={() => setShowUpload(true)}
              className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded flex items-center gap-2"
            >
              <span>📄</span> Upload CSV
            </button>
            <button className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded flex items-center gap-2">
              <span>+</span> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto p-4">
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
              <option value="hardwood">Hardwood</option>
              <option value="tile">Tile</option>
              <option value="carpet">Carpet</option>
              <option value="lvp">LVP</option>
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
              {filteredProducts.length} products
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.brand}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-mono text-sm">{product.sku}</div>
                    <div className="text-xs text-gray-400">Parent: {product.parentSku}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">
                      {product.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">${product.price.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">per {product.unit}</div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleStatusToggle(product.sku)}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        product.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.status}
                    </button>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {product.updatedAt}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingProduct(product)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Edit Product</h2>
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex gap-4">
                  <img 
                    src={editingProduct.image} 
                    alt={editingProduct.name}
                    className="w-32 h-32 object-cover rounded"
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Image
                    </label>
                    <button className="px-4 py-2 border-2 border-dashed rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 w-full">
                      Upload New Image
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                      Images automatically resized via Cloudinary
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
                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
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
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent SKU
                  </label>
                  <input
                    type="text"
                    value={editingProduct.parentSku}
                    onChange={(e) => setEditingProduct({...editingProduct, parentSku: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="hardwood">Hardwood</option>
                    <option value="tile">Tile</option>
                    <option value="carpet">Carpet</option>
                    <option value="lvp">LVP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <div className="flex">
                    <span className="px-3 py-2 bg-gray-100 border border-r-0 rounded-l-lg">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
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
                    onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sqft">sqft</option>
                    <option value="each">each</option>
                    <option value="box">box</option>
                    <option value="yard">yard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({...editingProduct, status: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-medium mb-3">Specifications</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(editingProduct.specs).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">
                          {key.replace('_', ' ')}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setEditingProduct({
                            ...editingProduct, 
                            specs: {...editingProduct.specs, [key]: e.target.value}
                          })}
                          className="w-full px-3 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSave(editingProduct)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
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
              
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-600 mb-2">Drag and drop your CSV file here</p>
                <p className="text-gray-400 text-sm mb-4">or</p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Browse Files
                </button>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Expected columns:</p>
                <p className="text-xs text-gray-500 font-mono">
                  sku, parent_sku, name, brand, category, price, unit, status
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}