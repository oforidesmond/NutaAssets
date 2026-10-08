import { CommandPalette } from "@/components/layout/command-palette";
import { DepartmentSwitcher } from "@/components/layout/department-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import type { AuthUser } from "@/lib/authorize";

type Dept = { id: string; name: string; code: string };

export function AppHeader({
  orgName,
  departments,
  selectedDepartment,
  user,
  authUser,
}: {
  orgName: string;
  departments: Dept[];
  selectedDepartment: string;
  user: { name: string; email: string; role: string };
  authUser: AuthUser;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden md:px-4">
      <div className="min-w-0 flex-1 md:hidden">
        <p className="truncate text-sm font-semibold">AssetTrack</p>
        <p className="truncate text-xs text-muted-foreground">{orgName}</p>
      </div>
      <div className="hidden flex-1 md:block" />
      <CommandPalette user={authUser} />
      <DepartmentSwitcher
        departments={departments}
        selected={selectedDepartment}
      />
      <UserMenu name={user.name} email={user.email} role={user.role} />
    </header>
  );
}
