"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { type AuthUser } from "@/lib/authorize";

export function AppShell({
  children,
  orgName,
  user,
  header,
}: {
  children: React.ReactNode;
  orgName: string;
  user: AuthUser;
  header: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        orgName={orgName}
        user={user}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 px-3 pb-24 pt-4 md:px-6 md:pb-6">{children}</main>
      </div>
      <MobileNav user={user} />
    </div>
  );
}
