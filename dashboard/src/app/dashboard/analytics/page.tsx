"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { MdAttachMoney, MdShoppingCart, MdPeople, MdTrendingUp, MdTrendingDown } from "react-icons/md";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface KPIData {
  revenue: number;
  revenue_change: number;
  orders: number;
  orders_change: number;
  new_users: number;
  new_users_change: number;
  avg_order_value: number;
  avg_order_value_change: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

interface OrderStatusData {
  status: string;
  count: number;
  value: number;
}

interface TopProduct {
  id: number;
  name: string;
  product_name?: string;
  merchant_name?: string;
  units_sold: number;
  total_sold?: number;
  revenue: number;
  total_revenue?: number;
}

interface TopMerchant {
  id: number;
  name: string;
  orders: number;
  revenue: number;
  rating: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  processing: "#6366F1",
  shipped: "#10B981",
  delivered: "#047857",
  cancelled: "#EF4444",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [kpiData, setKpiData] = useState<KPIData>({
    revenue: 0,
    revenue_change: 0,
    orders: 0,
    orders_change: 0,
    new_users: 0,
    new_users_change: 0,
    avg_order_value: 0,
    avg_order_value_change: 0
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = period === "custom" && customRange.start && customRange.end
        ? { start: customRange.start, end: customRange.end }
        : { period };

      const [kpiRes, revenueRes, statusRes, productsRes, merchantsRes] = await Promise.all([
        api.get("/admin/analytics/kpi", { params }).catch(() => ({ data: { data: {} } })),
        api.get("/admin/analytics/revenue", { params }),
        api.get("/admin/analytics/orders-status", { params }).catch(() => ({ data: { data: [] } })),
        api.get("/admin/analytics/top-products", { params: { ...params, limit: 10 } }),
        api.get("/admin/analytics/top-merchants", { params: { ...params, limit: 10 } }).catch(() => ({ data: { data: [] } })),
      ]);

      setKpiData(kpiRes.data.data || kpiRes.data || {});
      setRevenueData(revenueRes.data.data || []);
      setOrderStatusData(statusRes.data.data || []);
      setTopProducts(productsRes.data.data || []);
      setTopMerchants(merchantsRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [period, customRange]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (newPeriod === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
  };

  const renderKPICard = (
    title: string,
    value: number,
    change: number,
    icon: React.ReactNode,
    iconBg: string,
    formatter: (v: number) => string = (v) => v.toLocaleString()
  ) => (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {icon}
        </div>
        <div className="flex items-center gap-1">
          {change !== 0 && (
            <>
              {change > 0 ? (
                <MdTrendingUp size={18} style={{ color: "var(--success)" }} />
              ) : (
                <MdTrendingDown size={18} style={{ color: "var(--danger)" }} />
              )}
              <span
                className="text-xs font-semibold"
                style={{ color: change > 0 ? "var(--success)" : "var(--danger)" }}
              >
                {change > 0 ? "+" : ""}{change.toFixed(1)}%
              </span>
            </>
          )}
        </div>
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
        {formatter(value)}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{title}</p>
    </div>
  );

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Revenue & performance insights
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="flex gap-2 items-center">
          {["7d", "30d", "month", "custom"].map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: period === p ? "var(--accent)" : "var(--bg-secondary)",
                color: period === p ? "white" : "var(--text-secondary)",
                border: `1px solid ${period === p ? "var(--accent)" : "var(--border)"}`
              }}
            >
              {p === "7d" ? "Last 7 Days" : p === "30d" ? "Last 30 Days" : p === "month" ? "This Month" : "Custom"}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      {showCustom && (
        <div className="card mb-4">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Start Date
              </label>
              <input
                type="date"
                className="input"
                value={customRange.start}
                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>
                End Date
              </label>
              <input
                type="date"
                className="input"
                value={customRange.end}
                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          Loading analytics...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {renderKPICard(
              "Total Revenue",
              kpiData.revenue || 0,
              kpiData.revenue_change || 0,
              <MdAttachMoney size={24} color="white" />,
              "#10B981",
              (v) => `$${v.toLocaleString()}`
            )}
            {renderKPICard(
              "Total Orders",
              kpiData.orders || 0,
              kpiData.orders_change || 0,
              <MdShoppingCart size={24} color="white" />,
              "#3B82F6"
            )}
            {renderKPICard(
              "New Users",
              kpiData.new_users || 0,
              kpiData.new_users_change || 0,
              <MdPeople size={24} color="white" />,
              "#6366F1"
            )}
            {renderKPICard(
              "Avg Order Value",
              kpiData.avg_order_value || 0,
              kpiData.avg_order_value_change || 0,
              <MdTrendingUp size={24} color="white" />,
              "#F59E0B",
              (v) => `$${v.toFixed(2)}`
            )}
          </div>

          {/* Revenue Chart */}
          <div className="card mb-6">
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
              Revenue Over Time
            </h3>
            {revenueData.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                No revenue data for this period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    style={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12
                    }}
                    formatter={(value: any, name: string) =>
                      name === "revenue" ? `$${value}` : value
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: "#10B981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order Status Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
                Order Status Distribution
              </h3>
              {orderStatusData.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                  No order data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="count"
                      label={(entry) => `${entry.status}: ${entry.count}`}
                      labelLine={false}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || "#999"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Merchants */}
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
                Top Merchants
              </h3>
              {topMerchants.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                  No merchant data
                </p>
              ) : (
                <div style={{ maxHeight: 280, overflow: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Merchant</th>
                        <th style={{ width: 80, textAlign: "center" }}>Orders</th>
                        <th style={{ width: 100, textAlign: "right" }}>Revenue</th>
                        <th style={{ width: 80, textAlign: "center" }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topMerchants.map((m, i) => (
                        <tr key={m.id}>
                          <td>
                            <span
                              className="font-bold"
                              style={{
                                color: i < 3 ? "var(--accent)" : "var(--text-muted)",
                                fontSize: 14
                              }}
                            >
                              {i + 1}
                            </span>
                          </td>
                          <td>
                            <span className="font-medium" style={{ color: "var(--text)", fontSize: 13 }}>
                              {m.name}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ color: "var(--text)", fontSize: 13 }}>
                              {m.orders}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="font-semibold" style={{ color: "var(--success)", fontSize: 13 }}>
                              ${m.revenue.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ color: "var(--warning, #F59E0B)", fontSize: 13 }}>
                              ⭐ {m.rating ? m.rating.toFixed(1) : "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
              Top Products
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                No product data
              </p>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Rank</th>
                      <th>Product</th>
                      <th>Merchant</th>
                      <th style={{ width: 120, textAlign: "center" }}>Units Sold</th>
                      <th style={{ width: 140, textAlign: "right" }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <div
                            className="font-bold flex items-center justify-center"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: i < 3 ? "var(--accent)" : "var(--bg-secondary)",
                              color: i < 3 ? "white" : "var(--text-muted)",
                              fontSize: 13
                            }}
                          >
                            {i + 1}
                          </div>
                        </td>
                        <td>
                          <span className="font-semibold" style={{ color: "var(--text)" }}>
                            {p.name || p.product_name}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                            {p.merchant_name || "—"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="font-semibold" style={{ color: "var(--text)" }}>
                            {p.units_sold || p.total_sold || 0}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="font-bold" style={{ color: "var(--success)", fontSize: 15 }}>
                            ${(p.revenue || p.total_revenue || 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
