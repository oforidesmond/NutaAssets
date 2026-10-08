import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  entryId: string;
  branchName: string;
  branchCode: string;
  status: string;
  total: number;
  found: number;
  missing: number;
  unlisted: number;
  pending: number;
  completionPct: number;
};

export function ReconReportTable({
  rows,
  exerciseId,
}: {
  rows: Row[];
  exerciseId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No branch sheets in this exercise.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border print:border-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Found</TableHead>
            <TableHead className="text-right">Missing</TableHead>
            <TableHead className="text-right">New</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Complete %</TableHead>
            <TableHead className="print:hidden"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.entryId}>
              <TableCell className="font-medium">
                {r.branchName}{" "}
                <span className="text-muted-foreground">({r.branchCode})</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.status.replaceAll("_", " ")}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.total}</TableCell>
              <TableCell className="text-right tabular-nums">{r.found}</TableCell>
              <TableCell className="text-right tabular-nums">{r.missing}</TableCell>
              <TableCell className="text-right tabular-nums">{r.unlisted}</TableCell>
              <TableCell className="text-right tabular-nums">{r.pending}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.completionPct}%
              </TableCell>
              <TableCell className="print:hidden">
                <Link
                  href={`/reconciliation/${exerciseId}/${r.entryId}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open sheet
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
