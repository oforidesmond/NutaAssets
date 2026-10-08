"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Download, Tag, Eraser, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildAssetsCsv, downloadCsv } from "@/lib/export/csv";
import type { ExportAssetRow } from "@/lib/export/types";
import { downloadAssetsXlsx } from "@/lib/export/xlsx";
import { exportAssetsAction } from "@/server/actions/assets";
import {
  applySuggestedTagAction,
  bulkClearNeedsReviewAction,
  clearNeedsReviewAction,
  clearPlaceholderFieldsAction,
} from "@/server/actions/data-quality";

export type NeedsReviewRow = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  remarks: string | null;
  needsReview: boolean;
  reviewReasons: string[];
  updatedAt: string;
  category: { name: string };
  branch: { name: string };
  location: { name: string } | null;
  status: { name: string; color: string };
  customFields?: unknown;
  condition: string | null;
};

const REASON_LABELS: Record<string, string> = {
  DUPLICATE_SERIAL: "Duplicate serial",
  DUPLICATE_TAG: "Duplicate tag",
  MISSING_TAG: "Missing tag",
  MISSING_SERIAL: "Missing serial",
  PLACEHOLDER_VALUE: "Placeholder value",
  UNKNOWN_STATUS_MAPPED: "Mapped status",
};

export function NeedsReviewQueue({
  rows,
  total,
  canMutate,
  canExport,
}: {
  rows: NeedsReviewRow[];
  total: number;
  canMutate: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  async function markReviewed(id: string) {
    const res = await clearNeedsReviewAction(id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Marked as reviewed");
  }

  async function suggestTag(id: string) {
    const res = await applySuggestedTagAction(id);
    if (!res.ok) toast.error(res.error);
    else toast.success(`Tag set to ${res.data?.tag}`);
  }

  async function clearPlaceholders(id: string) {
    const res = await clearPlaceholderFieldsAction(id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Placeholders cleared");
  }

  async function bulkMark() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const res = await bulkClearNeedsReviewAction(ids);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Cleared ${res.data?.processed ?? ids.length} asset(s)`);
      setSelected(new Set());
    }
  }

  async function exportSelected(format: "csv" | "xlsx") {
    const ids = selected.size > 0 ? [...selected] : rows.map((r) => r.id);
    const res = await exportAssetsAction({
      filters: { needsReview: "1" },
      columns: [
        "assetTag",
        "category",
        "brand",
        "model",
        "serialNumber",
        "status",
        "branch",
        "assignedToText",
        "needsReview",
        "remarks",
      ],
      ids,
    });
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Export failed");
      return;
    }
    if (format === "csv") {
      downloadCsv(
        "needs-review.csv",
        buildAssetsCsv(
          res.data.rows as ExportAssetRow[],
          res.data.columns,
          res.data.fieldDefs,
        ),
      );
    } else {
      await downloadAssetsXlsx(
        "needs-review.xlsx",
        res.data.rows as ExportAssetRow[],
        res.data.columns,
        res.data.fieldDefs,
      );
    }
    toast.success("Export ready");
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center">
        <p className="text-sm font-medium">Nothing needs review</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Duplicate flags and placeholder issues from imports will show up here.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/assets">Back to assets</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total} asset{total === 1 ? "" : "s"} flagged
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {canMutate ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || selected.size === 0}
              onClick={() => run(bulkMark)}
            >
              <Check className="size-4" />
              Mark selected reviewed
            </Button>
          ) : null}
          {canExport ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void exportSelected("csv")}
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void exportSelected("xlsx")}
              >
                <Download className="size-4" />
                Excel
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canMutate ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === rows.length && rows.length > 0}
                    onCheckedChange={() => toggleAll()}
                    aria-label="Select all"
                  />
                </TableHead>
              ) : null}
              <TableHead>Asset</TableHead>
              <TableHead>Reasons</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const missingTag =
                !row.assetTag ||
                row.reviewReasons.includes("MISSING_TAG") ||
                row.reviewReasons.includes("PLACEHOLDER_VALUE");
              const hasDup =
                row.reviewReasons.includes("DUPLICATE_TAG") ||
                row.reviewReasons.includes("DUPLICATE_SERIAL");
              const hasPlaceholder = row.reviewReasons.includes(
                "PLACEHOLDER_VALUE",
              );

              return (
                <TableRow key={row.id}>
                  {canMutate ? (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggle(row.id)}
                        aria-label={`Select ${row.assetTag ?? row.id}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="font-medium">
                      {row.assetTag ?? "No tag"} · {row.category.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                      {row.serialNumber ? ` · S/N ${row.serialNumber}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.reviewReasons.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {REASON_LABELS[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{row.branch.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {canMutate ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => run(() => markReviewed(row.id))}
                            title="Mark reviewed"
                          >
                            <Check className="size-4" />
                          </Button>
                          {missingTag && !row.assetTag ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => run(() => suggestTag(row.id))}
                              title="Suggest tag"
                            >
                              <Tag className="size-4" />
                            </Button>
                          ) : null}
                          {hasPlaceholder ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                run(() => clearPlaceholders(row.id))
                              }
                              title="Clear placeholders"
                            >
                              <Eraser className="size-4" />
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {hasDup ? (
                        <Button size="sm" variant="ghost" asChild title="Open">
                          <Link href={`/assets/${row.id}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/assets/${row.id}`}>Open</Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
