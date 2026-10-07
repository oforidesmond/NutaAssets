import type { Metadata } from "next";
import { FileBarChart } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Prebuilt lists and exports — Phases 4–6.
        </p>
      </div>
      <PagePlaceholder
        title="Reports coming soon"
        description="Faulty assets, by assignee, warranty, and data-quality reports will live here."
        icon={FileBarChart}
      />
    </div>
  );
}
