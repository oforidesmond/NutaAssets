import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DepartmentsManager } from "@/components/admin/departments-manager";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { listDepartmentsAdmin } from "@/server/services/admin-departments";

export const metadata: Metadata = { title: "Departments — Admin" };

export default async function AdminDepartmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "manage_settings") && session.user.role !== "SUPER_ADMIN") {
    return (
      <p className="text-sm text-muted-foreground">
        Only Super Admins can manage departments.
      </p>
    );
  }

  const departments = await listDepartmentsAdmin();

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Departments</h2>
        <p className="text-sm text-muted-foreground">
          Add departments and optionally clone categories, statuses, and custom
          fields from an existing one.
        </p>
      </div>
      <DepartmentsManager initial={departments} />
    </div>
  );
}
