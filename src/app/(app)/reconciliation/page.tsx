import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Plus } from "lucide-react";

import {
  EntryStatusBadge,
  ExerciseStatusBadge,
} from "@/components/reconciliation/entry-status-badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { formatDate } from "@/lib/format";
import { listExercises } from "@/server/queries/reconciliation";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canReconcile = can(session.user, "reconcile");
  const exercises = can(session.user, "read")
    ? await listExercises(session.user)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
            Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground">
            Branch verification campaigns — create an exercise, count assets on
            site, submit, and approve.
          </p>
        </div>
        {canReconcile && (
          <Button asChild>
            <Link href="/reconciliation/new">
              <Plus className="mr-1.5 size-4" />
              New exercise
            </Link>
          </Button>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <ClipboardCheck className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No reconciliation exercises yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start one to generate a branch sheet for every location in scope.
            </p>
          </div>
          {canReconcile && (
            <Button asChild>
              <Link href="/reconciliation/new">Create exercise</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {exercises.map((ex) => {
            const submitted = ex.entries.filter(
              (e) => e.status === "SUBMITTED" || e.status === "APPROVED",
            ).length;
            return (
              <li key={ex.id}>
                <Link
                  href={`/reconciliation/${ex.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{ex.name}</h2>
                        <ExerciseStatusBadge status={ex.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ex.department.name} · started{" "}
                        {formatDate(ex.startDate)}
                        {ex.createdBy ? ` · by ${ex.createdBy.name}` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {submitted}/{ex.entries.length} sheets done
                    </p>
                  </div>
                  {ex.entries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ex.entries.slice(0, 8).map((e) => (
                        <span
                          key={e.id}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        >
                          {e.branch.code}
                          <EntryStatusBadge status={e.status} />
                        </span>
                      ))}
                      {ex.entries.length > 8 && (
                        <span className="text-xs text-muted-foreground">
                          +{ex.entries.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
