import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, complaints as complaintsApi } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, severityTone, statusTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";

export function ComplaintsPage() {
  const qc = useQueryClient();

  const complaintsQ = useQuery({
    queryKey: ["complaints"],
    queryFn: () => complaintsApi.list(),
  });

  const resolveM = useMutation({
    mutationFn: (id: string) =>
      admin.updateComplaint(id, {
        status: "resolved",
        resolution: "Resolved via Command Center",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
    },
  });

  const items: any[] = complaintsQ.data?.data || [];
  const pendingCount = items.filter((c) => c.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Complaints"
        subtitle={
          complaintsQ.isSuccess
            ? `${pendingCount} pending · ${items.length} total`
            : undefined
        }
      />

      {complaintsQ.isError ? (
        <ErrorState error={complaintsQ.error} onRetry={() => complaintsQ.refetch()} />
      ) : complaintsQ.isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="No complaints filed" />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Date</TH>
              <TH>Category</TH>
              <TH>Severity</TH>
              <TH>Plate</TH>
              <TH>Description</TH>
              <TH>Status</TH>
              <TH>Action</TH>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <TD>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</TD>
                <TD>{c.category}</TD>
                <TD>
                  <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                </TD>
                <TD>{c.taxiPlateNumber || "—"}</TD>
                <TD truncate>{c.description}</TD>
                <TD>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </TD>
                <TD>
                  {c.status === "pending" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => resolveM.mutate(c.id)}
                      disabled={resolveM.isPending}
                    >
                      Resolve
                    </Button>
                  ) : null}
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
