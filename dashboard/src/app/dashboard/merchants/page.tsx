"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Merchant } from "@/types";
import { MdStore, MdEdit, MdCheckCircle, MdBlock, MdRestore, MdClose } from "react-icons/md";

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

interface MerchantDetail extends Merchant {
  recent_orders?: any[];
  recent_products?: any[];
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    description: "",
    tagline: "",
    icon_emoji: "",
    plan: "basic",
    status: "active"
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/merchants", {
        params: { limit: 100, search: search || undefined, status: filterStatus || undefined }
      });
      setMerchants(res.data.data || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load merchants", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [search]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      name: "",
      owner_name: "",
      email: "",
      phone: "",
      description: "",
      tagline: "",
      icon_emoji: "",
      plan: "basic",
      status: "active"
    });
    setModal(true);
  };

  const openEdit = (m: Merchant) => {
    setEditId(m.id);
    setForm({
      name: m.name,
      owner_name: m.owner_name || "",
      email: m.email || "",
      phone: m.phone || "",
      description: m.description || "",
      tagline: m.tagline || "",
      icon_emoji: m.icon_emoji || "",
      plan: m.plan || "basic",
      status: m.status || "active"
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.owner_name.trim() || !form.email.trim()) {
      showToast("Name, owner and email are required", "error");
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/merchants/${editId}`, form);
        showToast("Merchant updated successfully", "success");
      } else {
        await api.post("/admin/merchants", form);
        showToast("Merchant created successfully", "success");
      }
      setModal(false);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to save merchant", "error");
    }
    setSaving(false);
  };

  const changeStatus = async (id: number, status: string) => {
    const msg =
      status === "active" ? "Approve this merchant?" :
      status === "suspended" ? "Suspend this merchant?" :
      "Restore this merchant?";

    if (!confirm(msg)) return;

    try {
      await api.patch(`/admin/merchants/${id}/status`, { status });
      showToast(`Merchant ${status === "active" ? "activated" : status === "suspended" ? "suspended" : "updated"}`, "success");
      load();
      if (selectedMerchant && selectedMerchant.id === id) {
        loadMerchantDetail(id);
      }
    } catch (e: any) {
      showToast(e.response?.data?.detail || "Failed to update status", "error");
    }
  };

  const loadMerchantDetail = async (id: number) => {
    setLoadingDetail(true);
    setDetailDrawer(true);
    try {
      const [merchantRes, productsRes, ordersRes] = await Promise.all([
        api.get(`/admin/merchants/${id}`),
        api.get(`/admin/products?merchant_id=${id}&limit=5`),
        api.get(`/admin/orders?merchant_id=${id}&limit=5`)
      ]);

      setSelectedMerchant({
        ...(merchantRes.data.data || merchantRes.data),
        recent_products: productsRes.data.data || [],
        recent_orders: ordersRes.data.data || []
      });
    } catch (e) {
      console.error(e);
      showToast("Failed to load merchant details", "error");
      setDetailDrawer(false);
    }
    setLoadingDetail(false);
  };

  const statusColor = (s: string) =>
    s === "active" ? "status-delivered" :
    s === "pending-review" ? "status-pending" :
    "status-cancelled";

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
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Merchants</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {merchants.length} total merchants
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          + Add Merchant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search by name, owner, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending-review">Pending Review</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Logo</th>
                <th>Name</th>
                <th>Owner</th>
                <th style={{ width: 100 }}>Plan</th>
                <th style={{ width: 100 }}>Products</th>
                <th style={{ width: 100 }}>Orders</th>
                <th style={{ width: 120 }}>Revenue</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td colSpan={9}>
                    <div className="skeleton" style={{ height: 20, borderRadius: 4 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : merchants.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
          <MdStore size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p className="text-base font-medium mb-2">No merchants found</p>
          <p className="text-sm">
            {search || filterStatus ? "Try adjusting your filters" : "Create your first merchant to get started"}
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Logo</th>
                <th>Name</th>
                <th>Owner</th>
                <th style={{ width: 100 }}>Plan</th>
                <th style={{ width: 90, textAlign: "center" }}>Products</th>
                <th style={{ width: 80, textAlign: "center" }}>Orders</th>
                <th style={{ width: 110, textAlign: "right" }}>Revenue</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 220, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => loadMerchantDetail(m.id)}>
                  <td>
                    {m.icon_emoji ? (
                      <span style={{ fontSize: 28 }}>{m.icon_emoji}</span>
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "var(--bg-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <MdStore size={20} style={{ color: "var(--text-muted)" }} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div>
                      <span className="font-semibold" style={{ color: "var(--text)", display: "block" }}>
                        {m.name}
                      </span>
                      {m.tagline && (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                          {m.tagline}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <span style={{ color: "var(--text)", fontSize: 13, display: "block" }}>
                        {m.owner_name}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {m.email}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded capitalize"
                      style={{
                        background: "var(--bg-secondary)",
                        color: "var(--accent)"
                      }}
                    >
                      {m.plan || "basic"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>
                      {m.product_count ?? 0}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>
                      {m.order_count ?? 0}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="font-bold" style={{ color: "var(--success)", fontSize: 14 }}>
                      ${m.total_revenue ? parseFloat(String(m.total_revenue)).toFixed(2) : "0.00"}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(m)}
                        className="btn btn-outline"
                        style={{ padding: "6px 10px", fontSize: 11 }}
                        title="Edit merchant"
                      >
                        <MdEdit size={14} />
                      </button>
                      {m.status === "pending-review" && (
                        <button
                          onClick={() => changeStatus(m.id, "active")}
                          className="btn btn-primary"
                          style={{ padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                          title="Approve"
                        >
                          <MdCheckCircle size={14} /> Approve
                        </button>
                      )}
                      {m.status === "active" && (
                        <button
                          onClick={() => changeStatus(m.id, "suspended")}
                          className="btn btn-danger"
                          style={{ padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                          title="Suspend"
                        >
                          <MdBlock size={14} /> Suspend
                        </button>
                      )}
                      {m.status === "suspended" && (
                        <button
                          onClick={() => changeStatus(m.id, "active")}
                          className="btn btn-primary"
                          style={{ padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                          title="Restore"
                        >
                          <MdRestore size={14} /> Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
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
              {editId ? "Edit Merchant" : "Create New Merchant"}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Shop Name *
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="My Shop"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Owner Name *
                  </label>
                  <input
                    className="input"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="owner@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Phone
                  </label>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+855 12 345 678"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Tagline
                </label>
                <input
                  className="input"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Your trusted online store"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell customers about your store..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Emoji Icon
                  </label>
                  <input
                    className="input"
                    style={{ fontSize: 20 }}
                    value={form.icon_emoji}
                    onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })}
                    placeholder="🏪"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Plan
                  </label>
                  <select
                    className="input"
                    value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Status
                  </label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="pending-review">Pending Review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
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

      {/* Detail Drawer */}
      {detailDrawer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 65,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "flex-end"
          }}
          onClick={() => setDetailDrawer(false)}
        >
          <div
            className="animate-in"
            style={{
              width: "100%",
              maxWidth: 500,
              background: "var(--bg)",
              height: "100vh",
              overflow: "auto",
              boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
              animation: "slideInRight 0.3s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div style={{ padding: 24 }}>
                <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 100 }} />
              </div>
            ) : selectedMerchant ? (
              <div>
                {/* Header */}
                <div style={{ padding: 24, borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {selectedMerchant.icon_emoji ? (
                        <span style={{ fontSize: 40 }}>{selectedMerchant.icon_emoji}</span>
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MdStore size={28} style={{ color: "var(--text-muted)" }} />
                        </div>
                      )}
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>{selectedMerchant.name}</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{selectedMerchant.owner_name}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailDrawer(false)} style={{ padding: 8 }}>
                      <MdClose size={24} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize inline-block mt-3 ${statusColor(selectedMerchant.status)}`}>
                    {selectedMerchant.status}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Statistics</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card" style={{ textAlign: "center", padding: 16 }}>
                      <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{selectedMerchant.product_count ?? 0}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Products</p>
                    </div>
                    <div className="card" style={{ textAlign: "center", padding: 16 }}>
                      <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{selectedMerchant.order_count ?? 0}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Orders</p>
                    </div>
                    <div className="card" style={{ textAlign: "center", padding: 16 }}>
                      <p className="text-xl font-bold" style={{ color: "var(--success)" }}>${selectedMerchant.total_revenue ? parseFloat(String(selectedMerchant.total_revenue)).toFixed(2) : "0.00"}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Revenue</p>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Email</span>
                      <span style={{ color: "var(--text)" }}>{selectedMerchant.email || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Phone</span>
                      <span style={{ color: "var(--text)" }}>{selectedMerchant.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Plan</span>
                      <span className="capitalize font-semibold" style={{ color: "var(--accent)" }}>{selectedMerchant.plan || "basic"}</span>
                    </div>
                    {selectedMerchant.tagline && (
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>Tagline</span>
                        <span style={{ color: "var(--text)" }}>{selectedMerchant.tagline}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Products */}
                {selectedMerchant.recent_products && selectedMerchant.recent_products.length > 0 && (
                  <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
                    <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Recent Products</h3>
                    <div className="space-y-2">
                      {selectedMerchant.recent_products.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded" style={{ background: "var(--bg-secondary)" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--bg)", overflow: "hidden" }}>
                            {p.primary_image ? (
                              <img src={p.primary_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 10 }}>
                                📦
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" style={{ color: "var(--text)", fontSize: 13 }}>{p.name}</p>
                            <p style={{ color: "var(--text-muted)", fontSize: 11 }}>${parseFloat(p.price).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Orders */}
                {selectedMerchant.recent_orders && selectedMerchant.recent_orders.length > 0 && (
                  <div style={{ padding: 24 }}>
                    <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Recent Orders</h3>
                    <div className="space-y-2">
                      {selectedMerchant.recent_orders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--bg-secondary)" }}>
                          <div>
                            <p className="font-medium" style={{ color: "var(--text)", fontSize: 13 }}>#{o.order_code || o.id}</p>
                            <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{new Date(o.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold" style={{ color: "var(--accent)", fontSize: 14 }}>${parseFloat(o.total).toFixed(2)}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor(o.status)}`}>
                              {o.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
