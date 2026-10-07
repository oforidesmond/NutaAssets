"use client";

import { useTransition } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { restoreAssetAction } from "@/server/actions/admin";

type DeletedAsset = {
  id: string;
  assetTag: string | null;
  brand: string | null;
  model: string | null;
  deletedAt: Date | string | null;
  category: { name: string };
  branch: { name: string };
  status: { name: string; color: string };
};

export function RecycleBin({ assets }: { assets: DeletedAsset[] }) {
  const [pending, startTransition] = useTransition();

  function restore(id: string) {
    startTransition(async () => {
      const result = await restoreAssetAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not restore");
        return;
      }
      toast.success("Asset restored");
      window.location.reload();
    });
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        Recycle bin is empty.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deleted</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell>
                <Link
                  href={`/assets/${asset.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {asset.assetTag ?? "—"}
                </Link>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {asset.category.name}
                  {(asset.brand || asset.model) && (
                    <div className="text-muted-foreground">
                      {[asset.brand, asset.model].filter(Boolean).join(" ")}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{asset.branch.name}</TableCell>
              <TableCell>
                <Badge
                  style={{
                    backgroundColor: asset.status.color,
                    color: "#fff",
                    borderColor: "transparent",
                  }}
                >
                  {asset.status.name}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {asset.deletedAt
                  ? formatDateTime(new Date(asset.deletedAt))
                  : "—"}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => restore(asset.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
