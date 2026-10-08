"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelExerciseAction,
  completeExerciseAction,
  startExerciseAction,
} from "@/server/actions/reconciliation";

export function ExerciseActions({
  exerciseId,
  status,
  canApprove,
  allApproved,
}: {
  exerciseId: string;
  status: string;
  canApprove: boolean;
  allApproved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "DRAFT" || status === "IN_PROGRESS") && (
        <Button
          disabled={pending}
          onClick={() =>
            run(
              () => startExerciseAction(exerciseId),
              status === "DRAFT"
                ? "Exercise started — branch sheets are ready."
                : "Branch sheets refreshed.",
            )
          }
        >
          {status === "DRAFT" ? "Start exercise" : "Ensure sheets ready"}
        </Button>
      )}
      {canApprove && status === "IN_PROGRESS" && allApproved && (
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() =>
            run(
              () => completeExerciseAction(exerciseId),
              "Exercise marked complete.",
            )
          }
        >
          Complete exercise
        </Button>
      )}
      {canApprove && status !== "COMPLETED" && status !== "CANCELLED" && (
        <Button
          disabled={pending}
          variant="outline"
          onClick={() => {
            if (!confirm("Cancel this exercise? Branch sheets will stay as-is."))
              return;
            run(() => cancelExerciseAction(exerciseId), "Exercise cancelled.");
          }}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
