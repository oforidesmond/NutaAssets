import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssetForm } from "@/components/assets/asset-form";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { getAssetFormOptions } from "@/server/queries/assets";
import {
  listActiveFieldDefinitions,
  resolveAdminDepartmentId,
} from "@/server/queries/admin";

export const metadata: Metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "create")) redirect("/assets");

  const options = await getAssetFormOptions(session.user);
  const selectedDept =
    options.departmentId && options.departmentId !== "all"
      ? options.departmentId
      : null;
  const departmentId =
    selectedDept ?? (await resolveAdminDepartmentId(session.user));

  if (!departmentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a department from the switcher before adding an asset.
      </p>
    );
  }

  const [categories, statuses, fieldDefs] = [
    options.categories.filter(
      (c) => !("departmentId" in c) || c.departmentId === departmentId,
    ),
    options.statuses.filter(
      (s) => !("departmentId" in s) || s.departmentId === departmentId,
    ),
    await listActiveFieldDefinitions(session.user, departmentId),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Add asset
        </h1>
        <p className="text-sm text-muted-foreground">
          Capture identification, placement, and status.
        </p>
      </div>
      <AssetForm
        mode="create"
        departmentId={departmentId}
        categories={categories}
        branches={options.branches}
        statuses={statuses}
        fieldDefs={fieldDefs}
      />
    </div>
  );
}
