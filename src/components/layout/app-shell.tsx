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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        orgName={orgName}
        user={user}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-3 pb-24 pt-4 outline-none md:px-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <MobileNav user={user} />
    </div>
  );
}
