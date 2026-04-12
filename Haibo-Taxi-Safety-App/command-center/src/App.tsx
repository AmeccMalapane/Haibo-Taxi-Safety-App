import React, { useState, useEffect, useCallback } from "react";
import { auth, admin, complaints as complaintsApi, healthCheck } from "./api/client";

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = {
  app: { minHeight: "100vh", display: "flex" } as React.CSSProperties,
  sidebar: { width: 240, background: "#1a1a2e", color: "#fff", padding: "24px 0", display: "flex", flexDirection: "column" as const, flexShrink: 0 },
  sidebarHeader: { padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  sidebarLogo: { fontSize: 22, fontWeight: 700, color: "#E72369" },
  sidebarSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  nav: { padding: "16px 0", flex: 1 },
  navItem: (active: boolean) => ({
    display: "flex", alignItems: "center" as const, gap: 10, padding: "10px 20px", cursor: "pointer",
    background: active ? "rgba(231,35,105,0.15)" : "transparent",
    color: active ? "#E72369" : "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: active ? 600 : 400,
    borderLeft: active ? "3px solid #E72369" : "3px solid transparent",
    transition: "all 0.15s",
  }),
  main: { flex: 1, padding: 32, overflowY: "auto" as const },
  pageTitle: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  pageSub: { fontSize: 14, color: "#666", marginBottom: 24 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 },
  card: { background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  cardLabel: { fontSize: 12, color: "#888", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  cardValue: { fontSize: 28, fontWeight: 700 },
  cardSub: { fontSize: 12, color: "#999", marginTop: 4 },
  table: { width: "100%", borderCollapse: "collapse" as const, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  th: { textAlign: "left" as const, padding: "12px 16px", fontSize: 12, color: "#888", borderBottom: "1px solid #eee", fontWeight: 600, textTransform: "uppercase" as const },
  td: { padding: "12px 16px", fontSize: 14, borderBottom: "1px solid #f5f5f5" },
  badge: (color: string) => ({
    display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: color === "green" ? "#e8f5e9" : color === "red" ? "#fce4ec" : color === "amber" ? "#fff8e1" : "#e3f2fd",
    color: color === "green" ? "#2e7d32" : color === "red" ? "#c62828" : color === "amber" ? "#f57f17" : "#1565c0",
  }),
  loginWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" },
  loginCard: { background: "#fff", borderRadius: 16, padding: 40, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  input: { width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: 15, marginBottom: 12, outline: "none" },
  btn: { width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#E72369", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  statusDot: (ok: boolean) => ({ width: 8, height: 8, borderRadius: "50%", background: ok ? "#28a745" : "#dc3545", display: "inline-block", marginRight: 6 }),
};

// ─── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await auth.login(email, password);
      if (result.user?.role !== "admin") {
        setError("Admin access required. Your role: " + result.user?.role);
        auth.logout();
        return;
      }
      onLogin();
    } catch (err: any) {
      setError(err.message?.includes("401") ? "Invalid credentials" : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={css.loginWrap}>
      <div style={css.loginCard}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#E72369" }}>Haibo!</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>Command Center</div>
        </div>
        <form onSubmit={handleSubmit}>
          <input style={css.input} type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={css.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: "#c62828", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button style={{ ...css.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "Signing in..." : "Sign in to Command Center"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────
function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [m, c, h] = await Promise.all([
          admin.getSystemMetrics(),
          admin.getComplianceMetrics(),
          healthCheck(),
        ]);
        setMetrics(m);
        setCompliance(c);
        setHealth(h);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Loading dashboard...</div>;

  return (
    <div>
      <h1 style={css.pageTitle}>Dashboard</h1>
      <p style={css.pageSub}>
        <span style={css.statusDot(health?.status === "healthy")}></span>
        API {health?.status || "unknown"} — DB {health?.database || "unknown"}
      </p>

      <div style={css.grid}>
        <div style={css.card}>
          <div style={css.cardLabel}>Total users</div>
          <div style={css.cardValue}>{metrics?.totalUsers || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Active vehicles</div>
          <div style={css.cardValue}>{metrics?.activeVehicles || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Registered drivers</div>
          <div style={css.cardValue}>{metrics?.totalDrivers || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Pending complaints</div>
          <div style={{ ...css.cardValue, color: (metrics?.pendingComplaints || 0) > 0 ? "#c62828" : "#2e7d32" }}>
            {metrics?.pendingComplaints || 0}
          </div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Total events</div>
          <div style={css.cardValue}>{metrics?.totalEvents || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Group rides</div>
          <div style={css.cardValue}>{metrics?.totalRides || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Deliveries</div>
          <div style={css.cardValue}>{metrics?.totalDeliveries || 0}</div>
        </div>
        <div style={css.card}>
          <div style={css.cardLabel}>Compliance rate</div>
          <div style={{ ...css.cardValue, color: "#E72369" }}>{compliance?.overallRate || 0}%</div>
        </div>
      </div>

      {metrics?.recentComplaints?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Recent complaints</h2>
          <table style={css.table}>
            <thead><tr>
              <th style={css.th}>Category</th>
              <th style={css.th}>Severity</th>
              <th style={css.th}>Description</th>
              <th style={css.th}>Status</th>
            </tr></thead>
            <tbody>
              {metrics.recentComplaints.slice(0, 5).map((c: any) => (
                <tr key={c.id}>
                  <td style={css.td}>{c.category}</td>
                  <td style={css.td}><span style={css.badge(c.severity === "critical" ? "red" : c.severity === "high" ? "amber" : "blue")}>{c.severity}</span></td>
                  <td style={{ ...css.td, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</td>
                  <td style={css.td}><span style={css.badge(c.status === "resolved" ? "green" : c.status === "pending" ? "amber" : "blue")}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Users Page ──────────────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.getUsers(roleFilter || undefined);
      setUsers(res.data || []);
    } catch (err) {
      console.error("Users load error:", err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 style={css.pageTitle}>Users</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["", "commuter", "driver", "owner", "admin"].map(role => (
          <button key={role} onClick={() => setRoleFilter(role)}
            style={{ padding: "6px 16px", borderRadius: 20, border: "1px solid #ddd", background: roleFilter === role ? "#E72369" : "#fff", color: roleFilter === role ? "#fff" : "#333", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            {role || "All"}
          </button>
        ))}
      </div>
      {loading ? <div>Loading...</div> : (
        <table style={css.table}>
          <thead><tr>
            <th style={css.th}>Phone</th>
            <th style={css.th}>Name</th>
            <th style={css.th}>Role</th>
            <th style={css.th}>Verified</th>
            <th style={css.th}>Balance</th>
            <th style={css.th}>Joined</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={css.td}>{u.phone}</td>
                <td style={css.td}>{u.displayName || "—"}</td>
                <td style={css.td}><span style={css.badge(u.role === "admin" ? "red" : u.role === "driver" ? "blue" : "green")}>{u.role}</span></td>
                <td style={css.td}>{u.isVerified ? "Yes" : "No"}</td>
                <td style={css.td}>R{(u.walletBalance || 0).toFixed(2)}</td>
                <td style={css.td}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Complaints Page ─────────────────────────────────────────────────────────
function ComplaintsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    complaintsApi.list().then(res => { setItems(res.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleResolve = async (id: string) => {
    try {
      await admin.updateComplaint(id, { status: "resolved", resolution: "Resolved via Command Center" });
      setItems(prev => prev.map(c => c.id === id ? { ...c, status: "resolved" } : c));
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  return (
    <div>
      <h1 style={css.pageTitle}>Complaints</h1>
      <p style={css.pageSub}>{items.filter(c => c.status === "pending").length} pending</p>
      {loading ? <div>Loading...</div> : (
        <table style={css.table}>
          <thead><tr>
            <th style={css.th}>Date</th>
            <th style={css.th}>Category</th>
            <th style={css.th}>Severity</th>
            <th style={css.th}>Plate</th>
            <th style={css.th}>Description</th>
            <th style={css.th}>Status</th>
            <th style={css.th}>Action</th>
          </tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id}>
                <td style={css.td}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
                <td style={css.td}>{c.category}</td>
                <td style={css.td}><span style={css.badge(c.severity === "critical" ? "red" : c.severity === "high" ? "amber" : "blue")}>{c.severity}</span></td>
                <td style={css.td}>{c.taxiPlateNumber || "—"}</td>
                <td style={{ ...css.td, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</td>
                <td style={css.td}><span style={css.badge(c.status === "resolved" ? "green" : "amber")}>{c.status}</span></td>
                <td style={css.td}>
                  {c.status === "pending" && (
                    <button onClick={() => handleResolve(c.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #28a745", background: "transparent", color: "#28a745", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────────────
type Page = "dashboard" | "users" | "complaints" | "taxis" | "events";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(auth.isAuthenticated());
  const [page, setPage] = useState<Page>("dashboard");
  const user = auth.getUser();

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "users", label: "Users", icon: "users" },
    { id: "complaints", label: "Complaints", icon: "alert-triangle" },
    { id: "taxis", label: "Fleet", icon: "truck" },
    { id: "events", label: "Events", icon: "calendar" },
  ];

  return (
    <div style={css.app}>
      <div style={css.sidebar}>
        <div style={css.sidebarHeader}>
          <div style={css.sidebarLogo}>Haibo!</div>
          <div style={css.sidebarSub}>Command Center</div>
        </div>
        <div style={css.nav}>
          {navItems.map(item => (
            <div key={item.id} style={css.navItem(page === item.id)} onClick={() => setPage(item.id)}>
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{user?.displayName || user?.phone || "Admin"}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{user?.role}</div>
          <div onClick={() => { auth.logout(); setLoggedIn(false); }}
            style={{ fontSize: 13, color: "#E72369", cursor: "pointer", marginTop: 8 }}>
            Sign out
          </div>
        </div>
      </div>

      <div style={css.main}>
        {page === "dashboard" && <DashboardPage />}
        {page === "users" && <UsersPage />}
        {page === "complaints" && <ComplaintsPage />}
        {page === "taxis" && <div><h1 style={css.pageTitle}>Fleet management</h1><p style={css.pageSub}>Coming next — taxi registration, verification, and driver assignment.</p></div>}
        {page === "events" && <div><h1 style={css.pageTitle}>Events</h1><p style={css.pageSub}>Coming next — event moderation, promotion approvals, and analytics.</p></div>}
      </div>
    </div>
  );
}
