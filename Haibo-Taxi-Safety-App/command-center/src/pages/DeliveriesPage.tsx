import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, MapPin, Shield, Camera } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { colors, spacing, fonts } from "../lib/brand";

interface Delivery {
  id: string;
  senderId: string;
  driverId: string | null;
  driverPhone: string | null;
  taxiPlateNumber: string;
  description: string;
  pickupRank: string;
  dropoffRank: string;
  amount: number;
  status: string;
  paymentStatus: string;
  confirmationCode: string | null;
  insuranceIncluded: boolean | null;
  insuranceAmount: number | null;
  createdAt: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  senderPhone: string | null;
  senderName: string | null;
}

function paymentTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function timeBetween(
  from: string | null,
  to: string | null
): string | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function DeliveriesPage() {
  const [status, setStatus] = useState("in_transit");

  const deliveriesQ = useQuery({
    queryKey: ["admin", "deliveries", status],
    queryFn: () => admin.getDeliveries({ status: status || undefined }),
    refetchInterval:
      status === "pending" || status === "accepted" || status === "in_transit"
        ? 20_000
        : false,
  });

  const rows: Delivery[] = deliveriesQ.data?.data || [];
  const counts: Record<string, number> = deliveriesQ.data?.counts || {};

  const tabs: StatusTab[] = useMemo(
    () => [
      { label: "Pending", value: "pending", count: counts.pending },
      { label: "Accepted", value: "accepted", count: counts.accepted },
      { label: "In transit", value: "in_transit", count: counts.in_transit },
      { label: "Delivered", value: "delivered", count: counts.delivered },
      { label: "Cancelled", value: "cancelled", count: counts.cancelled },
    ],
    [counts]
  );

  const totalInFlight =
    (counts.pending || 0) + (counts.accepted || 0) + (counts.in_transit || 0);

  return (
    <div>
      <PageHeader
        title="Deliveries"
        subtitle={
          deliveriesQ.isSuccess
            ? `${totalInFlight} in-flight packages · ${counts.delivered || 0} delivered all-time`
            : "Package tracking via taxi ranks"
        }
      />

      <StatusTabs tabs={tabs} active={status} onChange={setStatus} />

      {deliveriesQ.isError ? (
        <ErrorState error={deliveriesQ.error} onRetry={() => deliveriesQ.refetch()} />
      ) : deliveriesQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status.replace("_", " ")} deliveries`}
          hint="Commuters book deliveries from the Hub → Send package flow in the app."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Created</TH>
              <TH>Package</TH>
              <TH>Route</TH>
              <TH>Sender</TH>
              <TH>Driver</TH>
              <TH>Amount</TH>
              <TH>Timing</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const timing = timeBetween(d.createdAt, d.deliveredAt || d.acceptedAt);
              return (
                <tr key={d.id}>
                  <TD>
                    {d.createdAt
                      ? new Date(d.createdAt).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TD>
                  <TD truncate>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <Package size={14} color={colors.rose} />
                      <div style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                        {d.description}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                      {d.insuranceIncluded ? (
                        <Badge tone="info">
                          <Shield size={9} style={{ marginRight: 2 }} />
                          insured
                        </Badge>
                      ) : null}
                      {d.confirmationCode ? (
                        <span
                          style={{
                            fontFamily: fonts.mono,
                            fontSize: 10,
                            color: colors.textTertiary,
                            letterSpacing: 0.5,
                          }}
                        >
                          #{d.confirmationCode}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD truncate>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      <MapPin size={12} color={colors.success} />
                      {d.pickupRank}
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
                      {d.dropoffRank}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 600 }}>
                      {d.senderName || (
                        <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                          —
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {d.senderPhone || d.senderId.slice(0, 8)}
                    </div>
                  </TD>
                  <TD>
                    <div
                      style={{
                        fontFamily: fonts.mono,
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: 0.5,
                      }}
                    >
                      {d.taxiPlateNumber}
                    </div>
                    {d.driverPhone ? (
                      <div style={{ fontSize: 11, color: colors.textTertiary }}>
                        {d.driverPhone}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          fontStyle: "italic",
                        }}
                      >
                        no driver yet
                      </div>
                    )}
                  </TD>
                  <TD>
                    <div
                      style={{
                        fontVariant: "tabular-nums",
                        fontWeight: 700,
                      }}
                    >
                      R{Number(d.amount).toFixed(2)}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <Badge tone={paymentTone(d.paymentStatus)}>
                        {d.paymentStatus}
                      </Badge>
                    </div>
                  </TD>
                  <TD>
                    {timing ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          fontVariant: "tabular-nums",
                        }}
                      >
                        {timing}
                      </span>
                    ) : (
                      <span style={{ color: colors.textTertiary, fontSize: 12 }}>
                        —
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={statusTone(d.status)}>{d.status.replace("_", " ")}</Badge>
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
