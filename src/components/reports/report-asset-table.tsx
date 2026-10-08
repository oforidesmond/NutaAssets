import Link from "next/link";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { ReportAssetRow } from "@/server/queries/reports";

type TableRowItem =
  | { kind: "group"; key: string; label: string }
  | { kind: "asset"; row: ReportAssetRow };

function buildRows(
  rows: ReportAssetRow[],
  groupBy?: "branch" | "assignee",
): TableRowItem[] {
  if (!groupBy) {
    return rows.map((row) => ({ kind: "asset" as const, row }));
  }

  const items: TableRowItem[] = [];
  let lastGroup = "";
  for (const row of rows) {
    const label =
      groupBy === "assignee"
        ? row.assignedToText?.trim() || "(Unassigned)"
        : row.branch.name;
    if (label !== lastGroup) {
      items.push({ kind: "group", key: `g-${label}`, label });
      lastGroup = label;
    }
    items.push({ kind: "asset", row });
  }
  return items;
}

export function ReportAssetTable({
  rows,
  groupBy,
  showWarranty,
  showReasons,
}: {
  rows: ReportAssetRow[];
  groupBy?: "branch" | "assignee";
  showWarranty?: boolean;
  showReasons?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No rows match this report.
      </p>
    );
  }

  const colSpan = 8 + (showWarranty ? 1 : 0) + (showReasons ? 1 : 0);
  const items = buildRows(rows, groupBy);

  return (
    <div className="overflow-x-auto rounded-md border print:border-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand / Model</TableHead>
            <TableHead>Serial</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Assigned to</TableHead>
            {showWarranty ? <TableHead>Warranty</TableHead> : null}
            {showReasons ? <TableHead>Review reasons</TableHead> : null}
            <TableHead className="print:hidden"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            if (item.kind === "group") {
              return (
                <TableRow key={item.key} className="bg-muted/50">
                  <TableCell colSpan={colSpan} className="font-semibold">
                    {item.label}
                  </TableCell>
                </TableRow>
              );
            }

            const row = item.row;
            return (
              <Fragment key={row.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    {row.assetTag ?? "—"}
                  </TableCell>
                  <TableCell>{row.category.name}</TableCell>
                  <TableCell>
                    {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.serialNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="border-0 text-white"
                      style={{ backgroundColor: row.status.color }}
                    >
                      {row.status.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.branch.name}</TableCell>
                  <TableCell>{row.assignedToText ?? "—"}</TableCell>
                  {showWarranty ? (
                    <TableCell>{formatDate(row.warrantyExpiry)}</TableCell>
                  ) : null}
                  {showReasons ? (
                    <TableCell className="max-w-[12rem] text-xs">
                      {row.reviewReasons.join(", ") || "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="print:hidden">
                    <Link
                      href={`/assets/${row.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
