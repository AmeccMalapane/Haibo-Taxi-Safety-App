import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Upload, Edit2, Trash2, X, Banknote } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { fares, FarePayload } from "../api/client";
import { colors, radius, spacing, shadows, fonts } from "../lib/brand";

/**
 * FaresPage — admin CRUD for canonical taxi fares.
 *
 * Distinct from City Explorer's /admin/explorer page which moderates
 * user-reported one-off fare surveys. Rows here are the baseline fares
 * the mobile TaxiFareScreen shows to commuters, managed directly by ops.
 * CSV import accepts either the legacy bundled JSON shape (fare,
 * distance, estimatedTime as strings) or the canonical shape (amount,
 * distanceKm, estimatedTimeMinutes) — see the server's
 * /api/admin/fares/import for the field fallbacks.
 */

interface FareRow {
  id: string;
  origin: string;
  destination: string;
  fare: number | null;
  fareDisplay: string;
  currency: string;
  distance: number | null;
  estimatedTime: string | null;
  association: string | null;
}

export function FaresPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FareRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const listQ = useQuery<{ data: FareRow[]; pagination: any }>({
    queryKey: ["admin", "fares", search],
    queryFn: () => fares.list({ q: search || undefined, limit: 500 }),
  });

  const rows = listQ.data?.data || [];
  const total = listQ.data?.pagination?.total || 0;

  const priceTbdCount = useMemo(
    () => rows.filter((r) => r.fare == null).length,
    [rows],
  );

  return (
    <div>
      <PageHeader
        title="Taxi fares"
        subtitle={`${total.toLocaleString()} routes · ${priceTbdCount} without a price`}
        right={
          <div style={{ display: "flex", gap: spacing.md }}>
            <Button variant="ghost" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Import CSV
            </Button>
            <Button variant="primary" onClick={() => setShowAddForm(true)}>
              <Plus size={16} /> Add fare
            </Button>
          </div>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
        style={{
          display: "flex",
          gap: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <input
          type="search"
          placeholder="Search by origin, destination, or association…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            flex: 1,
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            fontSize: 14,
            fontFamily: fonts.sans,
          }}
        />
        <Button variant="ghost" type="submit">
          Search
        </Button>
        {search ? (
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {listQ.isLoading ? (
        <LoadingState label="Loading fares…" />
      ) : listQ.isError ? (
        <ErrorState
          title="Couldn't load fares"
          error={listQ.error as Error}
          onRetry={() => listQ.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={search ? "No matches" : "No fares yet"}
          hint={
            search
              ? "Try a different search term, or clear the filter."
              : "Add your first fare above — or bulk-import a list from a CSV."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Route</TH>
              <TH>Fare</TH>
              <TH>Distance</TH>
              <TH>Time</TH>
              <TH>Association</TH>
              <TH style={{ textAlign: "right" }}>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <FareRowComponent
                key={r.id}
                row={r}
                onEdit={() => setEditing(r)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {showAddForm ? (
        <FareFormDrawer
          mode="create"
          onClose={() => setShowAddForm(false)}
        />
      ) : null}

      {editing ? (
        <FareFormDrawer
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

// ─── Row component ─────────────────────────────────────────────────

function FareRowComponent({
  row,
  onEdit,
}: {
  row: FareRow;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => fares.adminDelete(row.id),
    onSuccess: () => {
      toast.success(`Fare archived`);
      qc.invalidateQueries({ queryKey: ["admin", "fares"] });
    },
    onError: (err: any) => toast.error(err.message || "Archive failed"),
  });

  const handleDelete = () => {
    if (
      !window.confirm(
        `Archive the ${row.origin} → ${row.destination} fare? It'll stop showing in the mobile fare lookup.`,
      )
    )
      return;
    deleteMut.mutate();
  };

  const fareCell =
    row.fare != null ? (
      <div style={{ fontWeight: 700, fontVariant: "tabular-nums" }}>
        {row.currency === "ZAR" ? "R" : row.currency}
        {Number(row.fare).toFixed(2)}
      </div>
    ) : (
      <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
        Price TBD
      </span>
    );

  return (
    <tr>
      <TD>
        <div style={{ fontWeight: 600 }}>{row.origin}</div>
        <div
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          → {row.destination}
        </div>
      </TD>
      <TD>{fareCell}</TD>
      <TD>
        {row.distance != null ? (
          <span style={{ fontVariant: "tabular-nums" }}>
            {Number(row.distance).toFixed(1)} km
          </span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        )}
      </TD>
      <TD>
        {row.estimatedTime ? (
          <span>{row.estimatedTime}</span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        )}
      </TD>
      <TD style={{ fontSize: 12, color: colors.textSecondary }}>
        {row.association || "—"}
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
            disabled={deleteMut.isPending}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </TD>
    </tr>
  );
}

// ─── Add/Edit drawer ───────────────────────────────────────────────

function FareFormDrawer({
  mode,
  existing,
  onClose,
}: {
  mode: "create" | "edit";
  existing?: FareRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Parse the existing estimatedTime string ("48 minutes") back into a
  // number for the numeric input; the public shape only exposes the
  // string form.
  const existingMinutes = existing?.estimatedTime
    ? parseInt(existing.estimatedTime, 10) || null
    : null;

  const [form, setForm] = useState<FarePayload>({
    origin: existing?.origin || "",
    destination: existing?.destination || "",
    amount: existing?.fare ?? null,
    currency: existing?.currency || "ZAR",
    distanceKm: existing?.distance ?? null,
    estimatedTimeMinutes: existingMinutes,
    association: existing?.association || "",
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (mode === "edit" && existing) {
        return fares.adminUpdate(existing.id, form);
      }
      return fares.adminCreate(form);
    },
    onSuccess: () => {
      toast.success(
        mode === "edit"
          ? `${form.origin} → ${form.destination} updated`
          : `${form.origin} → ${form.destination} added`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "fares"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Save failed"),
  });

  const canSave =
    form.origin.trim().length > 0 && form.destination.trim().length > 0;

  return (
    <Drawer
      title={
        mode === "edit"
          ? `Edit ${existing?.origin} → ${existing?.destination}`
          : "Add a taxi fare"
      }
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: spacing.md,
          }}
        >
          <Field label="Origin" required>
            <input
              type="text"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              maxLength={200}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Destination" required>
            <input
              type="text"
              value={form.destination}
              onChange={(e) =>
                setForm({ ...form, destination: e.target.value })
              }
              maxLength={200}
              required
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px",
            gap: spacing.md,
          }}
        >
          <Field label="Fare" hint="leave blank for Price TBD">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100000}
              value={form.amount ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Currency">
            <input
              type="text"
              value={form.currency || "ZAR"}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value.toUpperCase() })
              }
              maxLength={4}
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: spacing.md,
          }}
        >
          <Field label="Distance (km)">
            <input
              type="number"
              step="0.1"
              min={0}
              max={10000}
              value={form.distanceKm ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  distanceKm: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Travel time (minutes)">
            <input
              type="number"
              step="1"
              min={0}
              max={86400}
              value={form.estimatedTimeMinutes ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimatedTimeMinutes: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                })
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Association" hint="operating taxi association — optional">
          <input
            type="text"
            value={form.association || ""}
            onChange={(e) =>
              setForm({ ...form, association: e.target.value })
            }
            maxLength={200}
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
                : "Add fare"}
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
    mutationFn: (toImport: any[]) => fares.adminImport(toImport),
    onSuccess: (res: any) => {
      toast.success(
        `${res.inserted} fares imported · ${res.rejected?.length || 0} rejected`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "fares"] });
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
          throw new Error("JSON must be an array of fare objects");
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
    <Drawer title="Import fares from CSV or JSON" onClose={onClose}>
      <div style={{ padding: spacing["2xl"] }}>
        <p style={{ color: colors.textSecondary, marginBottom: spacing.xl }}>
          Required columns:{" "}
          <code
            style={{
              background: colors.surface,
              padding: "1px 6px",
              borderRadius: radius.sm,
              fontFamily: fonts.mono,
              fontSize: 12,
            }}
          >
            origin, destination
          </code>
          . Optional:{" "}
          <code
            style={{
              background: colors.surface,
              padding: "1px 6px",
              borderRadius: radius.sm,
              fontFamily: fonts.mono,
              fontSize: 12,
            }}
          >
            amount (or fare), distanceKm (or distance), estimatedTimeMinutes
            (or estimatedTime as "48 minutes"), association, currency
          </code>
          . The server accepts both the canonical column names and the
          legacy taxi_routes_fares.json shape. Up to 5,000 rows per upload.
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

function parseCsv(text: string): any[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2)
    throw new Error("CSV must have a header row + data rows");
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const numericCols = new Set([
    "amount",
    "fare",
    "distanceKm",
    "distance",
    "estimatedTimeMinutes",
  ]);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 1 && cells[0] === "") continue;
    const obj: any = {};
    headers.forEach((h, idx) => {
      const raw = (cells[idx] ?? "").trim();
      if (raw === "") {
        obj[h] = null;
      } else if (numericCols.has(h)) {
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
