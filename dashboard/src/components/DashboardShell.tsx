"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminUser } from "@/types";
import {
  MdDashboard,
  MdShoppingCart,
  MdInventory2,
  MdCategory,
  MdStore,
  MdPeople,
  MdLocalOffer,
  MdBarChart,
  MdSettings,
  MdLogout,
  MdMenu,
  MdChevronLeft,
  MdChevronRight,
  MdLightMode,
  MdDarkMode,
  MdChat,
} from "react-icons/md";

const menu = [
  { path: "/dashboard", icon: MdDashboard, label: "Dashboard", exact: true },
  { path: "/dashboard/orders", icon: MdShoppingCart, label: "Orders" },
  { path: "/dashboard/products", icon: MdInventory2, label: "Products" },
  { path: "/dashboard/categories", icon: MdCategory, label: "Categories" },
  { path: "/dashboard/promotions", icon: MdLocalOffer, label: "Promotions" },
  { path: "/dashboard/analytics", icon: MdBarChart, label: "Analytics" },
  { path: "/dashboard/support", icon: MdChat, label: "Support" },
  { path: "/dashboard/merchants", icon: MdStore, label: "Merchants", superOnly: true },
  { path: "/dashboard/users", icon: MdPeople, label: "Users", superOnly: true },
  { path: "/dashboard/settings", icon: MdSettings, label: "Settings" },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const data = localStorage.getItem("admin_user");
    if (!token || !data) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(data));
    } catch {
      router.replace("/login");
    }
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setDark(!dark);
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.replace("/login");
  };

  const isSuper = user?.role === "super_admin";
  const filtered = menu.filter((m) => !m.superOnly || isSuper);

  const isActive = (item: (typeof menu)[0]) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  if (!user)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? 64 : 230,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s, transform 0.2s",
          position: mobileOpen ? "fixed" : undefined,
          zIndex: mobileOpen ? 50 : undefined,
          height: "100vh",
          transform: mobileOpen ? "translateX(0)" : undefined,
        }}
        className={`hidden md:flex ${mobileOpen ? "!flex !fixed !z-50" : ""}`}
      >
        {/* Logo */}
        <div
          style={{
            padding: collapsed ? "16px 8px" : "16px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
              letterSpacing: 1,
            }}
          >
            FS
          </div>
          {!collapsed && (
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", display: "block" }}>
                Favourite Shop
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>
                {isSuper ? "Platform Admin" : user.merchant_name || "Merchant"}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {!collapsed && (
            <div style={{ padding: "4px 10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--text-muted)" }}>
              Menu
            </div>
          )}
          {filtered.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  setMobileOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: collapsed ? "10px 0" : "9px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "var(--accent-light)" : "transparent",
                  color: active ? "var(--sidebar-active)" : "var(--sidebar-text)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  marginBottom: 2,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
                title={collapsed ? item.label : ""}
              >
                <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: collapsed ? "8px 4px" : "8px 10px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <MdChevronRight size={20} /> : <MdChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header
          style={{
            height: 54,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            background: "var(--bg)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden"
              style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center" }}
            >
              <MdMenu size={22} />
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
              {filtered.find((m) => isActive(m))?.label || "Dashboard"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <MdLightMode size={16} color="var(--text)" /> : <MdDarkMode size={16} color="var(--text)" />}
            </button>

            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{user.name}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.2 }}>
                  {isSuper ? "Super Admin" : user.merchant_name || "Merchant Admin"}
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MdLogout size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}