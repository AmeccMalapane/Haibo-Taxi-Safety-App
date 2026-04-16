import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Upload, MapPin, Edit2, Trash2, X } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Button } from "../components/Button";
import { Badge, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { locations, LocationPayload } from "../api/client";
import { colors, radius, spacing, shadows, fonts } from "../lib/brand";

/**
 * LocationsPage — admin-direct CRUD for taxi ranks.
 *
 * Distinct from LocationsModerationPage which handles user-submitted rank
 * contributions via the moderation queue. Rows created here bypass the
 * approval queue (verification_status = "verified") because the admin is
 * already a trusted source. Bulk imports go through the same POST
 * /api/admin/locations/import endpoint that validates each row and
 * returns a rejected-rows report.
 */

interface LocationRow {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  capacity: number | null;
  verificationStatus: string;
  isActive: boolean;
  addedDate: string | null;
  lastUpdated: string | null;
}

type StatusFilter = "all" | "pending" | "verified" | "rejected";

const LOCATION_TYPES: Array<{ value: string; label: string }> = [
  { value: "rank", label: "Taxi rank" },
  { value: "formal_stop", label: "Formal stop" },
  { value: "informal_stop", label: "Informal stop" },
  { value: "landmark", label: "Landmark" },
  { value: "interchange", label: "Interchange" },
];

export function LocationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Reuses the public /api/locations endpoint for the full list. We don't
  // filter by status server-side because the public endpoint doesn't
  // expose that parameter — client-side filter against the 264 ranks is
  // fine at launch scale.
  const listQ = useQuery<{ data: LocationRow[]; pagination: any }>({
    queryKey: ["admin", "locations", "all"],
    queryFn: () => locations.list(1, 500),
  });

  const rows = useMemo(() => {
    const all = listQ.data?.data || [];
    if (statusFilter === "all") return all;
    return all.filter((r) => r.verificationStatus === statusFilter);
  }, [listQ.data, statusFilter]);

  const counts = useMemo(() => {
    const all = listQ.data?.data || [];
    return {
      all: all.length,
      pending: all.filter((r) => r.verificationStatus === "pending").length,
      verified: all.filter((r) => r.verificationStatus === "verified").length,
      rejected: all.filter((r) => r.verificationStatus === "rejected").length,
    };
  }, [listQ.data]);

  return (
    <div>
      <PageHeader
        title="Taxi ranks"
        subtitle={`${counts.all.toLocaleString()} ranks · ${counts.pending} pending review`}
        right={
          <div style={{ display: "flex", gap: spacing.md }}>
            <Button variant="ghost" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Import CSV
            </Button>
            <Button variant="primary" onClick={() => setShowAddForm(true)}>
              <Plus size={16} /> Add rank
            </Button>
          </div>
        }
      />

      <StatusTabs
        counts={counts}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      {listQ.isLoading ? (
        <LoadingState label="Loading ranks…" />
      ) : listQ.isError ? (
        <ErrorState
          title="Couldn't load ranks"
          error={listQ.error as Error}
          onRetry={() => listQ.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            statusFilter === "all"
              ? "No taxi ranks yet"
              : `No ${statusFilter} ranks`
          }
          hint={
            statusFilter === "all"
              ? "Add your first rank above — or import a batch from a CSV."
              : "Switch the status filter to see other ranks."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Coordinates</TH>
              <TH>Address</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: "right" }}>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <LocationRow
                key={r.id}
                row={r}
                onEdit={() => setEditing(r)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {showAddForm ? (
        <LocationFormDrawer
          mode="create"
          onClose={() => setShowAddForm(false)}
        />
      ) : null}

      {editing ? (
        <LocationFormDrawer
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {showImport ? (
        <ImportDrawer onClose={() => setShowImport(false)} />
      ) : null}
    </div>
  );
}

// ─── Status filter tabs ─────────────────────────────────────────────

function StatusTabs({
  counts,
  active,
  onChange,
}: {
  counts: { all: number; pending: number; verified: number; rejected: number };
  active: StatusFilter;
  onChange: (next: StatusFilter) => void;
}) {
  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Pending review", count: counts.pending },
    { value: "verified", label: "Verified", count: counts.verified },
    { value: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        marginBottom: spacing.lg,
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: spacing.md,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.full,
              border: `1px solid ${isActive ? colors.rose : colors.border}`,
              background: isActive ? colors.rose : colors.surface,
              color: isActive ? "#FFFFFF" : colors.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab.label}
            <span
              style={{
                padding: "1px 7px",
                borderRadius: radius.full,
                background: isActive ? "rgba(255,255,255,0.22)" : colors.rose,
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Row component ─────────────────────────────────────────────────

function LocationRow({
  row,
  onEdit,
}: {
  row: LocationRow;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => locations.adminDelete(row.id),
    onSuccess: () => {
      toast.success(`${row.name} archived`);
      qc.invalidateQueries({ queryKey: ["admin", "locations"] });
    },
    onError: (err: any) => toast.error(err.message || "Archive failed"),
  });

  const handleDelete = () => {
    if (
      !window.confirm(
        `Archive "${row.name}"? It'll stop appearing on the public map but historical references stay intact.`,
      )
    )
      return;
    deleteMut.mutate();
  };

  const tone = statusTone(row.verificationStatus);

  return (
    <tr style={{ opacity: row.isActive ? 1 : 0.55 }}>
      <TD>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <MapPin size={14} color={colors.rose} />
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            {row.description ? (
              <div style={{ fontSize: 11, color: colors.textTertiary }}>
                {row.description.slice(0, 60)}
                {row.description.length > 60 ? "…" : ""}
              </div>
            ) : null}
          </div>
        </div>
      </TD>
      <TD>
        <Badge>{row.type.replace("_", " ")}</Badge>
      </TD>
      <TD>
        <span style={{ fontFamily: fonts.mono, fontSize: 11 }}>
          {Number(row.latitude).toFixed(4)},{" "}
          {Number(row.longitude).toFixed(4)}
        </span>
      </TD>
      <TD style={{ fontSize: 12, color: colors.textSecondary }}>
        {row.address || "—"}
      </TD>
      <TD>
        <Badge tone={tone}>{row.verificationStatus}</Badge>
        {!row.isActive ? (
          <span style={{ marginLeft: 6 }}>
            <Badge tone="neutral">archived</Badge>
          </span>
        ) : null}
      </TD>
      <TD style={{ textAlign: "right" }}>
        <div
          style={{
            display: "inline-flex",
            gap: spacing.sm,
            justifyContent: "flex-end",
          }}
        >
          <Button variant="ghost" onClick={onEdit}>
            <Edit2 size={14} />
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!row.isActive || deleteMut.isPending}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </TD>
    </tr>
  );
}

// ─── Add/Edit drawer ───────────────────────────────────────────────

function LocationFormDrawer({
  mode,
  existing,
  onClose,
}: {
  mode: "create" | "edit";
  existing?: LocationRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<LocationPayload>({
    name: existing?.name || "",
    type: (existing?.type as any) || "rank",
    latitude: existing?.latitude ?? 0,
    longitude: existing?.longitude ?? 0,
    address: existing?.address || "",
    description: existing?.description || "",
    capacity: existing?.capacity ?? null,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (mode === "edit" && existing) {
        return locations.adminUpdate(existing.id, form);
      }
      return locations.adminCreate(form);
    },
    onSuccess: () => {
      toast.success(
        mode === "edit"
          ? `${form.name} updated`
          : `${form.name} added to the public map`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "locations"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Save failed");
    },
  });

  const canSave =
    form.name.trim().length > 0 &&
    Number.isFinite(form.latitude) &&
    Number.isFinite(form.longitude) &&
    Math.abs(form.latitude) <= 90 &&
    Math.abs(form.longitude) <= 180;

  return (
    <Drawer
      title={mode === "edit" ? `Edit ${existing?.name}` : "Add a taxi rank"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          saveMut.mutate();
        }}
        style={{ padding: spacing["2xl"], display: "grid", gap: spacing.lg }}
      >
        <Field label="Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={200}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as any })
            }
            style={inputStyle}
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
          <Field label="Latitude" required>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) =>
                setForm({ ...form, latitude: parseFloat(e.target.value) })
              }
              required
              min={-90}
              max={90}
              style={inputStyle}
            />
          </Field>
          <Field label="Longitude" required>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) =>
                setForm({ ...form, longitude: parseFloat(e.target.value) })
              }
              required
              min={-180}
              max={180}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Address" hint="street, suburb, city · Gauteng">
          <input
            type="text"
            value={form.address || ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            maxLength={300}
            style={inputStyle}
          />
        </Field>

        <Field label="Description" hint="any notes for commuters">
          <textarea
            value={form.description || ""}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            maxLength={1000}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        <Field label="Capacity" hint="approximate number of taxis — optional">
          <input
            type="number"
            min={0}
            max={10000}
            value={form.capacity ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                capacity: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            style={inputStyle}
          />
        </Field>

        <div
          style={{
            display: "flex",
            gap: spacing.md,
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!canSave || saveMut.isPending}
          >
            {saveMut.isPending
              ? "Saving…"
              : mode === "edit"
                ? "Save changes"
                : "Add rank"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// ─── CSV import drawer ─────────────────────────────────────────────

function ImportDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const importMut = useMutation({
    mutationFn: (toImport: any[]) => locations.adminImport(toImport),
    onSuccess: (res: any) => {
      toast.success(
        `${res.inserted} ranks imported · ${res.rejected?.length || 0} rejected`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "locations"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Import failed"),
  });

  const handleFile = async (f: File) => {
    setFileName(f.name);
    setParseError(null);
    try {
      const text = await f.text();
      let parsed: any[];
      if (f.name.toLowerCase().endsWith(".json")) {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed))
          throw new Error("JSON must be an array of rank objects");
      } else {
        parsed = parseCsv(text);
      }
      setRows(parsed);
    } catch (err: any) {
      setParseError(err.message || "Parse failed");
      setRows(null);
    }
  };

  return (
    <Drawer title="Import ranks from CSV or JSON" onClose={onClose}>
      <div style={{ padding: spacing["2xl"] }}>
        <p style={{ color: colors.textSecondary, marginBottom: spacing.xl }}>
          CSV headers must include{" "}
          <code
            style={{
              background: colors.surface,
              padding: "1px 6px",
              borderRadius: radius.sm,
              fontFamily: fonts.mono,
              fontSize: 12,
            }}
          >
            name, latitude, longitude
          </code>
          . Optional columns: type, city, province, address, description,
          capacity. JSON accepts the same keys as an array of objects. Up to
          5,000 rows per upload; bad rows are reported back.
        </p>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `2px dashed ${colors.border}`,
            borderRadius: radius.lg,
            padding: spacing["3xl"],
            cursor: "pointer",
            background: colors.surface,
          }}
        >
          <Upload size={24} color={colors.textTertiary} />
          <div style={{ marginTop: spacing.sm, fontWeight: 600 }}>
            {fileName || "Click or drag a file here"}
          </div>
          <div
            style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
          >
            {rows ? `${rows.length} rows ready to import` : "CSV or JSON"}
          </div>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            style={{ display: "none" }}
          />
        </label>

        {parseError ? (
          <div
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              background: "rgba(194, 23, 37, 0.08)",
              color: colors.danger,
              fontSize: 13,
            }}
          >
            {parseError}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: spacing.md,
            marginTop: spacing["2xl"],
            paddingTop: spacing.lg,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!rows || rows.length === 0 || importMut.isPending}
            onClick={() => rows && importMut.mutate(rows)}
          >
            {importMut.isPending
              ? "Importing…"
              : rows
                ? `Import ${rows.length} rows`
                : "Import"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────

/**
 * Minimal CSV parser: first line is headers, comma-separated, quoted
 * fields support embedded commas. Good enough for ops-supplied files.
 * For anything gnarlier (embedded newlines etc.) swap in papaparse later.
 */
function parseCsv(text: string): any[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row + data rows");
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 1 && cells[0] === "") continue;
    const obj: any = {};
    headers.forEach((h, idx) => {
      const raw = (cells[idx] ?? "").trim();
      if (raw === "") {
        obj[h] = null;
      } else if (h === "latitude" || h === "longitude" || h === "capacity") {
        obj[h] = parseFloat(raw);
      } else {
        obj[h] = raw;
      }
    });
    rows.push(obj);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          background: colors.surface,
          boxShadow: shadows.lg,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div
          style={{
            padding: `${spacing.lg}px ${spacing["2xl"]}px`,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontFamily: fonts.heading,
              fontWeight: 700,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: spacing.sm,
              color: colors.textSecondary,
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
        {label}
        {required ? (
          <span style={{ color: colors.rose, marginLeft: 4 }}>*</span>
        ) : null}
        {hint ? (
          <span
            style={{
              fontWeight: 400,
              color: colors.textTertiary,
              marginLeft: 6,
            }}
          >
            · {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  fontSize: 14,
  fontFamily: fonts.sans,
};
