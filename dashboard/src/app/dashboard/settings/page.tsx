"use client";
import { useState, useEffect } from "react";
import * as authService from "@/services/authService";
import * as settingsService from "@/services/settingsService";
import { MdSmartToy, MdInfo } from "react-icons/md";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm: "" });
  const [bot, setBot] = useState({ telegram_token: "", deep_link_code: "" });
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    const d = localStorage.getItem("admin_user");
    if (d) {
      const u = JSON.parse(d);
      setUser(u);
      setProfile({ name: u.name || "", email: u.email || "" });
    }
  }, []);

  const isSuper = user?.role === "super_admin";
  const isMerchant = user?.role === "merchant";

  const flash = (type: string, text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 4000);
  };

  const updateProfileFn = async () => {
    setSaving("profile"); setMsg({ type: "", text: "" });
    try {
      const token = localStorage.getItem("admin_token") || "";
      await authService.updateProfile(token, profile);
      const updated = { ...user, ...profile };
      localStorage.setItem("admin_user", JSON.stringify(updated));
      setUser(updated);
      flash("success", "Profile updated successfully");
    } catch (e: any) { flash("error", e.response?.data?.detail || e.message || "Update failed"); }
    setSaving("");
  };

  const changePasswordFn = async () => {
    if (passwords.new_password !== passwords.confirm) return flash("error", "Passwords don't match");
    if (passwords.new_password.length < 6) return flash("error", "Minimum 6 characters required");
    setSaving("password"); setMsg({ type: "", text: "" });
    try {
      const token = localStorage.getItem("admin_token") || "";
      await authService.changePassword(token, { current_password: passwords.current_password, new_password: passwords.new_password });
      setPasswords({ current_password: "", new_password: "", confirm: "" });
      flash("success", "Password changed successfully");
    } catch (e: any) { flash("error", e.response?.data?.detail || e.message || "Password change failed"); }
    setSaving("");
  };

  const updateBot = async () => {
    setSaving("bot"); setMsg({ type: "", text: "" });
    try {
      if (!user?.merchant_id) throw new Error("No merchant ID");
      await settingsService.updateBotSettings(user.merchant_id, bot);
      flash("success", "Bot settings saved");
    } catch (e: any) { flash("error", e.response?.data?.detail || e.message || "Failed to save bot settings"); }
    setSaving("");
  };

  return (
    <div className="animate-in">
      <h1 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>Settings</h1>

      {msg.text && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: msg.type === "success" ? "var(--success)" : "var(--danger)", color: "#fff" }}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Profile */}
        <div className="card">
          <h3 className="text-xs font-semibold mb-4" style={{ color: "var(--text-muted)" }}>PROFILE</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
              {profile.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{profile.name || "Admin"}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isSuper ? "Super Admin" : "Merchant Admin"}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Display Name</label>
              <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input type="email" className="input" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
          </div>
          <button onClick={updateProfileFn} disabled={saving === "profile"} className="btn btn-primary mt-4" style={{ fontSize: 12 }}>
            {saving === "profile" ? "Saving..." : "Update Profile"}
          </button>
        </div>

        {/* Password */}
        <div className="card">
          <h3 className="text-xs font-semibold mb-4" style={{ color: "var(--text-muted)" }}>CHANGE PASSWORD</h3>
          <div className="space-y-3">
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Current Password</label>
              <input type="password" className="input" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></div>
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>New Password</label>
              <input type="password" className="input" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} /></div>
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Confirm New Password</label>
              <input type="password" className="input" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></div>
          </div>
          <button onClick={changePasswordFn} disabled={saving === "password"} className="btn btn-primary mt-4" style={{ fontSize: 12 }}>
            {saving === "password" ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      {/* Bot Settings (merchant admins only) */}
      {isMerchant && (
        <div className="card">
          <h3 className="text-xs font-semibold mb-4 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><MdSmartToy size={14} />TELEGRAM BOT SETTINGS</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Configure your Telegram bot token and deep-link code. Get a token from @BotFather on Telegram.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Bot Token</label>
              <input type="password" className="input font-mono" value={bot.telegram_token} onChange={(e) => setBot({ ...bot, telegram_token: e.target.value })} placeholder="123456:ABC-DEF1234ghIkl..." /></div>
            <div><label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Deep Link Code</label>
              <input className="input font-mono" value={bot.deep_link_code} onChange={(e) => setBot({ ...bot, deep_link_code: e.target.value })} placeholder="myshop_start" /></div>
          </div>
          <button onClick={updateBot} disabled={saving === "bot"} className="btn btn-primary mt-4" style={{ fontSize: 12 }}>
            {saving === "bot" ? "Saving..." : "Save Bot Settings"}
          </button>
        </div>
      )}

      {/* Info for super admin */}
      {isSuper && (
        <div className="card" style={{ background: "var(--bg-secondary)" }}>
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><MdInfo size={14} />SUPER ADMIN NOTE</h3>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            To manage merchants, create new merchant admin accounts, or configure bot settings for merchants,
            visit the <strong>Merchants</strong> section from the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}
