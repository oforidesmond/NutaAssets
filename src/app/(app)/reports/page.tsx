import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  FileBarChart,
  Hash,
  ShieldAlert,
  Tag,
  UserRound,
  Building2,
  CalendarClock,
  HelpCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORT_META, REPORT_SLUGS, type ReportSlug } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Reports" };

const ICONS: Record<ReportSlug, typeof FileBarChart> = {
  "register-by-branch": Building2,
  "needs-attention": AlertTriangle,
  "by-assignee": UserRound,
  missing: HelpCircle,
  warranty: CalendarClock,
  "data-quality": ShieldAlert,
  "without-tag": Tag,
  "without-serial": Hash,
  reconciliation: ClipboardCheck,
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Prebuilt printable lists. Export to Excel or CSV from each report.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_SLUGS.map((slug) => {
          const meta = REPORT_META[slug];
          const Icon = ICONS[slug];
          return (
            <Link key={slug} href={`/reports/${slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
                <CardHeader className="pb-2">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{meta.title}</CardTitle>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs font-medium text-primary">Open report →</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
