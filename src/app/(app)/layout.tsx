import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import {
  getAccessibleDepartments,
  getOrgName,
  getSelectedDepartmentId,
} from "@/server/queries/org";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const [orgName, departments, selectedDepartment] = await Promise.all([
    getOrgName(),
    getAccessibleDepartments(),
    getSelectedDepartmentId(),
  ]);

  const authUser = {
    id: session.user.id,
    role: session.user.role,
    departmentIds: session.user.departmentIds,
    branchIds: session.user.branchIds,
  };

  return (
    <AppShell
      orgName={orgName}
      user={authUser}
      header={
        <AppHeader
          orgName={orgName}
          departments={departments}
          selectedDepartment={selectedDepartment}
          authUser={authUser}
          user={{
            name: session.user.name ?? "User",
            email: session.user.email ?? "",
            role: session.user.role,
          }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
