"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mainNav } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { can, type AuthUser } from "@/lib/authorize";

export function MobileNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const items = mainNav
    .filter((item) => {
      if (!item.adminOnly) return true;
      return can(user, "admin");
    })
    .slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate">{item.title.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
