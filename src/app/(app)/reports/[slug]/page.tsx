import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ReconExercisePicker } from "@/components/reports/recon-exercise-picker";
import { ReconReportTable } from "@/components/reports/recon-report-table";
import { ReportAssetTable } from "@/components/reports/report-asset-table";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import {
  getReconciliationReport,
  getReportAssets,
  isReportSlug,
  REPORT_META,
  reportAssetFilters,
  type ReportSlug,
} from "@/server/queries/reports";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isReportSlug(slug)) return { title: "Report" };
  return { title: REPORT_META[slug].title };
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  if (!isReportSlug(slug)) notFound();

  const sp = await searchParams;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1;
  const exerciseId = Array.isArray(sp.exerciseId)
    ? sp.exerciseId[0]
    : sp.exerciseId;

  const meta = REPORT_META[slug];

  if (slug === "reconciliation") {
    const report = await getReconciliationReport(session.user, exerciseId);
    return (
      <div className="report-page space-y-4">
        <ReportHeader title={meta.title} description={meta.description} />
        <ReconExercisePicker
          exercises={report.exercises}
          selectedId={report.selected?.id ?? null}
        />
        {report.selected ? (
          <>
            <p className="text-sm text-muted-foreground">
              {report.selected.name} · started{" "}
              {formatDate(report.selected.startDate)} ·{" "}
              {report.selected.status.replaceAll("_", " ")}
            </p>
            <ReconReportTable
              rows={report.rows}
              exerciseId={report.selected.id}
            />
          </>
        ) : (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Create a reconciliation exercise to see a summary here.
          </p>
        )}
      </div>
    );
  }

  const data = await getReportAssets(
    session.user,
    slug as Exclude<ReportSlug, "reconciliation">,
    { page, pageSize: 200 },
  );

  const filters = reportAssetFilters(slug) ?? undefined;
  const groupBy =
    slug === "by-assignee"
      ? ("assignee" as const)
      : slug === "register-by-branch"
        ? ("branch" as const)
        : undefined;

  return (
    <div className="report-page space-y-4">
      <ReportHeader title={meta.title} description={meta.description} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(data.total)} row{data.total === 1 ? "" : "s"}
          {data.meta.exerciseName
            ? ` · from “${data.meta.exerciseName}”`
            : ""}
          {data.pageCount > 1
            ? ` · page ${data.page} of ${data.pageCount}`
            : ""}
        </p>
        <ReportExportButtons
          assetIds={data.rows.map((r) => r.id)}
          filters={filters}
        />
      </div>
      <ReportAssetTable
        rows={data.rows}
        groupBy={groupBy}
        showWarranty={slug === "warranty"}
        showReasons={slug === "data-quality"}
      />
      {data.pageCount > 1 ? (
        <div className="print:hidden flex gap-2">
          {data.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/${slug}?page=${data.page - 1}`}>
                Previous
              </Link>
            </Button>
          ) : null}
          {data.page < data.pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/${slug}?page=${data.page + 1}`}>Next</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReportHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="print:hidden text-xs text-muted-foreground">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>{" "}
        / {title}
      </p>
      <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
