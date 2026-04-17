import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  MapPin,
  Clock,
  Banknote,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  colors,
  radius,
  spacing,
  shadows,
  gradients,
  fonts,
  transitions,
} from "../../lib/brand";
import { jobs as jobsApi } from "../../api/client";
import { usePageMeta } from "../../hooks/usePageMeta";
import { StaggerIn } from "../../lib/motion";

interface ServerJob {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string | null;
  jobType: string | null;
  category: string | null;
  location: string;
  province: string | null;
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  experienceLevel: string | null;
  licenseRequired: string | null;
  benefits: string[] | null;
  isVerified: boolean | null;
  isFeatured: boolean | null;
  createdAt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

const TYPE_TINT: Record<string, string> = {
  "full-time": colors.success,
  "part-time": colors.info,
  contract: colors.warning,
  temporary: colors.textSecondary,
};

function typeLabel(raw: string | null): string {
  if (!raw) return "Full-time";
  return TYPE_LABELS[raw.toLowerCase()] || raw;
}

function typeTint(raw: string | null): string {
  if (!raw) return TYPE_TINT["full-time"];
  return TYPE_TINT[raw.toLowerCase()] || colors.textSecondary;
}

function formatSalary(job: ServerJob): string | null {
  if (job.salary) return job.salary;
  if (job.salaryMin != null && job.salaryMax != null) {
    return `R${Math.round(job.salaryMin).toLocaleString("en-ZA")} – R${Math.round(job.salaryMax).toLocaleString("en-ZA")} / month`;
  }
  if (job.salaryMin != null) return `From R${Math.round(job.salaryMin).toLocaleString("en-ZA")} / month`;
  return null;
}

function parseRequirements(raw: string | null): string[] {
  if (!raw) return [];
  // Server stores requirements as a single text field. Split on newlines,
  // semicolons, or bullet markers so we can render them as chips.
  return raw
    .split(/[\n;•]+/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
}

function relativePosted(iso: string | null): string {
  if (!iso) return "Recently";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 3600) return "Just posted";
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function JobsPublicPage() {
  usePageMeta({
    title: "Jobs — Haibo!",
    description:
      "Driver jobs, fleet postings, and opportunities across South Africa's taxi industry. Pulled from verified operators.",
  });
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["public", "jobs"],
    queryFn: () => jobsApi.list(),
    staleTime: 60_000,
  });

  const list: ServerJob[] = data?.data ?? [];

