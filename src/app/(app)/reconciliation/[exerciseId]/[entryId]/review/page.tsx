import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ReviewPanel } from "@/components/reconciliation/review-panel";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { previewEntryDiff } from "@/server/services/reconciliation";

export const metadata: Metadata = { title: "Review sheet" };

type PageProps = {
  params: Promise<{ exerciseId: string; entryId: string }>;
};

export default async function ReviewEntryPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "approve")) redirect("/reconciliation");

  const { exerciseId, entryId } = await params;
  const entry = await prisma.reconciliationEntry.findUnique({
    where: { id: entryId },
    include: {
      branch: true,
      exercise: true,
    },
  });
  if (!entry || entry.exerciseId !== exerciseId || entry.exercise.deletedAt) {
    notFound();
  }

  const preview = await previewEntryDiff(entryId);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/reconciliation/${exerciseId}/${entryId}`}>
            <ArrowLeft className="mr-1 size-4" />
            Back to sheet
          </Link>
        </Button>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Review · {entry.branch.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {entry.exercise.name} — preview changes before applying them to the
          master register.
        </p>
      </div>

      <ReviewPanel preview={preview} entryStatus={entry.status} />
    </div>
  );
}
