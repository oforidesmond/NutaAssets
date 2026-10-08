import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  EntryStatusBadge,
  ExerciseStatusBadge,
} from "@/components/reconciliation/entry-status-badge";
import { ExerciseActions } from "@/components/reconciliation/exercise-actions";
import { LegacyEntryExport } from "@/components/reconciliation/legacy-entry-export";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { formatDate } from "@/lib/format";
import { getExerciseDetail } from "@/server/queries/reconciliation";

export const metadata: Metadata = { title: "Reconciliation exercise" };

type PageProps = {
  params: Promise<{ exerciseId: string }>;
};

export default async function ExerciseDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { exerciseId } = await params;
  const exercise = await getExerciseDetail(session.user, exerciseId);
  if (!exercise) notFound();

  const canApprove = can(session.user, "approve");
  const canExport = can(session.user, "export");
  const canReconcile = can(session.user, "reconcile");
  const allApproved =
    exercise.entries.length > 0 &&
    exercise.entries.every((e) => e.status === "APPROVED");

  const totalFound = exercise.entries.reduce((s, e) => s + e.counts.found, 0);
  const totalMissing = exercise.entries.reduce(
    (s, e) => s + e.counts.missing,
    0,
  );
  const totalDifferent = exercise.entries.reduce(
    (s, e) => s + e.counts.different,
    0,
  );
  const totalUnlisted = exercise.entries.reduce(
    (s, e) => s + e.counts.unlisted,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/reconciliation">
            <ArrowLeft className="mr-1 size-4" />
            All exercises
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
                {exercise.name}
              </h1>
              <ExerciseStatusBadge status={exercise.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {exercise.department.name} · {formatDate(exercise.startDate)}
              {exercise.endDate ? ` – ${formatDate(exercise.endDate)}` : ""}
              {exercise.notes ? ` · ${exercise.notes}` : ""}
            </p>
          </div>
          {canReconcile && (
            <ExerciseActions
              exerciseId={exercise.id}
              status={exercise.status}
              canApprove={canApprove}
              allApproved={allApproved}
            />
          )}
        </div>
      </div>

      {exercise.status !== "DRAFT" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Found" value={totalFound} />
          <Stat label="Different" value={totalDifferent} />
          <Stat label="Missing" value={totalMissing} />
          <Stat label="New / unlisted" value={totalUnlisted} />
        </div>
      )}

      {exercise.status === "DRAFT" ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          This exercise is still a draft. Start it to generate one branch sheet
          per location, pre-loaded with assets expected there.
        </p>
      ) : (
        <ul className="space-y-3">
          {exercise.entries.map((entry) => {
            const pct =
              entry.totalItems === 0
                ? entry.status === "APPROVED"
                  ? 100
                  : 0
                : Math.round((entry.verifiedItems / entry.totalItems) * 100);
            return (
              <li
                key={entry.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{entry.branch.name}</h2>
                      <EntryStatusBadge status={entry.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.verifiedItems}/{entry.totalItems} verified ({pct}
                      %)
                      {entry.preparedBy
                        ? ` · prepared by ${entry.preparedBy.name}`
                        : ""}
                    </p>
                    {entry.comment && (
                      <p className="mt-1 text-sm text-destructive">
                        Returned: {entry.comment}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canExport &&
                      (entry.status === "APPROVED" ||
                        entry.status === "SUBMITTED") && (
                        <LegacyEntryExport
                          entryId={entry.id}
                          branchName={entry.branch.name}
                        />
                      )}
                    {canApprove && entry.status === "SUBMITTED" && (
                      <Button asChild size="sm">
                        <Link
                          href={`/reconciliation/${exercise.id}/${entry.id}/review`}
                        >
                          Review &amp; approve
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/reconciliation/${exercise.id}/${entry.id}`}
                      >
                        Open sheet
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
