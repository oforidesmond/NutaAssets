import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import/import-wizard";
import { RecentImportJobs } from "@/components/import/recent-import-jobs";
import { LegacyBranchExport } from "@/components/import/legacy-branch-export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import {
  getAccessibleDepartments,
  getSelectedDepartmentId,
} from "@/server/queries/org";
import { listRecentImportJobs } from "@/server/services/import";

export const metadata: Metadata = { title: "Import / Export" };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canImport = can(session.user, "import");
  const canExport = can(session.user, "export");

  const [departments, selectedDepartment, jobs] = await Promise.all([
    getAccessibleDepartments(),
    getSelectedDepartmentId(),
    canImport ? listRecentImportJobs(session.user.id) : Promise.resolve([]),
  ]);

  const initialDepartmentId =
    selectedDepartment !== "all"
      ? selectedDepartment
      : (departments[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Import / Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Bring in Excel/CSV inventories, export registers, and print labels.
        </p>
      </div>

      <Tabs defaultValue={canImport ? "import" : "export"}>
        <TabsList>
          {canImport && <TabsTrigger value="import">Import</TabsTrigger>}
          {canExport && <TabsTrigger value="export">Export</TabsTrigger>}
        </TabsList>
        {canImport && (
          <TabsContent value="import" className="space-y-6">
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No departments available for import.
              </p>
            ) : (
              <ImportWizard
                departments={departments}
                initialDepartmentId={initialDepartmentId}
              />
            )}
            <RecentImportJobs
              jobs={jobs.map((j) => ({
                ...j,
                status: j.status,
                createdAt: j.createdAt.toISOString(),
              }))}
            />
          </TabsContent>
        )}
        {canExport && (
          <TabsContent value="export">
            <LegacyBranchExport
              departments={departments}
              initialDepartmentId={initialDepartmentId}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
