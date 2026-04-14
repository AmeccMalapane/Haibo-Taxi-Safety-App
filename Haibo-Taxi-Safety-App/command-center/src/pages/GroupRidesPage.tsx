import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MapPin, Clock } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { colors, spacing, fonts } from "../lib/brand";

interface GroupRide {
  id: string;
  title: string;
  description: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledDate: string | null;
  maxPassengers: number;
  costPerPerson: number | null;
  rideType: string;
  driverId: string | null;
  driverPlateNumber: string | null;
  driverSafetyRating: number | null;
  status: string;
  paymentMethod: string | null;
  isVerifiedDriver: boolean | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  organizerId: string;
  organizerPhone: string | null;
  organizerName: string | null;
}

const RIDE_TYPE_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  odd_hours: { label: "Odd hours", tone: "warning" },
  school_transport: { label: "School", tone: "success" },
  staff_transport: { label: "Staff", tone: "rose" },
};

function rideTypeMeta(type: string) {
  return RIDE_TYPE_LABELS[type] || { label: type, tone: "neutral" as BadgeTone };
}

export function GroupRidesPage() {
  const [status, setStatus] = useState("open");

  const ridesQ = useQuery({
    queryKey: ["admin", "group-rides", status],
    queryFn: () => admin.getGroupRides({ status: status || undefined }),
    // Live-ish: refetch open + in-progress every 20s so admins can watch
    // active rides without a manual refresh.
    refetchInterval:
      status === "open" || status === "in_progress" ? 20_000 : false,
  });

  const rows: GroupRide[] = ridesQ.data?.data || [];
  const counts: Record<string, number> = ridesQ.data?.counts || {};

  const tabs: StatusTab[] = useMemo(
    () => [
      { label: "Open", value: "open", count: counts.open },
      { label: "In progress", value: "in_progress", count: counts.in_progress },
      { label: "Completed", value: "completed", count: counts.completed },
      { label: "Cancelled", value: "cancelled", count: counts.cancelled },
    ],
    [counts]
  );

  return (
    <div>
      <PageHeader
        title="Group rides"
        subtitle="Community transport — scheduled, school, staff, and odd-hours trips"
      />

      <StatusTabs tabs={tabs} active={status} onChange={setStatus} />

      {ridesQ.isError ? (
        <ErrorState error={ridesQ.error} onRetry={() => ridesQ.refetch()} />
      ) : ridesQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status} rides`}
          hint="Community organizers post group rides from the mobile app's Group rides tab."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Scheduled</TH>
              <TH>Title</TH>
              <TH>Route</TH>
              <TH>Organizer</TH>
              <TH>Driver</TH>
              <TH>Seats</TH>
              <TH>Cost</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const typeMeta = rideTypeMeta(r.rideType);
              return (
                <tr key={r.id}>
                  <TD>
                    <div style={{ fontWeight: 600 }}>
                      {r.scheduledDate
                        ? new Date(r.scheduledDate).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} />
                      {r.scheduledDate
                        ? new Date(r.scheduledDate).toLocaleTimeString("en-ZA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </TD>
                  <TD truncate>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ marginTop: 3 }}>
                      <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                    </div>
                  </TD>
                  <TD truncate>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: colors.text,
                      }}
                    >
                      <MapPin size={12} color={colors.success} />
                      {r.pickupLocation}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      <MapPin size={12} color={colors.rose} />
                      {r.dropoffLocation}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 600 }}>
                      {r.organizerName || (
                        <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                          no name
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {r.organizerPhone || r.organizerId.slice(0, 8)}
                    </div>
                  </TD>
                  <TD>
                    {r.driverPlateNumber ? (
                      <div>
                        <div
                          style={{
                            fontFamily: fonts.mono,
                            fontWeight: 700,
                            fontSize: 12,
                            letterSpacing: 0.5,
                          }}
                        >
                          {r.driverPlateNumber}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.textTertiary,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            marginTop: 2,
                          }}
                        >
                          {r.isVerifiedDriver ? (
                            <Badge tone="success">verified</Badge>
                          ) : (
                            <Badge>unverified</Badge>
                          )}
                          {r.driverSafetyRating ? (
                            <span style={{ fontVariant: "tabular-nums" }}>
                              ★ {Number(r.driverSafetyRating).toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: colors.textTertiary,
                          fontStyle: "italic",
                        }}
                      >
                        unassigned
                      </span>
                    )}
                  </TD>
                  <TD>
                    <span
                      style={{
                        fontVariant: "tabular-nums",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Users size={12} color={colors.textTertiary} />
                      {r.maxPassengers}
                    </span>
                  </TD>
                  <TD>
                    {r.costPerPerson ? (
                      <span style={{ fontVariant: "tabular-nums", fontWeight: 600 }}>
                        R{Number(r.costPerPerson).toFixed(0)}
                      </span>
                    ) : (
                      <Badge tone="success">FREE</Badge>
                    )}
                    {r.paymentMethod ? (
                      <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>
                        {r.paymentMethod}
                      </div>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
