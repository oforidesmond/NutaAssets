import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CreateExerciseForm } from "@/components/reconciliation/create-exercise-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import {
  getAccessibleDepartments,
  getSelectedDepartmentId,
} from "@/server/queries/org";

export const metadata: Metadata = { title: "New reconciliation" };

export default async function NewReconciliationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "reconcile")) redirect("/reconciliation");

  const [departments, selected, branches] = await Promise.all([
    getAccessibleDepartments(),
    getSelectedDepartmentId(),
    prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  const initialDepartmentId =
    selected !== "all" ? selected : (departments[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/reconciliation">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          New reconciliation exercise
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick the department and branches to count. You can start generating
          sheets after saving the draft.
        </p>
      </div>
      <CreateExerciseForm
        departments={departments}
        branches={branches}
        initialDepartmentId={initialDepartmentId}
      />
    </div>
  );
}
