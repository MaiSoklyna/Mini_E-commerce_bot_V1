"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { User, Pagination } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<User | null>(null);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users", { params: { page, limit: 20, search } });
      setUsers(res.data.data || []);
      setPagination(res.data.meta || { page, limit: 20, total: 0, total_pages: 0 });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [search]);

  const openDetail = async (id: number) => {
    try {
      const res = await api.get(`/admin/users/${id}`);
      setDetail(res.data.data);
    } catch (e) { console.error(e); }
  };

  const toggleStatus = async (id: number, is_active: boolean) => {
    await api.patch(`/admin/users/${id}/status`, { is_active });
    load(pagination.page);
  };

  const statusBadge = (active?: boolean) => active === false
    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold status-cancelled">Banned</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold status-delivered">Active</span>;

  return (
    <div className="animate-in">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Customers</h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pagination.total} registered users</p>
      </div>

      <input className="input mb-4" style={{ maxWidth: 300 }} placeholder="Search by name, username..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading...</div> : (
          <table className="table">
            <thead><tr><th>User</th><th>Phone</th><th>Language</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--text-muted)" }}>No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <p className="font-medium" style={{ color: "var(--text)" }}>{u.first_name || u.username || `User #${u.id}`}{u.last_name ? ` ${u.last_name}` : ""}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>@{u.username || "—"}</p>
                  </td>
                  <td>{u.phone || u.email || "—"}</td>
                  <td>{u.language || "—"}</td>
                  <td>{statusBadge(u.is_active)}</td>
                  <td style={{ color: "var(--text-muted)" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td><button onClick={() => openDetail(u.id)} className="text-xs font-medium" style={{ color: "var(--info)" }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => load(p)} className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: 12, background: p === pagination.page ? "var(--accent)" : undefined, color: p === pagination.page ? "var(--bg)" : undefined }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }} onClick={() => setDetail(null)}>
          <div className="card animate-in" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{detail.first_name || detail.username || `User #${detail.id}`}</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>@{detail.username || "—"}</p>
              </div>
              {statusBadge(detail.is_active)}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4" style={{ fontSize: 12 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Telegram ID:</span> <span style={{ color: "var(--text)" }}>{detail.telegram_id || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Language:</span> <span style={{ color: "var(--text)" }}>{detail.language || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Phone:</span> <span style={{ color: "var(--text)" }}>{detail.phone || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Email:</span> <span style={{ color: "var(--text)" }}>{detail.email || "—"}</span></div>
              {detail.address && <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>Address:</span> <span style={{ color: "var(--text)" }}>{detail.address}</span></div>}
            </div>
            {detail.orders && detail.orders.length > 0 && (
              <>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>ORDER HISTORY</h4>
                {detail.orders.map((o) => (
                  <div key={o.id} className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
                    <span style={{ color: "var(--text)" }}>{o.order_code || `#${o.id}`}</span>
                    <span className="font-medium">${o.total}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${o.status === "delivered" ? "status-delivered" : o.status === "cancelled" ? "status-cancelled" : "status-pending"}`}>{o.status}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { toggleStatus(detail.id, !detail.is_active); setDetail(null); }}
                className={`btn ${detail.is_active ? "btn-danger" : "btn-primary"}`} style={{ fontSize: 12 }}>
                {detail.is_active ? "Ban User" : "Unban User"}
              </button>
              <button onClick={() => setDetail(null)} className="btn btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
