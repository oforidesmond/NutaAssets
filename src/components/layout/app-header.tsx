import { CommandPalette } from "@/components/layout/command-palette";
import { DepartmentSwitcher } from "@/components/layout/department-switcher";
import { OrgLogo } from "@/components/layout/org-logo";
import { UserMenu } from "@/components/layout/user-menu";
import type { AuthUser } from "@/lib/authorize";

type Dept = { id: string; name: string; code: string };

export function AppHeader({
  orgName,
  orgLogoUrl,
  departments,
  selectedDepartment,
  user,
  authUser,
}: {
  orgName: string;
  orgLogoUrl: string | null;
  departments: Dept[];
  selectedDepartment: string;
  user: { name: string; email: string; role: string };
  authUser: AuthUser;
}) {
  const hasLogo = Boolean(orgLogoUrl?.trim());

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden md:px-4">
      <div className="min-w-0 flex-1 md:hidden">
        {hasLogo ? (
          <div className="flex min-w-0 items-center gap-2">
            <OrgLogo src={orgLogoUrl} alt={orgName} size="sm" />
            <p className="truncate text-xs text-muted-foreground">{orgName}</p>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-semibold">AssetTrack</p>
            <p className="truncate text-xs text-muted-foreground">{orgName}</p>
          </>
        )}
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
