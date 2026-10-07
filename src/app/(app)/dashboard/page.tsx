import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          KPIs and needs-attention queues will appear here in Phase 6.
        </p>
      </div>
      <PagePlaceholder
        title="Welcome to AssetTrack"
        description="Sign-in, navigation, departments, and audit plumbing are ready. Next up: the asset register."
        icon={LayoutDashboard}
      />
    </div>
  );
}
