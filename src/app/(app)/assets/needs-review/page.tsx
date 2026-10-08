import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NeedsReviewQueue } from "@/components/assets/needs-review-queue";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { listAssets } from "@/server/queries/assets";

export const metadata: Metadata = { title: "Needs review" };

export default async function NeedsReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const list = await listAssets(session.user, {
    needsReview: true,
    page: 1,
    pageSize: 100,
    sort: "updatedAt",
    sortDir: "desc",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/assets" className="hover:underline">
              Assets
            </Link>{" "}
            / Needs review
          </p>
          <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
            Needs review
          </h1>
          <p className="text-sm text-muted-foreground">
            Data-quality queue — duplicates, placeholders, and missing identifiers.
            Mark reviewed when you have checked an item, or use one-click fixes.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/assets?needsReview=1">Open in assets list</Link>
        </Button>
      </div>

      <NeedsReviewQueue
        rows={list.rows.map((r) => ({
          id: r.id,
          assetTag: r.assetTag,
          serialNumber: r.serialNumber,
          brand: r.brand,
          model: r.model,
          assignedToText: r.assignedToText,
          remarks: r.remarks,
          needsReview: r.needsReview,
          reviewReasons: r.reviewReasons,
          updatedAt: r.updatedAt.toISOString(),
          category: { name: r.category.name },
          branch: { name: r.branch.name },
          location: r.location ? { name: r.location.name } : null,
          status: { name: r.status.name, color: r.status.color },
          customFields: r.customFields,
          condition: r.condition,
        }))}
        total={list.total}
        canMutate={can(session.user, "update")}
        canExport={can(session.user, "export")}
      />
    </div>
  );
}
