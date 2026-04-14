import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, UserPlus, Gift, CheckCircle } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard, Card } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, spacing, fonts, gradients } from "../lib/brand";

interface ReferralStats {
  totalCodes: number;
  totalSignups: number;
  completedSignups: number;
  conversionRate: number;
  totalRewards: number;
  claimedRewards: number;
}

interface ReferralSignup {
  id: string;
  referrerDeviceId: string;
  referredDeviceId: string;
  referralCode: string;
  status: string | null;
  hasCompletedRide: boolean | null;
  rewardClaimed: boolean | null;
  createdAt: string | null;
  completedAt: string | null;
}

interface TopReferrer {
  referrerDeviceId: string;
  signupCount: number;
}

interface ReferralsResponse {
  stats: ReferralStats;
  recentSignups: ReferralSignup[];
  topReferrers: TopReferrer[];
}

function signupTone(s: ReferralSignup): BadgeTone {
  if (s.rewardClaimed) return "success";
  if (s.hasCompletedRide) return "info";
  return "warning";
}

function signupLabel(s: ReferralSignup): string {
  if (s.rewardClaimed) return "reward claimed";
  if (s.hasCompletedRide) return "ride complete";
  return "signed up";
}

export function ReferralsPage() {
  const referralsQ = useQuery<ReferralsResponse>({
    queryKey: ["admin", "referrals"],
    queryFn: () => admin.getReferrals(),
    refetchInterval: 60_000,
  });

  if (referralsQ.isError)
    return (
      <ErrorState error={referralsQ.error} onRetry={() => referralsQ.refetch()} />
    );
  if (referralsQ.isLoading || !referralsQ.data)
    return <LoadingState label="Loading referrals data…" />;

  const { stats, recentSignups, topReferrers } = referralsQ.data;

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle="Growth loop: who's invited whom, what's converting, what's been claimed"
      />

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: spacing.lg,
          marginBottom: spacing["2xl"],
        }}
      >
        <StatCard
          label="Total codes"
          value={stats.totalCodes.toLocaleString()}
          Icon={Gift}
          sub="devices with a referral code"
        />
        <StatCard
          label="Total signups"
          value={stats.totalSignups.toLocaleString()}
          accent="rose"
          Icon={UserPlus}
          sub="via referral link"
        />
        <StatCard
          label="Conversion"
          value={`${stats.conversionRate}%`}
          accent={
            stats.conversionRate >= 50
              ? "success"
              : stats.conversionRate >= 20
              ? "default"
              : "danger"
          }
          Icon={CheckCircle}
          sub={`${stats.completedSignups.toLocaleString()} completed a ride`}
        />
        <StatCard
          label="Rewards claimed"
          value={stats.claimedRewards.toLocaleString()}
          accent="success"
          Icon={Trophy}
          sub={`${stats.totalRewards} earned`}
        />
      </div>

      {/* Two-column detail: top referrers + recent signups */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: spacing.lg,
          alignItems: "start",
        }}
      >
        {/* Top referrers leaderboard */}
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Trophy size={16} color={colors.rose} />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Top referrers
            </div>
          </div>

          {topReferrers.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: colors.textTertiary,
                padding: spacing.lg,
                textAlign: "center",
              }}
            >
              No referrals yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              {topReferrers.map((r, idx) => (
                <div
                  key={r.referrerDeviceId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: radius.md,
                    background: idx === 0 ? colors.roseAccent : colors.bg,
                    border: `1px solid ${idx === 0 ? colors.rose : colors.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.full,
                      background: idx < 3 ? gradients.primary : colors.surface,
                      color: idx < 3 ? "#FFFFFF" : colors.textSecondary,
                      fontFamily: fonts.heading,
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: idx < 3 ? "none" : `1px solid ${colors.border}`,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        color: colors.textSecondary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.referrerDeviceId}
                    >
                      {r.referrerDeviceId.slice(0, 16)}…
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 16,
                      fontWeight: 700,
                      color: idx === 0 ? colors.rose : colors.text,
                      fontVariant: "tabular-nums",
                    }}
                  >
                    {r.signupCount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent signups */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <UserPlus size={16} color={colors.rose} />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Recent signups
            </div>
          </div>

          {recentSignups.length === 0 ? (
            <EmptyState
              title="No referral signups yet"
              hint="When users sign up via a shared code, they'll appear here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Date</TH>
                  <TH>Referrer</TH>
                  <TH>Referred</TH>
                  <TH>Code</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((s) => (
                  <tr key={s.id}>
                    <TD>
                      <div style={{ fontSize: 12 }}>
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleDateString("en-ZA", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textTertiary }}>
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleTimeString("en-ZA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>
                    </TD>
                    <TD>
                      <span
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          color: colors.textSecondary,
                        }}
                        title={s.referrerDeviceId}
                      >
                        {s.referrerDeviceId.slice(0, 12)}…
                      </span>
                    </TD>
                    <TD>
                      <span
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          color: colors.textSecondary,
                        }}
                        title={s.referredDeviceId}
                      >
                        {s.referredDeviceId.slice(0, 12)}…
                      </span>
                    </TD>
                    <TD>
                      <span
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 12,
                          fontWeight: 700,
                          color: colors.rose,
                          letterSpacing: 0.5,
                        }}
                      >
                        {s.referralCode}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={signupTone(s)}>{signupLabel(s)}</Badge>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
