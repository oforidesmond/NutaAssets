import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AssetsTable } from "@/components/assets/assets-table";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import {
  getAssetFilterOptions,
  listAssets,
  parseAssetListParams,
} from "@/server/queries/assets";
import { listSavedViews } from "@/server/queries/views";

export const metadata: Metadata = { title: "Assets" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = parseAssetListParams(await searchParams);
  const options = await getAssetFilterOptions(session.user);
  const [list, views] = await Promise.all([
    listAssets(session.user, params),
    listSavedViews(session.user, options.departmentId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Assets
        </h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and manage the asset register.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AssetsTable
          rows={list.rows.map((r) => ({
            ...r,
            updatedAt: r.updatedAt.toISOString(),
          }))}
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          pageCount={list.pageCount}
          columns={list.columns}
          canMutate={can(session.user, "create")}
          branches={options.branches}
          categories={options.categories}
          statuses={options.statuses}
          savedViews={views.map((v) => ({
            id: v.id,
            name: v.name,
            filters: v.filters,
            columns: v.columns,
            sort: v.sort,
          }))}
          departmentId={options.departmentId}
        />
      </Suspense>
    </div>
  );
}
