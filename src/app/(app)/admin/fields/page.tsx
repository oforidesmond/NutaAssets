import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FieldsManager } from "@/components/admin/fields-manager";
import { auth } from "@/lib/auth";
import {
  listCategoriesForDepartment,
  listFieldDefinitionsForDepartment,
  resolveAdminDepartmentId,
} from "@/server/queries/admin";

export const metadata: Metadata = { title: "Custom fields — Admin" };

export default async function AdminFieldsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departmentId = await resolveAdminDepartmentId(session.user);
  if (!departmentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a department from the switcher to manage custom fields.
      </p>
    );
  }

  const [fields, categories] = await Promise.all([
    listFieldDefinitionsForDepartment(session.user, departmentId),
    listCategoriesForDepartment(session.user, departmentId),
  ]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Custom fields</h2>
        <p className="text-sm text-muted-foreground">
          Add fields that appear on asset forms, filters, and exports for this
          department.
        </p>
      </div>
      <FieldsManager
        departmentId={departmentId}
        initial={fields}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }))}
      />
    </div>
  );
}
