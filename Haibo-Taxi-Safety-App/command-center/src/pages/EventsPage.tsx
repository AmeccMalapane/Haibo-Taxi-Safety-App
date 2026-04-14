import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors } from "../lib/brand";

interface Event {
  id: string;
  createdAt: string | null;
  status: string;
  title: string;
  description: string;
  category: string;
  eventDate: string | null;
  location: string;
  venue: string | null;
  province: string | null;
  organizer: string;
  organizerPhone: string | null;
  ticketPrice: number | null;
  currentAttendees: number | null;
  maxAttendees: number | null;
  isVerified: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
}

const config: ModerationQueueConfig<Event> = {
  title: "Events",
  subtitle: "community meetups, safety training, launches",
  resource: "events",
  queryKey: "moderation:events",
  emptyHint:
    "Community organizers post events through the app. Verify legitimate organizers and feature high-quality ones.",
  tabs: [
    { label: "Upcoming", value: "upcoming" },
    { label: "Ongoing", value: "ongoing" },
    { label: "Completed", value: "completed" },
    { label: "Cancelled", value: "cancelled" },
  ],
  getId: (e) => e.id,
  getStatus: (e) => e.status,
  columns: [
    {
      header: "Event",
      truncate: true,
      cell: (e) => (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {e.imageUrl ? (
            <img
              src={e.imageUrl}
              alt=""
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                objectFit: "cover",
                border: `1px solid ${colors.border}`,
                flexShrink: 0,
              }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{e.title}</div>
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              {e.category}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "When",
      cell: (e) =>
        e.eventDate ? (
          <div>
            <div style={{ fontWeight: 600 }}>
              {new Date(e.eventDate).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              {new Date(e.eventDate).toLocaleTimeString("en-ZA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Where",
      truncate: true,
      cell: (e) => (
        <div>
          <div>{e.location}</div>
          {e.province ? (
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              {e.province}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Organizer",
      cell: (e) => (
        <div>
          <div style={{ fontWeight: 600 }}>{e.organizer}</div>
          {e.organizerPhone ? (
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              {e.organizerPhone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Ticket",
      cell: (e) =>
        !e.ticketPrice ? (
          <Badge tone="success">FREE</Badge>
        ) : (
          <span style={{ fontVariant: "tabular-nums", fontWeight: 600 }}>
            R{Number(e.ticketPrice).toFixed(0)}
          </span>
        ),
    },
    {
      header: "RSVPs",
      cell: (e) => (
        <span style={{ fontVariant: "tabular-nums" }}>
          {e.currentAttendees || 0}
          {e.maxAttendees ? ` / ${e.maxAttendees}` : ""}
        </span>
      ),
    },
    {
      header: "Flags",
      cell: (e) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {e.isVerified ? <Badge tone="success">verified</Badge> : null}
          {e.isFeatured ? <Badge tone="rose">featured</Badge> : null}
        </div>
      ),
    },
  ],
  actions: [
    {
      label: "Verify",
      variant: "primary",
      when: (e) => !e.isVerified,
      patch: { isVerified: true },
    },
    {
      label: "Unverify",
      variant: "secondary",
      when: (e) => e.isVerified,
      patch: { isVerified: false },
    },
    {
      label: "Feature",
      variant: "primary",
      when: (e) => !e.isFeatured && (e.status === "upcoming" || e.status === "ongoing"),
      patch: { isFeatured: true },
    },
    {
      label: "Unfeature",
      variant: "secondary",
      when: (e) => e.isFeatured,
      patch: { isFeatured: false },
    },
    {
      label: "Cancel",
      variant: "danger",
      when: (e) => e.status === "upcoming" || e.status === "ongoing",
      patch: { status: "cancelled" },
      confirmMessage: "Cancel this event? Attendees will see it marked cancelled in the app.",
    },
  ],
};

export function EventsPage() {
  return <ModerationQueue config={config} />;
}
