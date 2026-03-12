"use client";
import { useState, useEffect } from "react";
import * as orderService from "@/services/orderService";
import { Order, Pagination } from "@/types";

const statusColors: Record<string, string> = {
  pending: "status-pending", confirmed: "status-confirmed", processing: "status-processing",
  shipped: "status-shipped", delivered: "status-delivered", cancelled: "status-cancelled",
};
const tabs = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const nextStatus: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"], confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"], shipped: ["delivered"],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await orderService.listOrders({ page, limit: 20, search, status: tab === "all" ? undefined : tab });
      setOrders(res.data || []);
      setPagination(res.meta || { page, limit: 20, total: 0, total_pages: 0 });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => { const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [search]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const data = await orderService.getOrder(id);
      setDetail(data);
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await orderService.updateOrderStatus(id, status);
    if (detail?.id === id) openDetail(id);
    load(pagination.page);
  };

  return (
    <div className="animate-in">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Orders</h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pagination.total} orders</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
            style={{ background: tab === t ? "var(--accent)" : "var(--bg-secondary)", color: tab === t ? "var(--bg)" : "var(--text-secondary)", border: `1px solid ${tab === t ? "var(--accent)" : "var(--border)"}` }}>
            {t}
          </button>
        ))}
      </div>

      <input className="input mb-4" style={{ maxWidth: 300 }} placeholder="Search by order code or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading...</div> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--text-muted)" }}>No orders found</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.order_code || `#${o.id}`}</td>
                  <td>
                    <p style={{ color: "var(--text)" }}>{o.customer_name || "—"}</p>
                    {o.customer_phone && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{o.customer_phone}</p>}
                  </td>
                  <td className="font-semibold">${o.total}</td>
                  <td><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[o.status] || ""}`}>{o.status}</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <button onClick={() => openDetail(o.id)} className="text-xs font-medium" style={{ color: "var(--info)" }}>View</button>
                    {nextStatus[o.status]?.map((s) => (
                      <button key={s} onClick={() => updateStatus(o.id, s)} className="text-xs font-medium ml-2 capitalize"
                        style={{ color: s === "cancelled" ? "var(--danger)" : "var(--success)" }}>
                        {s === "cancelled" ? "Cancel" : s}
                      </button>
                    ))}
                  </td>
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

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }} onClick={() => setDetail(null)}>
          <div className="card animate-in" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{detail.order_code || `Order #${detail.id}`}</h2>
                {detail.merchant_name && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{detail.merchant_name}</p>}
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[detail.status] || ""}`}>{detail.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4" style={{ fontSize: 12 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Customer:</span> <span style={{ color: "var(--text)" }}>{detail.customer_name || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Phone:</span> <span style={{ color: "var(--text)" }}>{detail.customer_phone || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Subtotal:</span> <span style={{ color: "var(--text)" }}>${detail.subtotal}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Total:</span> <span className="font-bold" style={{ color: "var(--text)" }}>${detail.total}</span></div>
              {(detail.discount_amount ?? 0) > 0 && (
                <div><span style={{ color: "var(--text-muted)" }}>Discount:</span> <span style={{ color: "var(--success)" }}>-${detail.discount_amount}</span></div>
              )}
              <div><span style={{ color: "var(--text-muted)" }}>Payment:</span> <span style={{ color: "var(--text)" }}>{detail.payment_method || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Date:</span> <span style={{ color: "var(--text)" }}>{detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"}</span></div>
              {detail.delivery_province && <div><span style={{ color: "var(--text-muted)" }}>Province:</span> <span style={{ color: "var(--text)" }}>{detail.delivery_province}</span></div>}
              {detail.delivery_address && <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>Address:</span> <span style={{ color: "var(--text)" }}>{detail.delivery_address}</span></div>}
              {detail.customer_note && <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>Note:</span> <span style={{ color: "var(--text)", fontStyle: "italic" }}>{detail.customer_note}</span></div>}
            </div>

            {detail.items && detail.items.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>ITEMS</h4>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
                    <span style={{ color: "var(--text)" }}>{item.product_name} × {item.quantity}</span>
                    <span className="font-medium" style={{ color: "var(--text)" }}>${item.subtotal}</span>
                  </div>
                ))}
              </div>
            )}

            {nextStatus[detail.status] && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {nextStatus[detail.status].map((s) => (
                  <button key={s} onClick={() => updateStatus(detail.id, s)}
                    className={`btn ${s === "cancelled" ? "btn-danger" : "btn-primary"} capitalize`} style={{ fontSize: 12 }}>
                    {s === "cancelled" ? "Cancel Order" : `Mark as ${s}`}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setDetail(null)} className="btn btn-outline w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
