import type { Metadata } from "next";
import { Package } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Assets
        </h1>
        <p className="text-sm text-muted-foreground">
          Searchable register with filters and bulk actions — Phase 2.
        </p>
      </div>
      <PagePlaceholder
        title="Asset register coming soon"
        description="You’ll add, edit, transfer, and review assets here."
        icon={Package}
      />
    </div>
  );
}
