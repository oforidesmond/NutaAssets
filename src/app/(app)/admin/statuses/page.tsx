import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StatusesManager } from "@/components/admin/statuses-manager";
import { auth } from "@/lib/auth";
import {
  listStatusesForDepartment,
  resolveAdminDepartmentId,
} from "@/server/queries/admin";

export const metadata: Metadata = { title: "Statuses — Admin" };

export default async function AdminStatusesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departmentId = await resolveAdminDepartmentId(session.user);
  if (!departmentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a department from the switcher to manage statuses.
      </p>
    );
  }

  const statuses = await listStatusesForDepartment(session.user, departmentId);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Statuses</h2>
      <StatusesManager departmentId={departmentId} initial={statuses} />
    </div>
  );
}
