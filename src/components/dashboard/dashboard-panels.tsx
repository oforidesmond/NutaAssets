import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type NeedsAttention = {
  id: string;
  assetTag: string | null;
  brand: string | null;
  model: string | null;
  remarks: string | null;
  status: { name: string; color: string };
  branch: { name: string };
};

type Recent = {
  id: string;
  assetTag: string | null;
  brand: string | null;
  model: string | null;
  updatedAt: Date;
  status: { name: string; color: string };
  branch: { name: string };
  category: { name: string };
};

type ReconProgress = {
  id: string;
  name: string;
  status: string;
  branches: { entryId: string; branchName: string; status: string }[];
};

export function DashboardPanels({
  needsAttention,
  recentlyChanged,
  reconProgress,
}: {
  needsAttention: NeedsAttention[];
  recentlyChanged: Recent[];
  reconProgress: ReconProgress[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsAttention.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No faulty or in-repair assets right now.
            </p>
          ) : (
            needsAttention.map((a) => (
              <Link
                key={a.id}
                href={`/assets/${a.id}`}
                className="block rounded-md border p-2 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {a.assetTag ?? "No tag"} · {a.brand ?? "—"}
                  </span>
                  <Badge
                    style={{ backgroundColor: a.status.color, color: "#fff" }}
                    className="shrink-0 border-0"
                  >
                    {a.status.name}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {a.branch.name}
                  {a.remarks ? ` — ${a.remarks}` : ""}
                </p>
              </Link>
            ))
          )}
          <Link
            href="/reports/needs-attention"
            className="text-xs font-medium text-primary hover:underline"
          >
            View full list
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recently changed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentlyChanged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent changes.</p>
          ) : (
            recentlyChanged.map((a) => (
              <Link
                key={a.id}
                href={`/assets/${a.id}`}
                className="block rounded-md border p-2 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {a.assetTag ?? "No tag"} · {a.category.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(a.updatedAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {a.branch.name} · {a.status.name}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reconciliation progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reconProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active reconciliation exercises.{" "}
              <Link href="/reconciliation" className="text-primary hover:underline">
                Start one
              </Link>
            </p>
          ) : (
            reconProgress.map((ex) => (
              <div key={ex.id} className="rounded-md border p-2">
                <Link
                  href={`/reconciliation/${ex.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {ex.name}
                </Link>
                <ul className="mt-2 space-y-1">
                  {ex.branches.map((b) => (
                    <li
                      key={b.entryId}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{b.branchName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {b.status.replaceAll("_", " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
