"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft } from "lucide-react";

import { OrgLogo } from "@/components/layout/org-logo";
import { mainNav } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { can, type AuthUser } from "@/lib/authorize";

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  orgName: string;
  orgLogoUrl: string | null;
  user: AuthUser;
};

export function AppSidebar({
  collapsed,
  onToggle,
  orgName,
  orgLogoUrl,
  user,
}: AppSidebarProps) {
  const pathname = usePathname();
  const items = mainNav.filter((item) => {
    if (!item.adminOnly) return true;
    return can(user, "admin");
  });
  const hasLogo = Boolean(orgLogoUrl?.trim());

  return (
    <aside
      className={cn(
        "hidden h-full flex-col border-r bg-card transition-[width] md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex border-b",
          collapsed
            ? "flex-col items-center gap-1 px-2 py-2"
            : "h-14 items-center justify-between gap-2 px-3",
        )}
      >
        {collapsed ? (
          hasLogo ? (
            <OrgLogo
              src={orgLogoUrl}
              alt={orgName}
              size="sm"
              className="max-w-8"
            />
          ) : null
        ) : (
          <div className="min-w-0 flex-1">
            {hasLogo ? (
              <>
                <OrgLogo src={orgLogoUrl} alt={orgName} size="sm" />
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {orgName}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold tracking-tight">
                  AssetTrack
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {orgName}
                </p>
              </>
            )}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft /> : <PanelLeftClose />}
        </Button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2",
              )}
              title={item.title}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
