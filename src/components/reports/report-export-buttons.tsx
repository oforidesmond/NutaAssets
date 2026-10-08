"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildAssetsCsv, downloadCsv } from "@/lib/export/csv";
import { downloadAssetsXlsx } from "@/lib/export/xlsx";
import type { ExportAssetRow } from "@/lib/export/types";
import { exportAssetsAction } from "@/server/actions/assets";

const DEFAULT_COLS = [
  "assetTag",
  "category",
  "brand",
  "model",
  "serialNumber",
  "status",
  "branch",
  "location",
  "assignedToText",
  "remarks",
  "needsReview",
];

export function ReportExportButtons({
  assetIds,
  filters,
}: {
  assetIds?: string[];
  filters?: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);

  async function loadRows() {
    const res = await exportAssetsAction({
      filters: filters ?? {},
      columns: DEFAULT_COLS,
      ids: assetIds,
    });
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Export failed");
      return null;
    }
    return res.data;
  }

  async function onCsv() {
    setBusy(true);
    try {
      const data = await loadRows();
      if (!data) return;
      const csv = buildAssetsCsv(
        data.rows as ExportAssetRow[],
        data.columns,
        data.fieldDefs,
      );
      downloadCsv(`report-${Date.now()}.csv`, csv);
      toast.success("CSV downloaded");
    } finally {
      setBusy(false);
    }
  }

  async function onXlsx() {
    setBusy(true);
    try {
      const data = await loadRows();
      if (!data) return;
      await downloadAssetsXlsx(
        `report-${Date.now()}.xlsx`,
        data.rows as ExportAssetRow[],
        data.columns,
        data.fieldDefs,
      );
      toast.success("Excel downloaded");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print:hidden flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => window.print()}
      >
        <Printer className="size-4" />
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void onCsv()}
      >
        <Download className="size-4" />
        CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void onXlsx()}
      >
        <Download className="size-4" />
        Excel
      </Button>
    </div>
  );
}
