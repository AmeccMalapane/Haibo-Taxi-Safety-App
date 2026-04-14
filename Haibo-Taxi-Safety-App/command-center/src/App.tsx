import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { auth } from "./api/client";
import { closeSocket } from "./lib/socket";
import { Sidebar } from "./components/Sidebar";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { ComplaintsPage } from "./pages/ComplaintsPage";
import { WithdrawalsPage } from "./pages/WithdrawalsPage";
import { PasopPage } from "./pages/PasopPage";
import { ReelsModerationPage } from "./pages/ReelsModerationPage";
import { LostFoundModerationPage } from "./pages/LostFoundModerationPage";
import { JobsModerationPage } from "./pages/JobsModerationPage";
import { FleetPage } from "./pages/FleetPage";
import { EventsPage } from "./pages/EventsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { colors, spacing } from "./lib/brand";

/**
 * Guards the admin shell. Unauthenticated hits are redirected to /login
 * with the intended path in location.state so LoginPage can return the user
 * to where they were going after a successful sign-in.
 */
function ProtectedShell() {
  const location = useLocation();
  if (!auth.isAuthenticated()) {
    closeSocket();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  const user = auth.getUser();
  if (user?.role && user.role !== "admin") {
    // Non-admin session — sign out and bounce.
    closeSocket();
    auth.logout();
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: colors.bg }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          padding: spacing["2xl"],
          overflowY: "auto",
          color: colors.text,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/withdrawals" element={<WithdrawalsPage />} />
          <Route path="/complaints" element={<ComplaintsPage />} />
          <Route path="/moderation/pasop" element={<PasopPage />} />
          <Route path="/moderation/reels" element={<ReelsModerationPage />} />
          <Route path="/moderation/lost-found" element={<LostFoundModerationPage />} />
          <Route path="/moderation/jobs" element={<JobsModerationPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
