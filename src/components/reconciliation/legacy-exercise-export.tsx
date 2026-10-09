"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadLegacyExerciseWorkbook } from "@/lib/export/legacy-sheet";
import { exportExerciseLegacyAction } from "@/server/actions/reconciliation";

export function LegacyExerciseExport({
  exerciseId,
  exerciseName,
}: {
  exerciseId: string;
  exerciseName: string;
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
          const res = await exportExerciseLegacyAction(exerciseId);
          if (!res.ok || !res.data) {
            toast.error(res.error ?? "Export failed.");
            return;
          }
          const safe = (res.data.exerciseName || exerciseName).replace(
            /[^\w.-]+/g,
            "_",
          );
          await downloadLegacyExerciseWorkbook(
            `${safe}_reconciliation.xlsx`,
            res.data.sheets,
          );
          toast.success(
            `Exported ${res.data.sheets.length} branch sheet${
              res.data.sheets.length === 1 ? "" : "s"
            }.`,
          );
        });
      }}
    >
      <Download className="mr-1.5 size-3.5" />
      {pending ? "Exporting…" : "Export all branches"}
    </Button>
  );
}
