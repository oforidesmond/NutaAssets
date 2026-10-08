"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  undoImportJobAction,
} from "@/server/actions/import";

export type RecentJob = {
  id: string;
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  flagged: number;
  status: string;
  createdAt: string;
};

export function RecentImportJobs({ jobs: initial }: { jobs: RecentJob[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Recent imports</h2>
      <ul className="space-y-2 text-sm">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
          >
            <div>
              <p className="font-medium">{job.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(job.createdAt).toLocaleString("en-GB")} ·{" "}
                {job.status} · +{job.created} created · {job.updated} updated ·{" "}
                {job.flagged} flagged
              </p>
            </div>
            {job.status !== "UNDONE" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      "Undo this import? Assets created or linked by it will be soft-deleted.",
                    )
                  ) {
                    return;
                  }
                  startTransition(async () => {
                    const res = await undoImportJobAction(job.id);
                    if (!res.ok) {
                      toast.error(res.error ?? "Undo failed");
                      return;
                    }
                    toast.success(
                      `Undone — ${res.data?.softDeleted ?? 0} assets moved to recycle bin`,
                    );
                    setJobs((prev) =>
                      prev.map((j) =>
                        j.id === job.id ? { ...j, status: "UNDONE" } : j,
                      ),
                    );
                    router.refresh();
                  });
                }}
              >
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
