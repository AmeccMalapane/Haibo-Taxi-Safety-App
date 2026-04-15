import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  MapPin,
  Banknote,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Award,
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
  contactPhone: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  experienceLevel: string | null;
  licenseRequired: string | null;
  benefits: string[] | null;
  applicationDeadline: string | null;
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
const EXPERIENCE_LABELS: Record<string, string> = {
  entry: "Entry level",
  intermediate: "Intermediate",
  senior: "Senior",
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
  return raw
    .split(/[\n;•]+/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter((s) => s.length > 0);
}

function formatPosted(iso: string | null): string {
  if (!iso) return "Recently posted";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently posted";
  return `Posted ${d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ServerJob>({
    queryKey: ["public", "jobs", jobId],
    queryFn: () => jobsApi.getById(jobId!),
    enabled: !!jobId,
    retry: (count, err: any) => {
      const msg = err?.message || "";
      if (msg.startsWith("404")) return false;
      return count < 2;
    },
  });

  usePageMeta({
    title: data?.title ? `${data.title} — ${data.company} · Haibo! jobs` : "Job — Haibo!",
    description:
      data?.description?.slice(0, 160) || "Job listing on the Haibo! jobs board.",
  });

  const notFound =
    isError && typeof (error as Error)?.message === "string" && (error as Error).message.startsWith("404");

  return (
    <div>
      <TopBar />
      <section
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: `${spacing.xl}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
        }}
      >
        {isLoading ? (
          <LoadingState />
        ) : notFound ? (
          <NotFoundState />
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || "Couldn't load this job."}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : data ? (
          <JobBody job={data} />
        ) : null}
      </section>
      <style>{`
        @keyframes hb-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes hb-spin { to { transform: rotate(360deg); } }
        .hb-spin { animation: hb-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function TopBar() {
  return (
    <div
      style={{
        background: colors.surfaceAlt,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: `${spacing.lg}px ${spacing["2xl"]}px`,
        }}
      >
        <Link
          to="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            fontSize: 13,
            fontWeight: 600,
            color: colors.textSecondary,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> All jobs
        </Link>
      </div>
    </div>
  );
}

function JobBody({ job }: { job: ServerJob }) {
  const label = typeLabel(job.jobType);
  const tint = typeTint(job.jobType);
  const salary = formatSalary(job);
  const requirements = parseRequirements(job.requirements);
  const locationText = job.province ? `${job.location}, ${job.province}` : job.location;
  const deadline = formatDeadline(job.applicationDeadline);
  const experience = job.experienceLevel
    ? EXPERIENCE_LABELS[job.experienceLevel.toLowerCase()] || job.experienceLevel
    : null;
  const hasContact =
    !!job.contactPhone || !!job.contactEmail || !!job.contactWhatsapp;

  return (
    <article>
      {/* Hero */}
      <div
        style={{
          display: "flex",
          gap: spacing["2xl"],
          marginTop: spacing["2xl"],
        }}
        className="hb-job-detail-hero"
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.lg,
            background: gradients.primary,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: shadows.brandSm,
          }}
        >
          <Briefcase size={28} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Badge label={label} tint={tint} />
            {job.isVerified ? (
              <Badge label="Verified" tint={colors.success} icon={CheckCircle2} />
            ) : null}
            {job.isFeatured ? <Badge label="Featured" tint={colors.rose} /> : null}
          </div>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -0.6,
              color: colors.text,
              margin: 0,
            }}
          >
            {job.title}
          </h1>
          <div
            style={{
              marginTop: spacing.sm,
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            <span style={{ fontWeight: 600, color: colors.text }}>{job.company}</span>
            <span style={{ margin: `0 ${spacing.sm}px`, color: colors.textTertiary }}>·</span>
            <span>{locationText}</span>
          </div>
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: 12,
              color: colors.textTertiary,
            }}
          >
            {formatPosted(job.createdAt)}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div
        style={{
          marginTop: spacing["2xl"],
          padding: spacing["2xl"],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: spacing.xl,
          boxShadow: shadows.sm,
        }}
        className="hb-job-meta-grid"
      >
        <MetaBlock Icon={Banknote} label="Salary" value={salary || "Negotiable"} />
        <MetaBlock Icon={Briefcase} label="Type" value={label} />
        <MetaBlock Icon={Award} label="Level" value={experience || "Any"} />
        <MetaBlock
          Icon={Clock}
          label="Apply by"
          value={deadline || "No deadline"}
        />
      </div>

      {/* Description */}
      <section style={{ marginTop: spacing["3xl"] }}>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: -0.2,
            color: colors.text,
            marginBottom: spacing.md,
          }}
        >
          About this role
        </h2>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.7,
            color: colors.textSecondary,
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {job.description}
        </p>
      </section>

      {/* Requirements */}
      {requirements.length > 0 ? (
        <section style={{ marginTop: spacing["3xl"] }}>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            What you'll need
          </h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            {requirements.map((req) => (
              <li
                key={req}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: spacing.md,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: colors.textSecondary,
                }}
              >
                <CheckCircle2
                  size={16}
                  color={colors.success}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Benefits */}
      {job.benefits && job.benefits.length > 0 ? (
        <section style={{ marginTop: spacing["3xl"] }}>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Benefits
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {job.benefits.map((b) => (
              <span
                key={b}
                style={{
                  padding: `${spacing.xs}px ${spacing.md}px`,
                  borderRadius: radius.full,
                  background: colors.roseFaint,
                  color: colors.rose,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* License requirement callout */}
      {job.licenseRequired ? (
        <div
          style={{
            marginTop: spacing["2xl"],
            padding: spacing.xl,
            background: colors.warningSoft,
            border: `1px solid ${colors.warning}40`,
            borderRadius: radius.lg,
            display: "flex",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <CheckCircle2 size={20} color={colors.warning} strokeWidth={2.2} />
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: colors.warning,
              }}
            >
              License required
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.text,
                marginTop: 2,
              }}
            >
              {job.licenseRequired}
            </div>
          </div>
        </div>
      ) : null}

      {/* Contact section */}
      {hasContact ? (
        <section style={{ marginTop: spacing["3xl"] }}>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Contact the operator
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            {job.contactPhone ? (
              <ContactRow Icon={Phone} label={job.contactPhone} href={`tel:${job.contactPhone}`} />
            ) : null}
            {job.contactEmail ? (
              <ContactRow
                Icon={Mail}
                label={job.contactEmail}
                href={`mailto:${job.contactEmail}`}
              />
            ) : null}
            {job.contactWhatsapp ? (
              <ContactRow
                Icon={MessageCircle}
                label={`WhatsApp ${job.contactWhatsapp}`}
                href={`https://wa.me/${job.contactWhatsapp.replace(/[^0-9]/g, "")}`}
                external
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <div
        style={{
          marginTop: spacing["3xl"],
          padding: spacing["2xl"],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          boxShadow: shadows.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.lg,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: colors.textTertiary,
            }}
          >
            Ready to apply?
          </div>
          <div
            style={{
              fontFamily: fonts.heading,
              fontSize: 18,
              fontWeight: 700,
              color: colors.text,
              marginTop: 2,
            }}
          >
            Submissions open soon
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Applications open soon"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.md}px ${spacing["2xl"]}px`,
            borderRadius: radius.md,
            background: gradients.primary,
            color: "#FFFFFF",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
            boxShadow: shadows.brandSm,
          }}
        >
          Apply now <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .hb-job-detail-hero { flex-direction: column !important; }
          .hb-job-meta-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </article>
  );
}

