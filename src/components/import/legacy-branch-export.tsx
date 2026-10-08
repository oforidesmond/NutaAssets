"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadLegacyBranchSheet } from "@/lib/export/legacy-sheet";
import {
  exportAssetsAction,
} from "@/server/actions/assets";
import { getImportContextAction } from "@/server/actions/import";

type Dept = { id: string; name: string; code: string };

export function LegacyBranchExport({
  departments,
  initialDepartmentId,
}: {
  departments: Dept[];
  initialDepartmentId: string | null;
}) {
  const [departmentId, setDepartmentId] = useState(
    initialDepartmentId && initialDepartmentId !== "all"
      ? initialDepartmentId
      : (departments[0]?.id ?? ""),
  );
  const [branches, setBranches] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [branchId, setBranchId] = useState("");
  const [inventoryDate, setInventoryDate] = useState(
    new Date().toLocaleDateString("en-GB"),
  );
  const [preparedBy, setPreparedBy] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!departmentId) return;
    void getImportContextAction(departmentId).then((res) => {
      if (res.ok && res.data) {
        setBranches(res.data.branches);
        if (!branchId && res.data.branches[0]) {
          setBranchId(res.data.branches[0].id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const branch = branches.find((b) => b.id === branchId);

  return (
    <div className="max-w-lg space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Legacy branch sheet</h2>
        <p className="text-sm text-muted-foreground">
          Excel layout matching the original inventory sheet (title, header
          block, legend, table).
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Branch</Label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Inventory date</Label>
        <Input
          value={inventoryDate}
          onChange={(e) => setInventoryDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Prepared by</Label>
        <Input
          value={preparedBy}
          onChange={(e) => setPreparedBy(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        For CSV / Excel / PDF / label sheets of any filtered view, use the Export
        menu on the Assets list.
      </p>
      <Button
        disabled={!branchId || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await exportAssetsAction({
              filters: {
                departmentId,
                branchId,
              },
              columns: [
                "assetTag",
                "category",
                "brand",
                "model",
                "serialNumber",
                "assignedToText",
                "status",
                "location",
                "remarks",
              ],
            });
            if (!res.ok || !res.data) {
              toast.error(res.error ?? "Export failed");
              return;
            }
            await downloadLegacyBranchSheet(
              `inventory-${branch?.code ?? "branch"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
              res.data.rows,
              {
                branchName: branch?.name ?? "Branch",
                inventoryDate,
                preparedBy: preparedBy || "—",
              },
            );
            toast.success(`Exported ${res.data.rows.length} row(s)`);
          })
        }
      >
        Download legacy Excel
      </Button>
    </div>
  );
}
