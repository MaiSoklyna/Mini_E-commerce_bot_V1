"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Category } from "@/types";
import { MdFolder, MdPublic, MdStore, MdEdit, MdDelete } from "react-icons/md";

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    name_kh: "",
    icon_emoji: "",
    sort_order: 0,
    merchant_id: 0,
    is_global: true
  });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("admin_user") || "{}") : {};
  const isSuper = user.role === "super_admin";

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        api.get("/admin/categories"),
        isSuper ? api.get("/admin/merchants", { params: { limit: 100 } }) : Promise.resolve({ data: { data: [] } }),
      ]);
      setCategories(cRes.data.data || []);
      setMerchants(mRes.data.data || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load categories", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      name: "",
      name_kh: "",
      icon_emoji: "",
      sort_order: 0,
      merchant_id: user.merchant_id || 0,
      is_global: !user.merchant_id
    });
    setModal(true);
  };

  const openEdit = (c: Category) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      name_kh: c.name_kh || "",
      icon_emoji: c.icon_emoji || "",
      sort_order: c.sort_order || 0,
      merchant_id: c.merchant_id || 0,
      is_global: !c.merchant_id
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showToast("Category name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        merchant_id: form.is_global ? null : (form.merchant_id || undefined)
      };

      if (editId) {
        await api.put(`/admin/categories/${editId}`, payload);
        showToast("Category updated successfully", "success");
      } else {
        await api.post("/admin/categories", payload);
        showToast("Category created successfully", "success");
      }

      setModal(false);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to save category", "error");
    }
    setSaving(false);
  };

  const openDeleteModal = (c: Category) => {
    setDeleteTarget(c);
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await api.delete(`/admin/categories/${deleteTarget.id}`);
      showToast(`Category "${deleteTarget.name}" deleted successfully`, "success");
      setDeleteModal(false);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || "Failed to delete category";
      showToast(errorMsg, "error");
    }
  };

  return (
    <div className="animate-in">
      {/* Toast Notification */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 100,
            padding: "12px 20px",
            borderRadius: 8,
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontWeight: 500,
            fontSize: 14,
            animation: "slideInRight 0.3s ease-out"
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Categories</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {categories.length} total categories
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          + Add Category
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Icon</th>
                <th>Name</th>
                <th>Khmer Name</th>
                <th style={{ width: 120 }}>Products</th>
                <th style={{ width: 100 }}>Scope</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className="skeleton" style={{ height: 20, borderRadius: 4 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : categories.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
          <MdFolder size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p className="text-base font-medium mb-2">No categories yet</p>
          <p className="text-sm">Create your first category to organize products</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Icon</th>
                <th>Name</th>
                <th>Khmer Name</th>
                <th style={{ width: 120, textAlign: "center" }}>Products</th>
                <th style={{ width: 120 }}>Scope</th>
                <th style={{ width: 140, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.icon_emoji ? (
                      <span style={{ fontSize: 28 }}>{c.icon_emoji}</span>
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "var(--bg-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <MdFolder size={18} style={{ color: "var(--text-muted)" }} />
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>
                      {c.name}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {c.name_kh || "—"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      className="font-semibold"
                      style={{
                        color: "var(--accent)",
                        fontSize: 15
                      }}
                    >
                      {c.product_count || 0}
                    </span>
                  </td>
                  <td>
                    {!c.merchant_id ? (
                      <span
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--info, #3b82f6)" }}
                      >
                        <MdPublic size={14} />
                        Global
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <MdStore size={14} />
                        {c.merchant_name || "Merchant"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        title="Edit category"
                      >
                        <MdEdit size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(c)}
                        className="btn btn-danger"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        title="Delete category"
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            padding: 16
          }}
          onClick={() => setModal(false)}
        >
          <div
            className="card animate-in"
            style={{ width: "100%", maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>
              {editId ? "Edit Category" : "Add New Category"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Name (English) *
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Clothing, Electronics"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Name (Khmer)
                </label>
                <input
                  className="input"
                  value={form.name_kh}
                  onChange={(e) => setForm({ ...form, name_kh: e.target.value })}
                  placeholder="e.g. សម្លៀកបំពាក់"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Emoji Icon
                  </label>
                  <input
                    className="input"
                    style={{ fontSize: 20 }}
                    value={form.icon_emoji}
                    onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })}
                    placeholder="👗"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Sort Order
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: +e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              {isSuper && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_global}
                      onChange={(e) => setForm({ ...form, is_global: e.target.checked, merchant_id: e.target.checked ? 0 : form.merchant_id })}
                    />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      Global Category (available to all merchants)
                    </span>
                  </label>
                </div>
              )}

              {isSuper && !form.is_global && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Merchant
                  </label>
                  <select
                    className="input"
                    value={form.merchant_id}
                    onChange={(e) => setForm({ ...form, merchant_id: +e.target.value })}
                  >
                    <option value={0}>Select Merchant</option>
                    {merchants.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="btn btn-outline">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editId ? "Update" : "Create"}
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
            padding: 16
          }}
          onClick={() => setDeleteModal(false)}
        >
          <div
            className="card animate-in text-center"
            style={{ width: "100%", maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>
              Delete Category?
            </h2>
            <p className="mb-1" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {deleteTarget.product_count && deleteTarget.product_count > 0 ? (
              <p className="mt-2 mb-4" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 500 }}>
                ⚠️ This category has {deleteTarget.product_count} product{deleteTarget.product_count > 1 ? 's' : ''}.
                Deleting it may affect those products.
              </p>
            ) : (
              <p className="mt-2 mb-4" style={{ color: "var(--text-muted)", fontSize: 13 }}>
                This action cannot be undone.
              </p>
            )}

            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => setDeleteModal(false)} className="btn btn-outline">
                Cancel
              </button>
              <button onClick={confirmDelete} className="btn btn-danger">
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
