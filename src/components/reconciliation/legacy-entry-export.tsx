"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadLegacyBranchSheet } from "@/lib/export/legacy-sheet";
import { exportEntryLegacyAction } from "@/server/actions/reconciliation";

export function LegacyEntryExport({
  entryId,
  branchName,
}: {
  entryId: string;
  branchName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await exportEntryLegacyAction(entryId);
          if (!res.ok || !res.data) {
            toast.error(res.error ?? "Export failed.");
            return;
          }
          const safe = branchName.replace(/[^\w.-]+/g, "_");
          await downloadLegacyBranchSheet(
            `${safe}_reconciliation.xlsx`,
            res.data.rows,
            res.data.meta,
          );
          toast.success(`Exported ${branchName} sheet.`);
        });
      }}
    >
      <Download className="mr-1.5 size-3.5" />
      {pending ? "Exporting…" : "Legacy Excel"}
    </Button>
  );
}
