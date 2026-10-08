"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EntryDiffPreview } from "@/server/services/reconciliation";
import {
  applyEntryChunkAction,
  rejectEntryAction,
} from "@/server/actions/reconciliation";

export function ReviewPanel({
  preview,
  entryStatus,
}: {
  preview: EntryDiffPreview;
  entryStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState<string | null>(null);

  const changeCount =
    preview.counts.different +
    preview.counts.missing +
    preview.counts.unlisted;

  function onApprove() {
    startTransition(async () => {
      let remaining = changeCount;
      let nextIds = preview.applyItemIds.slice(0, 200);
      let guard = 0;

      while (guard < 50) {
        guard++;
        setProgress(
          remaining > 0
            ? `Applying changes… ${Math.max(0, changeCount - remaining)}/${changeCount}`
            : "Finalising…",
        );
        const res = await applyEntryChunkAction({
          entryId: preview.entryId,
          itemIds: nextIds.length ? nextIds : undefined,
          finalize: true,
        });
        if (!res.ok || !res.data) {
          toast.error(res.error ?? "Apply failed.");
          setProgress(null);
          return;
        }
        remaining = res.data.remaining;
        nextIds = res.data.nextItemIds;
        if (res.data.approved || remaining === 0) {
          toast.success("Sheet approved — changes applied to the register.");
          setProgress(null);
          router.refresh();
          return;
        }
      }
      toast.error("Apply timed out. Try again to continue.");
      setProgress(null);
      router.refresh();
    });
  }

  function onReject() {
    if (!comment.trim()) {
      toast.error("Add a comment explaining what to fix.");
      return;
    }
    startTransition(async () => {
      const res = await rejectEntryAction({
        entryId: preview.entryId,
        comment,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Reject failed.");
        return;
      }
      toast.success("Sheet returned to the officer.");
      router.refresh();
    });
  }

  if (entryStatus === "APPROVED") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        This sheet is already approved. Changes have been applied to the
        register.
      </p>
    );
  }

  if (entryStatus !== "SUBMITTED") {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        This sheet is not submitted yet. Approve is available after the officer
        submits.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Found (no change)" value={preview.counts.found} />
        <Stat label="Details differ" value={preview.counts.different} />
        <Stat label="Missing → Lost" value={preview.counts.missing} />
        <Stat label="New assets" value={preview.counts.unlisted} />
      </div>

      {preview.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No register changes — every expected asset was found as listed.
          Approving will lock the sheet.
        </p>
      ) : (
        <ul className="space-y-3">
          {preview.items.map((item) => (
            <li key={item.itemId} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {item.assetTag ?? "(no tag)"}
                  {item.categoryName ? ` · ${item.categoryName}` : ""}
                </p>
                <span className="text-xs text-muted-foreground">
                  {item.summary}
                </span>
              </div>
              {item.fields.length > 0 && (
                <dl className="mt-2 space-y-1 text-sm">
                  {item.fields.map((f) => (
                    <div
                      key={f.field}
                      className="grid grid-cols-[7rem_1fr] gap-2"
                    >
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd>
                        <span className="line-through opacity-60">
                          {f.before ?? "—"}
                        </span>
                        {" → "}
                        <span className="font-medium">{f.after ?? "—"}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {item.note && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Note: {item.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="reject-comment">Return comment (if rejecting)</Label>
          <Textarea
            id="reject-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Explain what the officer should fix…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={onApprove}>
            {progress ?? `Approve & apply (${changeCount} changes)`}
          </Button>
          <Button
            disabled={pending}
            variant="outline"
            onClick={onReject}
          >
            Return to officer
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
