import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BranchSheet } from "@/components/reconciliation/branch-sheet";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import {
  getEntrySheet,
  getReconFormOptions,
  type EntryItemFilter,
} from "@/server/queries/reconciliation";

export const metadata: Metadata = { title: "Branch sheet" };

type PageProps = {
  params: Promise<{ exerciseId: string; entryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BranchSheetPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { exerciseId, entryId } = await params;
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const filterRaw = get("filter") ?? "all";
  const filter = (
    [
      "all",
      "pending",
      "FOUND",
      "FOUND_DIFFERENT",
      "MISSING",
      "NEW_UNLISTED",
    ].includes(filterRaw)
      ? filterRaw
      : "all"
  ) as EntryItemFilter;

  const sheet = await getEntrySheet(session.user, entryId, {
    q: get("q"),
    filter,
    page: 1,
    pageSize: 2000,
  });
  if (!sheet || sheet.entry.exerciseId !== exerciseId) notFound();

  const options = await getReconFormOptions(
    sheet.entry.exercise.departmentId,
    sheet.entry.branchId,
  );

  const locked =
    sheet.entry.status === "SUBMITTED" || sheet.entry.status === "APPROVED";

  return (
    <div className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/reconciliation/${exerciseId}`}>
          <ArrowLeft className="mr-1 size-4" />
          Exercise
        </Link>
      </Button>

      <BranchSheet
        exerciseId={exerciseId}
        entryId={entryId}
        branchName={sheet.entry.branch.name}
        exerciseName={sheet.entry.exercise.name}
        entryStatus={sheet.entry.status}
        comment={sheet.entry.comment}
        locked={locked}
        canSubmit={can(session.user, "reconcile")}
        canApprove={can(session.user, "approve")}
        items={sheet.items.map((i) => ({
          id: i.id,
          result: i.result,
          note: i.note,
          observed: i.observed,
          assetId: i.assetId,
          asset: i.asset
            ? {
                id: i.asset.id,
                assetTag: i.asset.assetTag,
                serialNumber: i.asset.serialNumber,
                brand: i.asset.brand,
                model: i.asset.model,
                assignedToText: i.asset.assignedToText,
                category: i.asset.category,
                status: i.asset.status,
                location: i.asset.location,
              }
            : null,
        }))}
        counts={sheet.counts}
        categories={options.categories}
        statuses={options.statuses}
        locations={options.locations}
        initialFilter={filter}
        initialQ={get("q") ?? ""}
      />
    </div>
  );
}
