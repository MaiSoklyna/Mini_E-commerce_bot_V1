"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const BOT_USERNAME = "FavouriteOfShop_bot";
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 5 * 60 * 1000;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"merchant" | "super_admin">("merchant");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [telegramPending, setTelegramPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) router.replace("/dashboard");
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/admin/auth/login", { email, password, role });
      if (res.data.success) {
        const { access_token, user } = res.data.data;
        localStorage.setItem("admin_token", access_token);
        localStorage.setItem("admin_user", JSON.stringify(user));
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally { setLoading(false); }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setTelegramPending(false);
  }, []);

  const startTelegramLogin = useCallback(async () => {
    try {
      setTelegramPending(true);
      setError("");
      const res = await api.post("/admin/auth/tg-session");
      const sessionId = res.data.session_id;

      window.open(`https://t.me/${BOT_USERNAME}?start=${sessionId}`, "_blank");

      pollRef.current = setInterval(async () => {
        try {
          const poll = await api.get(`/admin/auth/tg-session/${sessionId}`);
          if (poll.data.status === "completed") {
            stopPolling();
            localStorage.setItem("admin_token", poll.data.token);
            localStorage.setItem("admin_user", JSON.stringify(poll.data.user));
            router.push("/dashboard");
          } else if (poll.data.status === "expired") {
            stopPolling();
            setError("Login session expired. Please try again.");
          }
        } catch {
          stopPolling();
          setError("Login session failed. Please try again.");
        }
      }, POLL_INTERVAL);

      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setError("Login timed out. Please try again.");
      }, POLL_TIMEOUT);
    } catch (err: any) {
      setTelegramPending(false);
      setError("Failed to start Telegram login. Please try again.");
    }
  }, [stopPolling, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
            FS
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Favourite of Shop</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Admin Dashboard</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 18 }}>Sign in to your account</h2>

          {error && (
            <div style={{ background: "var(--danger)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Telegram Login Button */}
          {telegramPending ? (
            <div style={{ textAlign: "center", padding: "16px 0", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                Waiting for Telegram login...
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                Complete the login in Telegram, then come back here.
              </div>
              <button onClick={stopPolling} type="button"
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)",
                }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={startTelegramLogin} type="button"
              style={{
                width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "1px solid #0088cc",
                background: "#0088cc", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginBottom: 16, transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Login via Telegram
            </button>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Sign in as</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["merchant", "super_admin"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${role === r ? "var(--accent)" : "var(--border)"}`,
                    background: role === r ? "var(--accent)" : "transparent",
                    color: role === r ? "var(--bg)" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}>
                  {r === "merchant" ? "Merchant Admin" : "Super Admin"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          </div>

          <button onClick={handleLogin} disabled={loading} className="btn btn-primary"
            style={{ width: "100%", padding: "10px", fontSize: 13 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
          DigitalAlchemy · Multi-Tenant E-Commerce Platform
        </p>
      </div>
    </div>
  );
}
