import type { Metadata } from "next";
import { Upload } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = { title: "Import / Export" };

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Import / Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Excel/CSV wizard and exports — Phase 4.
        </p>
      </div>
      <PagePlaceholder
        title="Import wizard coming soon"
        description="Parse the Nwabiagya sheet in the browser, map columns, and import in chunks."
        icon={Upload}
      />
    </div>
  );
}
