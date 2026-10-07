import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UsersManager } from "@/components/admin/users-manager";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { listUsersAdmin } from "@/server/services/admin-users";

export const metadata: Metadata = { title: "Users — Admin" };

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "manage_users")) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to manage users.
      </p>
    );
  }

  const [users, departments, branches] = await Promise.all([
    listUsersAdmin(),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Users & roles</h2>
        <p className="text-sm text-muted-foreground">
          Create users, assign roles and department scope, and reset passwords.
        </p>
      </div>
      <UsersManager
        initial={users.map((u) => ({
          ...u,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
        departments={departments}
        branches={branches}
      />
    </div>
  );
}
