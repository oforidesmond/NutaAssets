"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createStatusAction,
  deleteStatusAction,
  updateStatusAction,
} from "@/server/actions/admin";

type Status = {
  id: string;
  name: string;
  color: string;
  kind: "IN_USE" | "NOT_IN_USE" | "NEEDS_ATTENTION" | "END_OF_LIFE";
  isDefault: boolean;
  sortOrder: number;
  _count: { assets: number };
};

const empty = {
  name: "",
  color: "#22c55e",
  kind: "IN_USE" as Status["kind"],
  isDefault: false,
  sortOrder: 0,
};

export function StatusesManager({
  departmentId,
  initial,
}: {
  departmentId: string;
  initial: Status[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Status | null>(null);
  const [form, setForm] = useState(empty);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(status: Status) {
    setEditing(status);
    setForm({
      name: status.name,
      color: status.color,
      kind: status.kind,
      isDefault: status.isDefault,
      sortOrder: status.sortOrder,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        departmentId,
        ...form,
      };
      const result = editing
        ? await updateStatusAction(editing.id, payload)
        : await createStatusAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(editing ? "Status updated" : "Status created");
      setOpen(false);
      window.location.reload();
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this status?")) return;
    startTransition(async () => {
      const result = await deleteStatusAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete");
        return;
      }
      toast.success("Status removed");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Statuses are scoped to the selected department.
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="h-4 w-4" />
          Add status
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.map((status) => (
              <TableRow key={status.id}>
                <TableCell>
                  <Badge
                    style={{
                      backgroundColor: status.color,
                      color: "#fff",
                      borderColor: "transparent",
                    }}
                  >
                    {status.name}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {status.kind.replaceAll("_", " ")}
                </TableCell>
                <TableCell>{status.isDefault ? "Yes" : "—"}</TableCell>
                <TableCell>{status._count.assets}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(status)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(status.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit status" : "Add status"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Colour</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm({ ...form, kind: v as Status["kind"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_USE">In use</SelectItem>
                  <SelectItem value="NOT_IN_USE">Not in use</SelectItem>
                  <SelectItem value="NEEDS_ATTENTION">Needs attention</SelectItem>
                  <SelectItem value="END_OF_LIFE">End of life</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.target.checked })
                }
              />
              Default status for new assets
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
