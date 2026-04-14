import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Users as UsersIcon, Users2, Phone, Globe } from "lucide-react";
import { admin, BroadcastAudience } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge, BadgeTone } from "../components/Badge";
import {
  colors,
  radius,
  shadows,
  spacing,
  fonts,
  gradients,
  transitions,
} from "../lib/brand";

type AudienceKind = "all" | "role" | "phones";
type Role = "commuter" | "driver" | "owner" | "admin";

const ROLE_OPTIONS: Array<{ value: Role; label: string; tone: BadgeTone }> = [
  { value: "commuter", label: "Commuters", tone: "success" },
  { value: "driver", label: "Drivers", tone: "info" },
  { value: "owner", label: "Owners", tone: "warning" },
  { value: "admin", label: "Admins", tone: "danger" },
];

export function BroadcastPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("role");
  const [role, setRole] = useState<Role>("commuter");
  const [phonesRaw, setPhonesRaw] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const phones = useMemo(
    () =>
      phonesRaw
        .split(/[\s,\n]+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [phonesRaw]
  );

  const audience: BroadcastAudience = useMemo(() => {
    if (audienceKind === "all") return { kind: "all" };
    if (audienceKind === "role") return { kind: "role", role };
    return { kind: "phones", phones };
  }, [audienceKind, role, phones]);

  // Live recipient count — refetches any time the audience config
  // changes. Disabled when the phone list is empty to avoid a pointless
  // zero round-trip.
  const previewQ = useQuery({
    queryKey: ["admin", "broadcast-preview", audienceKind, role, phones.join(",")],
    queryFn: () => admin.previewBroadcast(audience),
    enabled: audienceKind !== "phones" || phones.length > 0,
    staleTime: 10_000,
  });

  const sendM = useMutation({
    mutationFn: () => admin.sendBroadcast({ title, body, audience }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        `Broadcast sent to ${data.recipients} ${
          data.recipients === 1 ? "user" : "users"
        } · ${data.sent} delivered${data.failed ? ` · ${data.failed} failed` : ""}`
      );
      setTitle("");
      setBody("");
      setConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Broadcast failed"),
  });

  const recipientCount: number = previewQ.data?.recipientCount ?? 0;
  const canSubmit =
    title.trim().length >= 2 &&
    body.trim().length >= 4 &&
    recipientCount > 0 &&
    !sendM.isPending;

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Send push notifications to users, drivers, or specific phone numbers."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: spacing.xl,
          alignItems: "start",
        }}
      >
        {/* ─── Left: form ──────────────────────────────────────── */}
        <Card>
          <SectionLabel icon={<Megaphone size={14} />}>Message</SectionLabel>

          <FormLabel>TITLE</FormLabel>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="Service advisory"
            style={{
              width: "100%",
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 15,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: spacing.lg,
            }}
          />

          <FormLabel>
            BODY <span style={{ color: colors.textTertiary }}>({body.length}/280)</span>
          </FormLabel>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 280))}
            placeholder="Taxi strike in Joburg CBD — avoid Bree and Noord ranks. Use alternative routes via Park Station."
            rows={4}
            style={{
              width: "100%",
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: spacing.xl,
            }}
          />

          <SectionLabel icon={<UsersIcon size={14} />}>Audience</SectionLabel>

          {/* Audience type radio group */}
          <div
            role="radiogroup"
            aria-label="Audience type"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            <AudienceButton
              active={audienceKind === "role"}
              onClick={() => setAudienceKind("role")}
              icon={<Users2 size={16} />}
              label="By role"
            />
            <AudienceButton
              active={audienceKind === "phones"}
              onClick={() => setAudienceKind("phones")}
              icon={<Phone size={16} />}
              label="By phone"
            />
            <AudienceButton
              active={audienceKind === "all"}
              onClick={() => setAudienceKind("all")}
              icon={<Globe size={16} />}
              label="Everyone"
            />
          </div>

          {audienceKind === "role" ? (
            <div
              style={{
                display: "flex",
                gap: spacing.sm,
                flexWrap: "wrap",
                marginBottom: spacing.lg,
              }}
            >
              {ROLE_OPTIONS.map((r) => {
                const active = role === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    aria-pressed={active}
                    style={{
                      padding: `${spacing.sm}px ${spacing.lg}px`,
                      borderRadius: radius.full,
                      border: `1px solid ${active ? colors.rose : colors.border}`,
                      background: active ? colors.rose : colors.surface,
                      color: active ? "#FFFFFF" : colors.text,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: transitions.medium,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {audienceKind === "phones" ? (
            <>
              <FormLabel>PHONE NUMBERS</FormLabel>
              <textarea
                value={phonesRaw}
                onChange={(e) => setPhonesRaw(e.target.value)}
                placeholder={"+27821234567\n+27611122233\n+27791112233"}
                rows={4}
                style={{
                  width: "100%",
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  fontSize: 13,
                  fontFamily: fonts.mono,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: spacing.xs,
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginBottom: spacing.lg,
                }}
              >
                Separate with commas, spaces, or newlines. Phones that don't
                match a user are silently skipped.
              </div>
            </>
          ) : null}

          {audienceKind === "all" ? (
            <div
              style={{
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                background: colors.warningSoft,
                color: colors.warning,
                fontSize: 13,
                marginBottom: spacing.lg,
                border: `1px solid ${colors.warning}40`,
              }}
            >
              ⚠ This will push to <strong>every user</strong> in the database.
              Use sparingly — reserved for critical service advisories.
            </div>
          ) : null}

          {/* Recipient count live badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderRadius: radius.md,
              background: colors.bg,
              marginBottom: spacing.lg,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Recipients
            </div>
            <div
              style={{
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: recipientCount > 0 ? colors.rose : colors.textTertiary,
                fontVariant: "tabular-nums",
              }}
            >
              {previewQ.isLoading ? "…" : recipientCount.toLocaleString()}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            style={{ width: "100%" }}
          >
            Send broadcast
          </Button>
        </Card>

        {/* ─── Right: phone-frame preview ─────────────────────────── */}
        <div style={{ position: "sticky", top: spacing.xl }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: spacing.sm,
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            Preview
          </div>
          <PhoneFramePreview
            title={title || "Your title here"}
            body={body || "Your message body will appear here."}
            isEmpty={!title && !body}
          />
        </div>
      </div>

      {/* ─── Confirm dialog ─────────────────────────────────────── */}
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="broadcast-confirm-title"
          onClick={() => setConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              borderRadius: radius.xl,
              padding: spacing["2xl"],
              width: 480,
              maxWidth: "calc(100vw - 32px)",
              boxShadow: shadows.lg,
            }}
          >
            <h2
              id="broadcast-confirm-title"
              style={{
                margin: 0,
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: colors.text,
                letterSpacing: -0.3,
              }}
            >
              Send this broadcast?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: spacing.sm,
                marginBottom: spacing.lg,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: colors.rose, fontVariant: "tabular-nums" }}>
                {recipientCount.toLocaleString()}
              </strong>{" "}
              {recipientCount === 1 ? "user" : "users"} will receive a push
              notification. This can't be undone.
            </p>

            <div
              style={{
                padding: spacing.lg,
                background: colors.bg,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                marginBottom: spacing.lg,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>
                {title}
              </div>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                {body}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: spacing.sm,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={sendM.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => sendM.mutate()}
                loading={sendM.isPending}
              >
                Send to {recipientCount.toLocaleString()}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.md,
        fontSize: 11,
        fontWeight: 700,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      <span style={{ color: colors.rose }}>{icon}</span>
      {children}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}

function AudienceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: `${spacing.md}px ${spacing.sm}px`,
        borderRadius: radius.md,
        border: `1.5px solid ${active ? colors.rose : colors.border}`,
        background: active ? colors.roseFaint : colors.surface,
        color: active ? colors.rose : colors.textSecondary,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: transitions.medium,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PhoneFramePreview({
  title,
  body,
  isEmpty,
}: {
  title: string;
  body: string;
  isEmpty: boolean;
}) {
  return (
    <div
      style={{
        background: "#1A1A2E",
        borderRadius: radius.xl,
        padding: spacing.md,
        border: `2px solid ${colors.border}`,
        boxShadow: shadows.md,
      }}
    >
      {/* Device lock-screen time + wallpaper hint */}
      <div
        style={{
          borderRadius: radius.lg,
          background:
            "linear-gradient(180deg, rgba(200, 30, 94, 0.18) 0%, rgba(26, 26, 46, 0.6) 100%)",
          padding: spacing.md,
          minHeight: 360,
          position: "relative",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.88)",
            fontFamily: fonts.heading,
            fontSize: 34,
            fontWeight: 300,
            marginBottom: 2,
            lineHeight: 1,
          }}
        >
          9:41
        </div>
        <div
          style={{
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.6)",
            fontSize: 11,
            marginBottom: spacing.lg,
          }}
        >
          Wednesday, 15 April
        </div>

        {/* Notification card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(20px)",
            borderRadius: radius.md,
            padding: `${spacing.md}px ${spacing.md}px`,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            opacity: isEmpty ? 0.5 : 1,
            transition: transitions.medium,
          }}
        >
          {/* App row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: gradients.primary,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.72)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                flex: 1,
              }}
            >
              Haibo
            </div>
            <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.5)" }}>
              now
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#FFFFFF",
              marginBottom: 2,
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.85)",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