  return (
    <div>
      <Hero />
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: `${spacing["4xl"]}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
          display: "flex",
          flexDirection: "column",
          gap: spacing.xl,
        }}
      >
        {isLoading ? (
          <LoadingList />
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || "Couldn't load jobs."}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <StaggerIn stagger={0.06} duration={0.5} distance={16}>
            {list.map((job) => <JobCard key={job.id} job={job} />)}
          </StaggerIn>
        )}
      </section>
      <style>{`
        @keyframes hb-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes hb-spin {
          to { transform: rotate(360deg); }
        }
        .hb-spin { animation: hb-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        background: colors.surfaceAlt,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: `${spacing["5xl"]}px ${spacing["2xl"]}px ${spacing["4xl"]}px`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.md}px`,
            borderRadius: radius.full,
            background: colors.roseFaint,
            color: colors.rose,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: spacing.xl,
          }}
        >
          <Sparkles size={13} /> Careers
        </div>
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(36px, 5vw, 54px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1,
            color: colors.text,
            margin: 0,
          }}
        >
          Jobs{" "}
          <span
            style={{
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            board
          </span>
          .
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: colors.textSecondary,
            marginTop: spacing.xl,
            maxWidth: 560,
          }}
        >
          Opportunities across South Africa's taxi industry — from driving to tech
          to community safety. Pulled directly from verified operators.
        </p>
      </div>
    </section>
  );
}

function JobCard({ job }: { job: ServerJob }) {
  const [hovered, setHovered] = React.useState(false);
  const label = typeLabel(job.jobType);
  const tint = typeTint(job.jobType);
  const salary = formatSalary(job);
  const requirements = parseRequirements(job.requirements);
  const locationText = job.province ? `${job.location}, ${job.province}` : job.location;

  return (
    <Link
      to={`/jobs/${job.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: colors.surface,
        border: `1px solid ${job.isFeatured ? colors.roseAccent : colors.border}`,
        borderRadius: radius.xl,
        padding: spacing["2xl"],
        boxShadow: hovered ? shadows.lg : shadows.sm,
        transform: hovered ? "translateY(-2px)" : "none",
        transition: transitions.medium,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.md,
          flexWrap: "wrap",
          marginBottom: spacing.md,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.xs,
            }}
          >
            <h3
              style={{
                fontFamily: fonts.heading,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.2,
                color: colors.text,
                margin: 0,
              }}
            >
              {job.title}
            </h3>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: `2px ${spacing.md}px`,
                borderRadius: radius.full,
                background: `${tint}18`,
                color: tint,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
            {job.isVerified ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: `2px ${spacing.md}px`,
                  borderRadius: radius.full,
                  background: `${colors.success}18`,
                  color: colors.success,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                <CheckCircle2 size={11} /> Verified
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              fontWeight: 500,
            }}
          >
            {job.company}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {relativePosted(job.createdAt)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.lg,
          fontSize: 12,
          color: colors.textTertiary,
          marginBottom: spacing.md,
        }}
      >
        <Meta Icon={MapPin} label={locationText} />
        {salary ? <Meta Icon={Banknote} label={salary} /> : null}
        <Meta Icon={Briefcase} label={label} />
        {job.licenseRequired ? (
          <Meta Icon={CheckCircle2} label={job.licenseRequired} />
        ) : null}
      </div>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: colors.textSecondary,
          margin: 0,
          marginBottom: spacing.lg,
        }}
      >
        {job.description}
      </p>

      {requirements.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.xs,
            marginBottom: spacing.lg,
          }}
        >
          {requirements.map((req) => (
            <span
              key={req}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: `${spacing.xs / 2}px ${spacing.md}px`,
                background: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.full,
                fontSize: 11,
                fontWeight: 500,
                color: colors.textSecondary,
              }}
            >
              <CheckCircle2 size={11} color={colors.success} /> {req}
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radius.md,
            background: gradients.primary,
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: shadows.brandSm,
          }}
        >
          View role <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function Meta({ Icon, label }: { Icon: typeof Clock; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Icon size={13} /> {label}
    </span>
  );
}

function LoadingList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            padding: spacing["2xl"],
            minHeight: 180,
            opacity: 0.55,
          }}
        >
          <Shimmer width="50%" height={14} />
          <div style={{ height: 8 }} />
          <Shimmer width="30%" height={10} />
          <div style={{ height: 16 }} />
          <Shimmer height={10} />
          <div style={{ height: 6 }} />
          <Shimmer width="85%" height={10} />
        </div>
      ))}
    </>
  );
}

function Shimmer({
  width = "100%",
  height = 12,
}: {
  width?: number | string;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius.xs,
        background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
        backgroundSize: "200% 100%",
        animation: "hb-shimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: spacing["2xl"],
        background: colors.dangerSoft,
        border: `1px solid ${colors.danger}33`,
        borderRadius: radius.xl,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading,
          fontSize: 16,
          fontWeight: 700,
          color: colors.danger,
          marginBottom: spacing.sm,
        }}
      >
        Couldn't load jobs
      </div>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing.xs,
          padding: `${spacing.sm}px ${spacing.lg}px`,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          fontSize: 13,
          fontWeight: 600,
          color: colors.text,
          cursor: retrying ? "wait" : "pointer",
          fontFamily: fonts.sans,
        }}
      >
        <RefreshCw size={14} className={retrying ? "hb-spin" : ""} />
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
        textAlign: "center",
        color: colors.textTertiary,
        fontSize: 14,
        background: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.xl,
      }}
    >
      No jobs listed right now. Check back soon — verified operators post new roles every week.
    </div>
  );
}
