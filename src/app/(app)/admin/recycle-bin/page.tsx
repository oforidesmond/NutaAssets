import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RecycleBin } from "@/components/admin/recycle-bin";
import { auth } from "@/lib/auth";
import {
  listDeletedAssets,
  resolveAdminDepartmentId,
} from "@/server/queries/admin";

export const metadata: Metadata = { title: "Recycle bin — Admin" };

export default async function RecycleBinPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departmentId = await resolveAdminDepartmentId(session.user);
  const assets = await listDeletedAssets(session.user, departmentId);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Recycle bin</h2>
      <p className="text-sm text-muted-foreground">
        Soft-deleted assets can be restored. Hard delete is not available.
      </p>
      <RecycleBin assets={assets} />
    </div>
  );
}
