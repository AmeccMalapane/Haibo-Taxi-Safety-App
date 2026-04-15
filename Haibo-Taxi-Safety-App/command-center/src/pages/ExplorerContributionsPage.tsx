import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Camera, TrendingUp } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { Badge } from "../components/Badge";
import { colors, spacing, fonts } from "../lib/brand";

// City Explorer contributions audit view (Chunk 48 — audit gap #5).
// Read-only surface over three crowdsourced tables: fare surveys that
// commuters answer to verify route prices, stop pins they drop when
// they spot an informal taxi stop, and photo contributions with
// landmark context. Moderation actions (hide, reject) are deliberately
// out of scope for Chunk 48 per the reactive moderation model we
// saved in auto-memory — we need to see the real abuse patterns
// before we design the dispute UI. The gap this closes is just the
// visibility hole.

type ContributionKind = "fare" | "stop" | "photo";

interface FareSurveyRow {
  id: string;
  deviceId: string;
  originRankId: string | null;
  originName: string;
  destinationName: string;
  fareAmount: number | null;
  responseType: string;
  pointsEarned: number | null;
  createdAt: string | null;
}

interface StopContributionRow {
  id: string;
  deviceId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  tip: string | null;
  landmark: string | null;
  bestTime: string | null;
  pointsEarned: number | null;
  status: string | null;
  createdAt: string | null;
}

interface PhotoContributionRow {
  id: string;
  deviceId: string;
  locationId: string | null;
  stopContributionId: string | null;
  imageUrl: string | null;
  description: string | null;
  landmark: string | null;
  bestTime: string | null;
  pointsEarned: number | null;
  status: string | null;
  createdAt: string | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function ExplorerContributionsPage() {
  const [kind, setKind] = useState<ContributionKind>("fare");

  const contribQ = useQuery<{
    data: any[];
    total: number;
    kind: ContributionKind;
  }>({
    queryKey: ["admin", "explorer", kind],
    queryFn: () =>
      admin.getExplorerContributions({ kind, limit: 100 }) as Promise<any>,
  });

  const rows: any[] = contribQ.data?.data || [];
  const total = contribQ.data?.total || 0;

  const tabs: StatusTab[] = useMemo(
    () => [
      { label: "Fare surveys", value: "fare" },
      { label: "Stops", value: "stop" },
      { label: "Photos", value: "photo" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="City Explorer contributions"
        subtitle="Crowdsourced fare answers, stop pins, and photo uploads"
      />

      <StatusTabs
        tabs={tabs}
        active={kind}
        onChange={(v) => setKind(v as ContributionKind)}
      />

      {contribQ.isError ? (
        <ErrorState error={contribQ.error} onRetry={() => contribQ.refetch()} />
      ) : contribQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${kind} contributions yet`}
          hint="Commuters earn points through the City Explorer flow on mobile. Rows appear here as they engage."
        />
      ) : (
        <>
          <div
            style={{
              marginBottom: spacing.md,
              fontSize: 12,
              color: colors.textTertiary,
            }}
          >
            Showing {rows.length} of {total}
          </div>
          {kind === "fare" ? (
            <FareSurveysTable rows={rows as FareSurveyRow[]} />
          ) : kind === "stop" ? (
            <StopsTable rows={rows as StopContributionRow[]} />
          ) : (
            <PhotosTable rows={rows as PhotoContributionRow[]} />
          )}
        </>
      )}
    </div>
  );
}

function FareSurveysTable({ rows }: { rows: FareSurveyRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <TH>When</TH>
          <TH>Device</TH>
          <TH>Route</TH>
          <TH>Fare</TH>
          <TH>Response</TH>
          <TH>Points</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <TD>{formatWhen(r.createdAt)}</TD>
            <TD>
              <span style={{ fontFamily: fonts.mono, fontSize: 11 }}>
                {shortId(r.deviceId)}
              </span>
            </TD>
            <TD>
              <div style={{ fontWeight: 600 }}>
                {r.originName} → {r.destinationName}
              </div>
            </TD>
            <TD>
              {r.fareAmount != null ? (
                <span style={{ fontVariant: "tabular-nums", fontWeight: 700 }}>
                  R{Number(r.fareAmount).toFixed(0)}
                </span>
              ) : (
                <span style={{ color: colors.textTertiary }}>—</span>
              )}
            </TD>
            <TD>
              <Badge
                tone={
                  r.responseType === "known"
                    ? "success"
                    : r.responseType === "guessed"
                    ? "warning"
                    : "info"
                }
              >
                {r.responseType}
              </Badge>
            </TD>
            <TD>
              <TrendingUp
                size={12}
                color={colors.textTertiary}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              {r.pointsEarned || 0}
            </TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function StopsTable({ rows }: { rows: StopContributionRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <TH>When</TH>
          <TH>Device</TH>
          <TH>Stop</TH>
          <TH>Landmark / tip</TH>
          <TH>Coords</TH>
          <TH>Best time</TH>
          <TH>Points</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <TD>{formatWhen(r.createdAt)}</TD>
            <TD>
              <span style={{ fontFamily: fonts.mono, fontSize: 11 }}>
                {shortId(r.deviceId)}
              </span>
            </TD>
            <TD>
              <div style={{ fontWeight: 600 }}>{r.stopName}</div>
            </TD>
            <TD>
              {r.landmark || r.tip ? (
                <div style={{ maxWidth: 260 }}>
                  {r.landmark ? (
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {r.landmark}
                    </div>
                  ) : null}
                  {r.tip ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {r.tip}
                    </div>
                  ) : null}
                </div>
              ) : (
                <span style={{ color: colors.textTertiary }}>—</span>
              )}
            </TD>
            <TD>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                }}
              >
                <MapPin
                  size={11}
                  style={{ marginRight: 3, verticalAlign: "middle" }}
                />
                {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
              </span>
            </TD>
            <TD>{r.bestTime || "—"}</TD>
            <TD>{r.pointsEarned || 0}</TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PhotosTable({ rows }: { rows: PhotoContributionRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <TH>When</TH>
          <TH>Device</TH>
          <TH>Preview</TH>
          <TH>Description</TH>
          <TH>Landmark</TH>
          <TH>Points</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <TD>{formatWhen(r.createdAt)}</TD>
            <TD>
              <span style={{ fontFamily: fonts.mono, fontSize: 11 }}>
                {shortId(r.deviceId)}
              </span>
            </TD>
            <TD>
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt=""
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              ) : (
                <Camera size={18} color={colors.textTertiary} />
              )}
            </TD>
            <TD>
              {r.description || (
                <span style={{ color: colors.textTertiary }}>—</span>
              )}
            </TD>
            <TD>{r.landmark || "—"}</TD>
            <TD>{r.pointsEarned || 0}</TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
