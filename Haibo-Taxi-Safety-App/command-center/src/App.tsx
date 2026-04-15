import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { PublicShell } from "./components/PublicShell";
import { HomePage } from "./pages/public/HomePage";
import { AboutPage } from "./pages/public/AboutPage";
import { CommunityPage } from "./pages/public/CommunityPage";
import { EventsPublicPage } from "./pages/public/EventsPublicPage";
import { EventDetailPage } from "./pages/public/EventDetailPage";
import { JobsPublicPage } from "./pages/public/JobsPublicPage";
import { JobDetailPage } from "./pages/public/JobDetailPage";
import { PrivacyPage } from "./pages/public/PrivacyPage";
import { TermsPage } from "./pages/public/TermsPage";
import { NotFoundPage } from "./pages/public/NotFoundPage";
import { colors, gradients } from "./lib/brand";

// Admin shell (Sidebar + 23 admin pages + recharts + socket.io) and the
// login page are both lazy-loaded so public visitors landing at `/` never
// download any of that code. Vite splits these into their own chunks.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);

/**
 * Full-page spinner used while a lazy route chunk is still downloading.
 * Matches the mobile app's brand gradient so the transition feels like
 * Haibo! rather than a generic React fallback.
 */
function RouteSpinner() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
      }}
    >
      <div
        aria-label="Loading"
        role="status"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `3px solid ${colors.border}`,
          borderTopColor: "transparent",
          background: gradients.primary,
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          animation: "hb-route-spin 0.9s linear infinite",
        }}
      />
      <style>{`
        @keyframes hb-route-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteSpinner />}>
        <Routes>
          {/* Public marketing site */}
          <Route element={<PublicShell />}>
            <Route index element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/events" element={<EventsPublicPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/jobs" element={<JobsPublicPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            {/* Stray public URLs get a branded 404 inside the public shell
                rather than silently redirecting — keeps navbar/footer so the
                user has an obvious way out. */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Auth — lazy so public visitors don't pay for it */}
          <Route path="/login" element={<LoginPage />} />

          {/* Command Center (admin only) — entire shell lazy-loaded */}
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
