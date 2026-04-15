import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, spacing } from "../lib/brand";

const ROLE_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Commuters", value: "commuter" },
  { label: "Drivers", value: "driver" },
  { label: "Owners", value: "owner" },
  { label: "Admins", value: "admin" },
];

function roleTone(role?: string): BadgeTone {
  switch (role) {
    case "admin":
      return "danger";
    case "driver":
      return "info";
    case "owner":
      return "warning";
    case "commuter":
      return "success";
    default:
      return "neutral";
  }
}

export function UsersPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const usersQ = useQuery({
    queryKey: ["admin", "users", role],
    queryFn: () => admin.getUsers(role || undefined),
  });

  const users = usersQ.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={
          usersQ.isSuccess ? `${users.length} ${role || "total"}` : undefined
        }
      />

      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {ROLE_FILTERS.map((f) => {
          const active = role === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setRole(f.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.full,
                border: `1px solid ${active ? colors.rose : colors.border}`,
                background: active ? colors.rose : colors.surface,
                color: active ? "#FFFFFF" : colors.text,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "background 0.15s",
              }}
              aria-pressed={active}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {usersQ.isError ? (
        <ErrorState error={usersQ.error} onRetry={() => usersQ.refetch()} />
      ) : usersQ.isLoading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" hint="Try a different role filter." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Phone</TH>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Balance</TH>
              <TH>Joined</TH>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => {
              const suspended = !!u.isSuspended;
              return (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/admin/users/${u.id}/wallet`)}
                  style={{
                    cursor: "pointer",
                    opacity: suspended ? 0.72 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = colors.surfaceAlt)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                  title={
                    suspended
                      ? `Suspended: ${u.suspensionReason || "no reason recorded"}`
                      : "Click to view wallet"
                  }
                >
                  <TD>{u.phone}</TD>
                  <TD>{u.displayName || "—"}</TD>
                  <TD>
                    <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                  </TD>
                  <TD>
                    {suspended ? (
                      <Badge tone="danger">suspended</Badge>
                    ) : u.isVerified ? (
                      <Badge tone="success">verified</Badge>
                    ) : (
                      <Badge>unverified</Badge>
                    )}
                  </TD>
                  <TD>
                    <span style={{ fontVariant: "tabular-nums", fontWeight: 600 }}>
                      R{Number(u.walletBalance || 0).toFixed(2)}
                    </span>
                  </TD>
                  <TD>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
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
