import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/admin/categories-manager";
import { auth } from "@/lib/auth";
import {
  listCategoriesForDepartment,
  resolveAdminDepartmentId,
} from "@/server/queries/admin";

export const metadata: Metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const departmentId = await resolveAdminDepartmentId(session.user);
  if (!departmentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a department from the switcher to manage categories.
      </p>
    );
  }

  const categories = await listCategoriesForDepartment(
    session.user,
    departmentId,
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Categories</h2>
      <CategoriesManager departmentId={departmentId} initial={categories} />
    </div>
  );
}
