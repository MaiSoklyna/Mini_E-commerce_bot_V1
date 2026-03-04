"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { PromoCode } from "@/types";
import { MdLocalOffer, MdEdit, MdDelete, MdAutorenew } from "react-icons/md";

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    code: "",
    type: "percent" as "percent" | "flat",
    value: 10,
    min_order: 0,
    max_uses: 0,
    start_date: "",
    end_date: "",
    merchant_id: 0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("admin_user") || "{}") : {};
  const isSuper = user.role === "super_admin";

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        api.get("/admin/promos"),
        isSuper ? api.get("/admin/merchants", { params: { limit: 100 } }) : Promise.resolve({ data: { data: [] } }),
      ]);
      setPromos(pRes.data.data || []);
      setMerchants(mRes.data.data || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load promo codes", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, code });
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      code: "",
      type: "percent",
      value: 10,
      min_order: 0,
      max_uses: 0,
      start_date: "",
      end_date: "",
      merchant_id: user.merchant_id || 0,
      is_active: true
    });
    setModal(true);
  };

  const openEdit = (p: PromoCode) => {
    setEditId(p.id);
    setForm({
      code: p.code,
      type: p.type,
      value: p.value,
      min_order: p.min_order,
      max_uses: p.max_uses || 0,
      start_date: p.start_date?.split("T")[0] || "",
      end_date: p.expires_at?.split("T")[0] || "",
      merchant_id: p.merchant_id,
      is_active: p.is_active
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.code.trim()) {
      showToast("Promo code is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code,
        type: form.type,
        value: form.value,
        min_order: form.min_order,
        max_uses: form.max_uses || null,
        start_date: form.start_date || null,
        expires_at: form.end_date || null,
        merchant_id: form.merchant_id || null,
        is_active: form.is_active
      };

      if (editId) {
        await api.put(`/admin/promos/${editId}`, payload);
        showToast("Promo code updated successfully", "success");
      } else {
        await api.post("/admin/promos", payload);
        showToast("Promo code created successfully", "success");
      }

      setModal(false);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to save promo code", "error");
    }
    setSaving(false);
  };

  const toggleActive = async (promo: PromoCode) => {
    try {
      await api.patch(`/admin/promos/${promo.id}`, { is_active: !promo.is_active });
      showToast(`Promo code ${!promo.is_active ? "activated" : "deactivated"}`, "success");
      load();
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to update status", "error");
    }
  };

  const openDeleteModal = (p: PromoCode) => {
    setDeleteTarget(p);
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await api.delete(`/admin/promos/${deleteTarget.id}`);
      showToast(`Promo code "${deleteTarget.code}" deleted successfully`, "success");
      setDeleteModal(false);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to delete promo code", "error");
    }
  };

  const isExpired = (d?: string | null) => d ? new Date(d) < new Date() : false;
  const isNotStarted = (d?: string | null) => d ? new Date(d) > new Date() : false;

  const getStatus = (p: PromoCode) => {
    if (!p.is_active) return "inactive";
    if (isExpired(p.expires_at)) return "expired";
    if (isNotStarted(p.start_date)) return "scheduled";
    return "active";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Active";
      case "inactive": return "Inactive";
      case "expired": return "Expired";
      case "scheduled": return "Scheduled";
      default: return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "status-delivered";
      case "inactive": return "status-cancelled";
      case "expired": return "status-cancelled";
      case "scheduled": return "status-pending";
      default: return "status-cancelled";
    }
  };

  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return "No expiry";
    const startStr = start ? new Date(start).toLocaleDateString() : "—";
    const endStr = end ? new Date(end).toLocaleDateString() : "—";
    if (start && end) return `${startStr} - ${endStr}`;
    if (end) return `Until ${endStr}`;
    return `From ${startStr}`;
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
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Promotions</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {promos.length} total promo codes
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          + Create Promotion
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th style={{ width: 100 }}>Type</th>
                <th style={{ width: 120 }}>Discount</th>
                <th style={{ width: 140 }}>Used/Max</th>
                <th style={{ width: 200 }}>Valid Period</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td colSpan={7}>
                    <div className="skeleton" style={{ height: 20, borderRadius: 4 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : promos.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
          <MdLocalOffer size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p className="text-base font-medium mb-2">No promo codes yet</p>
          <p className="text-sm">Create discount codes to reward your customers</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th style={{ width: 100 }}>Type</th>
                <th style={{ width: 120 }}>Discount</th>
                <th style={{ width: 140 }}>Used/Max</th>
                <th style={{ width: 200 }}>Valid Period</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 180, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const status = getStatus(p);

                return (
                  <tr key={p.id}>
                    <td>
                      <span
                        className="font-mono font-bold text-sm px-2 py-1 rounded"
                        style={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          color: "var(--text)"
                        }}
                      >
                        {p.code}
                      </span>
                      {isSuper && p.merchant_name && (
                        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
                          {p.merchant_name}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="text-xs px-2 py-1 rounded capitalize"
                        style={{
                          background: "var(--bg-secondary)",
                          color: "var(--text-secondary)"
                        }}
                      >
                        {p.type === "percent" ? "Percentage" : "Fixed"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: "var(--success)" }}>
                          {p.type === "percent" ? `${p.value}%` : `$${p.value}`}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        Min: ${parseFloat(String(p.min_order)).toFixed(2)}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ color: "var(--text)", fontSize: 14 }}>
                          {p.used_count || 0} / {p.max_uses || "∞"}
                        </span>
                        {p.max_uses && p.max_uses > 0 && (
                          <div
                            style={{
                              height: 4,
                              borderRadius: 2,
                              background: "var(--bg-secondary)",
                              marginTop: 4,
                              overflow: "hidden"
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(((p.used_count || 0) / p.max_uses) * 100, 100)}%`,
                                background: "var(--accent)",
                                transition: "width 0.3s"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {formatDateRange(p.start_date, p.expires_at)}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getStatusColor(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle Switch */}
                        <button
                          onClick={() => toggleActive(p)}
                          className="relative inline-flex items-center cursor-pointer"
                          title={p.is_active ? "Deactivate" : "Activate"}
                          style={{ width: 44, height: 24 }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 12,
                              background: p.is_active ? "var(--success)" : "var(--border)",
                              transition: "background 0.3s"
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "white",
                              transition: "transform 0.3s",
                              transform: p.is_active ? "translateX(23px)" : "translateX(3px)"
                            }}
                          />
                        </button>

                        <button
                          onClick={() => openEdit(p)}
                          className="btn btn-outline"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          title="Edit promo"
                        >
                          <MdEdit size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(p)}
                          className="btn btn-danger"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          title="Delete promo"
                        >
                          <MdDelete size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>
              {editId ? "Edit Promotion" : "Create New Promotion"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Promo Code *
                </label>
                <div className="flex gap-2">
                  <input
                    className="input font-mono flex-1"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE20"
                    style={{ textTransform: "uppercase" }}
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="btn btn-outline"
                    style={{ padding: "0 12px", display: "flex", alignItems: "center", gap: 6 }}
                    title="Auto-generate code"
                  >
                    <MdAutorenew size={18} /> Generate
                  </button>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
                  Use uppercase letters and numbers only
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Discount Type
                  </label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "flat" })}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    {form.type === "percent" ? "Percentage" : "Amount ($)"}
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: +e.target.value })}
                    min="0"
                    max={form.type === "percent" ? "100" : undefined}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Min Order Amount ($)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.min_order}
                    onChange={(e) => setForm({ ...form, min_order: +e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Max Uses (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: +e.target.value })}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Start Date (optional)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              {isSuper && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Merchant (optional - leave blank for global)
                  </label>
                  <select
                    className="input"
                    value={form.merchant_id}
                    onChange={(e) => setForm({ ...form, merchant_id: +e.target.value })}
                  >
                    <option value={0}>Global (All Merchants)</option>
                    {merchants.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    Active (customers can use this code immediately)
                  </span>
                </label>
              </div>
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
              Delete Promo Code?
            </h2>
            <p className="mb-1" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Are you sure you want to delete promo code <strong className="font-mono">{deleteTarget.code}</strong>?
            </p>
            {deleteTarget.used_count && deleteTarget.used_count > 0 ? (
              <p className="mt-2 mb-4" style={{ color: "var(--warning, #f59e0b)", fontSize: 13, fontWeight: 500 }}>
                This code has been used {deleteTarget.used_count} time{deleteTarget.used_count > 1 ? 's' : ''}.
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
                Delete Promo Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
