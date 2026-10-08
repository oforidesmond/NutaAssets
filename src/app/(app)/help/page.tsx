import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };

const TASKS = [
  {
    title: "Add an asset",
    href: "/assets/new",
    steps: [
      "Open Assets → Add asset (or press ⌘/Ctrl+K and choose Add asset).",
      "Pick the category, branch, and status — those four fields are required (department comes from the switcher).",
      "Fill tag, serial, brand, and model if you have them. Leave blanks empty; do not type * or N/A.",
      "Use Scan to fill if you can point the camera at a barcode.",
      "Save, or Save & add another to keep the same branch/category for the next item.",
    ],
  },
  {
    title: "Import from Excel",
    href: "/import",
    steps: [
      "Go to Import / Export and upload your workbook (parsed in the browser).",
      "Confirm the header row and column mapping — Asset Tag, Type, Serial, User Assigned, etc.",
      "Review normalisation: placeholders become empty, types/statuses map to categories.",
      "Choose how to handle duplicates (default: import and flag for review), then import in chunks.",
      "Open the Needs review queue for anything flagged.",
    ],
  },
  {
    title: "Run a reconciliation",
    href: "/reconciliation",
    steps: [
      "Create an exercise with a name, dates, and branches in scope.",
      "Open a branch sheet on phone or laptop.",
      "For each expected asset tap Found, Found – details differ, or Missing. Scan tags to jump quickly.",
      "Add unlisted assets if you find extras, then Submit the sheet.",
      "A department admin previews the diff and Approves to apply changes to the register.",
    ],
  },
  {
    title: "Export & print labels",
    href: "/import",
    steps: [
      "From Assets, filter the list (or select rows), then export Excel, CSV, or PDF.",
      "Use Reports for printable prebuilt lists (by branch, faulty, warranty, data quality).",
      "For labels: select assets → Print labels to get a PDF with QR codes linking to each asset.",
      "Legacy branch-sheet export on Import matches the old Excel layout for auditors.",
    ],
  },
  {
    title: "Clear the needs-review queue",
    href: "/assets/needs-review",
    steps: [
      "Open Needs review from the dashboard KPI or Assets → Needs review.",
      "Read the reason badges (duplicate tag/serial, missing tag, placeholder).",
      "Use Suggest tag for missing tags, Clear placeholders for * / N/A leftovers, or Open to edit.",
      "Mark reviewed when you have checked the item — it leaves the queue without deleting the asset.",
      "Bulk-select and Mark selected reviewed after a large import clean-up.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Help & guide
        </h1>
        <p className="text-sm text-muted-foreground">
          Plain-language steps for the five jobs you will do most often. Press{" "}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘/Ctrl+K
          </kbd>{" "}
          anytime to search assets or jump pages.
        </p>
      </div>

      <div className="space-y-4">
        {TASKS.map((task) => (
          <Card key={task.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                <Link href={task.href} className="hover:underline">
                  {task.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {task.steps.map((step) => (
                  <li key={step} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Full written guide for your team: see{" "}
        <code className="rounded bg-muted px-1">docs/USER_GUIDE.md</code> in the
        project repository.
      </p>
    </div>
  );
}
