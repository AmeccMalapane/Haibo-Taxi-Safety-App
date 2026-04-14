import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/States";

export function FleetPage() {
  return (
    <div>
      <PageHeader
        title="Fleet"
        subtitle="Taxi registration, verification, and driver assignment."
      />
      <EmptyState
        title="Fleet page coming next"
        hint="Phase 2 will wire /api/taxis list + verification + per-vehicle driver history."
      />
    </div>
  );
}