function Badge({
  label,
  tint,
  icon: Icon,
}: {
  label: string;
  tint: string;
  icon?: typeof CheckCircle2;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
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
      {Icon ? <Icon size={11} strokeWidth={2.4} /> : null}
      {label}
    </span>
  );
}

function MetaBlock({
  Icon,
  label,
  value,
}: {
  Icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.textTertiary,
          marginBottom: 4,
        }}
      >
        <Icon size={12} /> {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.text,
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ContactRow({
  Icon,
  label,
  href,
  external,
}: {
  Icon: typeof Phone;
  label: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        color: colors.text,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 500,
        width: "fit-content",
        background: colors.surface,
        transition: transitions.medium,
      }}
    >
      <Icon size={14} color={colors.rose} /> {label}
    </a>
  );
}

function LoadingState() {
  return (
    <div
      aria-hidden
      style={{
        marginTop: spacing["2xl"],
        display: "flex",
        flexDirection: "column",
        gap: spacing.lg,
      }}
    >
      <div style={{ display: "flex", gap: spacing["2xl"] }}>
        <Shimmer size={72} />
        <div style={{ flex: 1 }}>
          <Shimmer width="30%" height={10} />
          <div style={{ height: 10 }} />
          <Shimmer width="70%" height={18} />
          <div style={{ height: 8 }} />
          <Shimmer width="50%" height={10} />
        </div>
      </div>
      <Shimmer height={100} />
      <Shimmer height={10} />
      <Shimmer width="90%" height={10} />
      <Shimmer width="80%" height={10} />
    </div>
  );
}

function Shimmer({
  width = "100%",
  height = 12,
  size,
}: {
  width?: number | string;
  height?: number;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size ?? width,
        height: size ?? height,
        borderRadius: radius.md,
        background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
        backgroundSize: "200% 100%",
        animation: "hb-shimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

function NotFoundState() {
  return (
    <div
      style={{
        marginTop: spacing["2xl"],
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
        background: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.xl,
        textAlign: "center",
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
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: spacing.lg,
        }}
      >
        <Sparkles size={12} /> Position closed
      </div>
      <h2
        style={{
          fontFamily: fonts.heading,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.4,
          color: colors.text,
          marginBottom: spacing.sm,
        }}
      >
        This role is no longer open.
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: colors.textSecondary,
          maxWidth: 440,
          margin: `0 auto ${spacing.xl}px`,
        }}
      >
        It may have been filled or withdrawn. Browse the full jobs board for
        currently open positions.
      </p>
      <Link
        to="/jobs"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing.xs,
          padding: `${spacing.md}px ${spacing.xl}px`,
          borderRadius: radius.md,
          background: gradients.primary,
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: shadows.brandSm,
        }}
      >
        Browse jobs <ArrowRight size={15} />
      </Link>
    </div>
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
        marginTop: spacing["2xl"],
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
        Couldn't load this job
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
