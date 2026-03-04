"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminUser } from "@/types";
import {
  MdStore, MdInventory2, MdShoppingCart, MdAttachMoney,
  MdPeople, MdLocalOffer, MdBarChart, MdCategory,
} from "react-icons/md";

const statusColors: Record<string, string> = {
  pending: "status-pending", confirmed: "status-confirmed", processing: "status-processing",
  shipped: "status-shipped", delivered: "status-delivered", cancelled: "status-cancelled",
};

function IconBox({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 10, background: color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={20} color="#fff" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = localStorage.getItem("admin_user");
    if (d) setUser(JSON.parse(d));
    api.get("/admin/dashboard")
      .then((r) => setStats(r.data.data || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isSuper = user?.role === "super_admin";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
    </div>
  );

  const cards = isSuper ? [
    { label: "Merchants", value: stats?.total_merchants ?? 0, sub: stats?.pending_merchants ? `${stats.pending_merchants} pending` : null, icon: MdStore, color: "#6366f1" },
    { label: "Products",  value: stats?.total_products  ?? 0, icon: MdInventory2,   color: "#8b5cf6" },
    { label: "Orders",    value: stats?.total_orders    ?? 0, icon: MdShoppingCart, color: "#3b82f6" },
    { label: "Revenue",   value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`, icon: MdAttachMoney, color: "#10b981" },
    { label: "Customers", value: stats?.total_customers ?? 0, icon: MdPeople,       color: "#f59e0b" },
  ] : [
    { label: "Products", value: stats?.total_products ?? 0, icon: MdInventory2,   color: "#8b5cf6" },
    { label: "Orders",   value: stats?.total_orders   ?? 0, icon: MdShoppingCart, color: "#3b82f6" },
    { label: "Revenue",  value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`, icon: MdAttachMoney, color: "#10b981" },
  ];

  const actions = [
    { label: "Orders",     icon: MdShoppingCart, color: "#3b82f6", path: "/dashboard/orders" },
    { label: "Products",   icon: MdInventory2,   color: "#8b5cf6", path: "/dashboard/products" },
    { label: "Promotions", icon: MdLocalOffer,   color: "#f59e0b", path: "/dashboard/promotions" },
    { label: "Analytics",  icon: MdBarChart,     color: "#6366f1", path: "/dashboard/analytics" },
    ...(isSuper ? [
      { label: "Merchants",  icon: MdStore,    color: "#ec4899", path: "/dashboard/merchants" },
      { label: "Categories", icon: MdCategory, color: "#14b8a6", path: "/dashboard/categories" },
    ] : []),
  ];

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Dashboard</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Welcome back, {user?.name} · {isSuper ? "Super Admin" : "Merchant Admin"}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {cards.map((c: any, i) => (
          <div key={i} className="card flex items-center gap-3">
            <IconBox icon={c.icon} color={c.color} />
            <div>
              <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{c.value}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{c.label}</p>
              {c.sub && <p className="text-[10px]" style={{ color: "#f59e0b" }}>{c.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card mb-6">
        <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>QUICK ACTIONS</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => router.push(a.path)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color="#fff" />
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Orders */}
      {stats?.recent_orders && stats.recent_orders.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>RECENT ORDERS</h3>
            <button onClick={() => router.push("/dashboard/orders")} className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}>View All →</button>
          </div>
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {stats.recent_orders.slice(0, 8).map((o: any) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => router.push("/dashboard/orders")}>
                  <td className="font-medium">{o.order_code || `#${o.id}`}</td>
                  <td>{o.customer_name || "—"}</td>
                  <td className="font-semibold">${o.total}</td>
                  <td>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[o.status] || ""}`}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
