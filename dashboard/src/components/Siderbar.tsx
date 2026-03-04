"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { User } from "@/types";

interface Props { user: User; onLogout: () => void; open: boolean; onClose: () => void; }

const menu = [
  { path: "/dashboard", icon: "◻", label: "Dashboard", exact: true },
  { path: "/dashboard/orders", icon: "◻", label: "Orders" },
  { path: "/dashboard/products", icon: "◻", label: "Products" },
  { path: "/dashboard/categories", icon: "◻", label: "Categories", superOnly: true },
  { path: "/dashboard/merchants", icon: "◻", label: "Merchants", superOnly: true },
  { path: "/dashboard/users", icon: "◻", label: "Users", superOnly: true },
  { path: "/dashboard/support", icon: "◻", label: "Support" },
  { path: "/dashboard/invoices", icon: "◻", label: "Invoices" },
  { path: "/dashboard/promotions", icon: "◻", label: "Promotions", superOnly: true },
  { path: "/dashboard/analytics", icon: "◻", label: "Analytics" },
  { path: "/dashboard/settings", icon: "◻", label: "Settings" },
];

const icons: Record<string, string> = {
  Dashboard: "📊", Orders: "📦", Products: "🏷", Categories: "📂",
  Merchants: "🏪", Users: "👥", Support: "💬", Invoices: "🧾",
  Promotions: "🎁", Analytics: "📈", Settings: "⚙️",
};

export default function Sidebar({ user, onLogout, open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  
  const isSuper = user?.role === "super_admin" || user?.role === "admin";
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  const filtered = menu.filter((m) => !m.superOnly || isSuper);

  function isActive(item: (typeof menu)[0]) {
    return item.exact ? pathname === item.path : pathname.startsWith(item.path);
  }

  function go(path: string) { router.push(path); onClose(); }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 240, background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}>

        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
               style={{ background: "var(--accent)", color: "var(--bg)" }}>F</div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Favourite of Shop</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {isSuper ? "Super Admin" : "Merchant"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: "var(--text-muted)" }}>Menu</p>
          {filtered.map((item) => (
            <button key={item.path} onClick={() => go(item.path)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-left"
              style={{
                background: isActive(item) ? "var(--accent-light)" : "transparent",
                color: isActive(item) ? "var(--sidebar-active)" : "var(--sidebar-text)",
                fontWeight: isActive(item) ? 600 : 400,
              }}>
              <span className="text-sm">{icons[item.label]}</span>
              <span className="text-[13px]">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-2"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            <span className="text-sm">{theme === "dark" ? "☀️" : "🌙"}</span>
            <span className="text-[13px]">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                 style={{ background: "var(--accent)", color: "var(--bg)" }}>
              {user?.first_name?.[0] || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text)" }}>
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>@{user?.username}</p>
            </div>
          </div>

          <button onClick={onLogout}
            className="w-full py-2 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--bg-hover)", color: "var(--danger)" }}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}