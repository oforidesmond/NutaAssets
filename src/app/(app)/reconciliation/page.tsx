import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = { title: "Reconciliation" };

export default function ReconciliationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Reconciliation
        </h1>
        <p className="text-sm text-muted-foreground">
          Branch verification campaigns — Phase 5.
        </p>
      </div>
      <PagePlaceholder
        title="Reconciliation workflow coming soon"
        description="Create exercises, verify branch sheets on a phone, submit and approve."
        icon={ClipboardCheck}
      />
    </div>
  );
}
