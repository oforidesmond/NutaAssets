import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardPanels } from "@/components/dashboard/dashboard-panels";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getDashboardData(session.user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your asset register. Click any KPI to open the filtered list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/assets/needs-review">Needs review queue</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/assets/new">Add asset</Link>
          </Button>
        </div>
      </div>

      <KpiCards kpis={data.kpis} />
      <DashboardCharts charts={data.charts} />
      <DashboardPanels
        needsAttention={data.panels.needsAttention}
        recentlyChanged={data.panels.recentlyChanged}
        reconProgress={data.panels.reconProgress}
      />
    </div>
  );
}
