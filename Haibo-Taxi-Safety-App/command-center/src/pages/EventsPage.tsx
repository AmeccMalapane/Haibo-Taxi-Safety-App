import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/States";

export function EventsPage() {
  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Event moderation, promotion approvals, and attendance analytics."
      />
      <EmptyState
        title="Events page coming next"
        hint="Phase 2 will wire /api/events list + approve/reject flow."
      />
    </div>
  );
}
