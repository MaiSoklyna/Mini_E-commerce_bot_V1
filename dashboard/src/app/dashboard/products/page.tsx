"use client";
import { useState, useEffect, useRef } from "react";
import * as productService from "@/services/productService";
import * as categoryService from "@/services/categoryService";
import * as merchantService from "@/services/merchantService";
import { getDashboardStats } from "@/services/dashboardService";
import { Product, Category, Merchant, Pagination, Stats } from "@/types";

interface ProductStats {
  total: number;
  active: number;
  out_of_stock: number;
  featured: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stats, setStats] = useState<ProductStats>({ total: 0, active: 0, out_of_stock: 0, featured: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");

  // UI states
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  // Form data
  const [form, setForm] = useState({
    name: "",
    description: "",
    base_price: 0,
    compare_price: 0,
    stock: 0,
    sku: "",
    icon_emoji: "",
    delivery_days: 3,
    category_id: 0,
    merchant_id: 0,
    is_active: true,
    is_featured: false,
  });

  // Image upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("admin_user") || "{}") ?? {}) : {};
  const isSuper = user?.role === "super_admin";

  // Load data
  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (filterCat) params.category_id = filterCat;
      if (filterStatus) params.status = filterStatus;

      const [pRes, cats, mercs] = await Promise.all([
        productService.listProducts(params),
        categoryService.listCategories(),
        isSuper ? merchantService.listMerchants({ limit: 100 }) : Promise.resolve([]),
      ]);

      setProducts(pRes.data || []);
      setPagination(pRes.meta || { page, limit: 20, total: 0, total_pages: 0 });
      setCategories(cats || []);
      setMerchants(mercs || []);

      // Calculate stats
      const allProducts = pRes.data || [];
      setStats({
        total: allProducts.length,
        active: allProducts.filter((p: Product) => p.is_active).length,
        out_of_stock: allProducts.filter((p: Product) => p.stock === 0).length,
        featured: allProducts.filter((p: Product) => p.is_featured).length,
      });
    } catch (e) {
      console.error(e);
      showToast("Failed to load products", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
  }, [search, filterCat, filterStatus, sortBy]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const resetFilters = () => {
    setSearch("");
    setFilterCat(0);
    setFilterStatus("");
    setSortBy("created_at_desc");
  };

  const hasActiveFilters = search || filterCat || filterStatus || sortBy !== "created_at_desc";

  // Modal functions
  const openCreate = () => {
    setEditId(null);
    setForm({
      name: "",
      description: "",
      base_price: 0,
      compare_price: 0,
      stock: 0,
      sku: "",
      icon_emoji: "",
      delivery_days: 3,
      category_id: 0,
      merchant_id: user.merchant_id || 0,
      is_active: true,
      is_featured: false,
    });
    setPreviewUrls([]);
    setSelectedFiles([]);
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      base_price: p.base_price,
      compare_price: p.compare_price || 0,
      stock: p.stock,
      sku: p.sku || "",
      icon_emoji: p.icon_emoji || "",
      delivery_days: p.delivery_days || 3,
      category_id: p.category_id || 0,
      merchant_id: p.merchant_id,
      is_active: p.is_active,
      is_featured: p.is_featured || false,
    });
    setPreviewUrls(p.primary_image ? [p.primary_image] : []);
    setSelectedFiles([]);
    setModal(true);
  };

  const openDelete = (p: Product) => {
    setDeleteTarget(p);
    setDeleteModal(true);
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const validUrls: string[] = [];

    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
        showToast("Please select JPG, PNG, GIF or WEBP images only", "error");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name} is too large. Max 5MB per image`, "error");
        continue;
      }
      validFiles.push(file);
      validUrls.push(URL.createObjectURL(file));
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviewUrls(prev => [...prev, ...validUrls]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePreview = (index: number) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload images
  const uploadImages = async (productId: number) => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await productService.uploadProductImage(productId, file);
      }
    } catch (err: any) {
      showToast("Image upload failed", "error");
      console.error("Image upload error:", err);
    }
    setUploading(false);
  };

  // Save product
  const save = async () => {
    if (!form.name.trim()) {
      showToast("Product name is required", "error");
      return;
    }
    if (!form.merchant_id && isSuper) {
      showToast("Please select a merchant", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        compare_price: form.compare_price || null,
        category_id: form.category_id || null,
      };

      if (editId) {
        await productService.updateProduct(editId, payload);
        if (selectedFiles.length > 0) await uploadImages(editId);
        showToast("Product updated successfully", "success");
      } else {
        const product = await productService.createProduct(payload);
        const newId = product?.id;
        if (newId && selectedFiles.length > 0) await uploadImages(newId);
        showToast("Product created successfully", "success");
      }

      setModal(false);
      load(pagination.page);
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Error saving product", "error");
    }
    setSaving(false);
  };

  // Delete product
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await productService.deleteProduct(deleteTarget.id);
      showToast("Product deleted successfully", "success");
      setDeleteModal(false);
      setDeleteTarget(null);
      load(pagination.page);
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Error deleting product", "error");
    }
    setDeleting(false);
  };

  // Toggle active/featured
  const toggleActive = async (product: Product) => {
    try {
      await productService.patchProduct(product.id, { is_active: !product.is_active });
      showToast(`Product ${!product.is_active ? 'activated' : 'deactivated'}`, "success");
      load(pagination.page);
    } catch (e) {
      showToast("Failed to update product status", "error");
    }
  };

  const toggleFeatured = async (product: Product) => {
    try {
      await productService.patchProduct(product.id, { is_featured: !product.is_featured });
      showToast(`Product ${!product.is_featured ? 'featured' : 'unfeatured'}`, "success");
      load(pagination.page);
    } catch (e) {
      showToast("Failed to update featured status", "error");
    }
  };

  return (
    <div className="animate-in">
      {/* Toast */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 100,
            padding: "12px 20px",
            borderRadius: 8,
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "slideIn 0.3s ease",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Products
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manage your product catalog
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          + Add Product
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Total Products
          </p>
          <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            {stats.total}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Active
          </p>
          <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
            {stats.active}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Out of Stock
          </p>
          <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
            {stats.out_of_stock}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Featured
          </p>
          <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
            {stats.featured}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 180 }}
            value={filterCat}
            onChange={(e) => setFilterCat(+e.target.value)}
          >
            <option value={0}>All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon_emoji} {c.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ maxWidth: 150 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="input"
            style={{ maxWidth: 180 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="price_asc">Price Low-High</option>
            <option value="price_desc">Price High-Low</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 60,
                  background: "var(--bg-secondary)",
                  borderRadius: 8,
                  marginBottom: 12,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name + SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
                      <p>No products found</p>
                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="text-sm font-medium mt-2"
                          style={{ color: "var(--accent)" }}
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.primary_image ? (
                          <img
                            src={p.primary_image}
                            alt={p.name}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              background: "var(--bg-secondary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 20,
                            }}
                          >
                            {p.icon_emoji || "📦"}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                            {p.name}
                          </p>
                          {p.sku && (
                            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                              {p.sku}
                            </p>
                          )}
                          {isSuper && p.merchant_name && (
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {p.merchant_name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        {p.category_name ? (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: "var(--bg-secondary)", color: "var(--text)" }}
                          >
                            {p.category_name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold font-mono text-sm">${p.base_price}</p>
                          {p.compare_price && p.compare_price > p.base_price && (
                            <p
                              className="text-xs line-through font-mono"
                              style={{ color: "var(--text-muted)" }}
                            >
                              ${p.compare_price}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            color:
                              p.stock === 0
                                ? "#ef4444"
                                : p.stock < 5
                                ? "#f59e0b"
                                : p.stock < 20
                                ? "#f59e0b"
                                : "var(--text)",
                            fontWeight: p.stock < 5 ? 600 : 400,
                          }}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <label className="flex items-center cursor-pointer">
                          <div
                            style={{
                              position: "relative",
                              width: 44,
                              height: 24,
                              background: p.is_active ? "#10b981" : "#d1d5db",
                              borderRadius: 12,
                              transition: "background 0.2s",
                            }}
                            onClick={() => toggleActive(p)}
                          >
                            <div
                              style={{
                                position: "absolute",
                                width: 20,
                                height: 20,
                                background: "white",
                                borderRadius: "50%",
                                top: 2,
                                left: p.is_active ? 22 : 2,
                                transition: "left 0.2s",
                              }}
                            />
                          </div>
                        </label>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleFeatured(p)}
                          style={{
                            fontSize: 20,
                            opacity: p.is_featured ? 1 : 0.3,
                            cursor: "pointer",
                            transition: "opacity 0.2s",
                          }}
                        >
                          ⭐
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{ color: "#3b82f6" }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => openDelete(p)}
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{ color: "#ef4444" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => load(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
            className="btn btn-outline"
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            Previous
          </button>
          {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => load(p)}
              className="btn"
              style={{
                padding: "6px 12px",
                fontSize: 13,
                background: p === pagination.page ? "var(--accent)" : "transparent",
                color: p === pagination.page ? "white" : "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => load(Math.min(pagination.total_pages, pagination.page + 1))}
            disabled={pagination.page === pagination.total_pages}
            className="btn btn-outline"
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 16,
          }}
          onClick={() => setModal(false)}
        >
          <div
            className="card animate-in"
            style={{
              width: "100%",
              maxWidth: 600,
              maxHeight: "95vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>
              {editId ? "Edit Product" : "Add New Product"}
            </h2>

            <div className="space-y-4">
              {/* Name + Emoji */}
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Product Name *
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Icon
                  </label>
                  <input
                    className="input text-center text-lg"
                    value={form.icon_emoji}
                    onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })}
                    placeholder="📦"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Category *
                </label>
                <select
                  className="input"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: +e.target.value })}
                >
                  <option value={0}>Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon_emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Price * ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono"
                    value={form.base_price || ""}
                    onChange={(e) => setForm({ ...form, base_price: +e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Original Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono"
                    value={form.compare_price || ""}
                    onChange={(e) => setForm({ ...form, compare_price: +e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Product description..."
                />
              </div>

              {/* Stock */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.stock || ""}
                  onChange={(e) => setForm({ ...form, stock: +e.target.value })}
                  placeholder="0"
                />
              </div>

              {/* SKU + Delivery */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    SKU
                  </label>
                  <input
                    className="input font-mono"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Delivery (days)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.delivery_days}
                    onChange={(e) => setForm({ ...form, delivery_days: +e.target.value })}
                  />
                </div>
              </div>

              {/* Merchant (super admin only) */}
              {isSuper && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Merchant *
                  </label>
                  <select
                    className="input"
                    value={form.merchant_id}
                    onChange={(e) => setForm({ ...form, merchant_id: +e.target.value })}
                  >
                    <option value={0}>Select merchant</option>
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Images
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />

                {previewUrls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {previewUrls.map((url, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img
                          src={url}
                          alt=""
                          style={{
                            width: "100%",
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                          }}
                        />
                        <button
                          onClick={() => removePreview(i)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "#ef4444",
                            color: "white",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--border)",
                    borderRadius: 10,
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--bg-secondary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    Click to upload images
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    JPG, PNG, GIF, WEBP · Max 5MB each
                  </p>
                </div>
              </div>

              {/* Status toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={form.is_active}
                    onChange={() => setForm({ ...form, is_active: true })}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Active
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={!form.is_active}
                    onChange={() => setForm({ ...form, is_active: false })}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Inactive
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    ⭐ Featured Product
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="btn btn-outline">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="btn btn-primary"
              >
                {saving || uploading ? "Saving..." : editId ? "Update Product" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: 16,
          }}
          onClick={() => setDeleteModal(false)}
        >
          <div
            className="card animate-in"
            style={{ width: "100%", maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <h2 className="text-lg font-bold text-center mb-2" style={{ color: "var(--text)" }}>
              Delete Product?
            </h2>
            <p className="text-sm text-center mb-4" style={{ color: "var(--text-muted)" }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              <br />
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="btn btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="btn flex-1"
                style={{ background: "#ef4444", color: "white" }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
