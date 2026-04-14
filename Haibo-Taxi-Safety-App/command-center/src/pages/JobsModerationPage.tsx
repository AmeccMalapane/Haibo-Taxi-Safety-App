import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors } from "../lib/brand";

interface Job {
  id: string;
  createdAt: string | null;
  status: string;
  title: string;
  company: string;
  location: string;
  province: string | null;
  jobType: string;
  category: string;
  salary: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  viewCount: number | null;
  applicationCount: number | null;
}

const config: ModerationQueueConfig<Job> = {
  title: "Jobs",
  subtitle: "driver, marshal, and operator listings",
  resource: "jobs",
  queryKey: "moderation:jobs",
  emptyHint: "Verify legitimate employers and feature high-quality listings.",
  tabs: [
    { label: "Active", value: "active" },
    { label: "Closed", value: "closed" },
    { label: "Expired", value: "expired" },
  ],
  getId: (j) => j.id,
  getStatus: (j) => j.status,
  columns: [
    {
      header: "Posted",
      cell: (j) =>
        j.createdAt ? new Date(j.createdAt).toLocaleDateString("en-ZA") : "—",
    },
    {
      header: "Title",
      truncate: true,
      cell: (j) => (
        <div>
          <div style={{ fontWeight: 600 }}>{j.title}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {j.company}
          </div>
        </div>
      ),
    },
    {
      header: "Location",
      cell: (j) => (
        <div>
          <div>{j.location}</div>
          {j.province ? (
            <div style={{ fontSize: 11, color: colors.textTertiary }}>{j.province}</div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Type",
      cell: (j) => (
        <div>
          <Badge tone="info">{j.jobType}</Badge>
          <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
            {j.category}
          </div>
        </div>
      ),
    },
    {
      header: "Salary",
      cell: (j) =>
        j.salary || <span style={{ color: colors.textTertiary }}>—</span>,
    },
    {
      header: "Flags",
      cell: (j) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {j.isVerified ? <Badge tone="success">verified</Badge> : null}
          {j.isFeatured ? <Badge tone="rose">featured</Badge> : null}
        </div>
      ),
    },
    {
      header: "Stats",
      cell: (j) => (
        <div style={{ fontVariant: "tabular-nums", fontSize: 12 }}>
          <div>{j.viewCount || 0} views</div>
          <div style={{ color: colors.textTertiary }}>
            {j.applicationCount || 0} apps
          </div>
        </div>
      ),
    },
  ],
  actions: [
    {
      label: "Verify",
      variant: "primary",
      when: (j) => !j.isVerified,
      patch: { isVerified: true },
    },
    {
      label: "Unverify",
      variant: "secondary",
      when: (j) => j.isVerified,
      patch: { isVerified: false },
    },
    {
      label: "Feature",
      variant: "primary",
      when: (j) => !j.isFeatured && j.status === "active",
      patch: { isFeatured: true },
    },
    {
      label: "Unfeature",
      variant: "secondary",
      when: (j) => j.isFeatured,
      patch: { isFeatured: false },
    },
    {
      label: "Close",
      variant: "danger",
      when: (j) => j.status === "active",
      patch: { status: "closed" },
      confirmMessage: "Close this listing? Applicants won't be able to apply anymore.",
    },
    {
      label: "Reopen",
      variant: "primary",
      when: (j) => j.status === "closed",
      patch: { status: "active" },
    },
  ],
};

export function JobsModerationPage() {
  return <ModerationQueue config={config} />;
}
