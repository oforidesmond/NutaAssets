"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createDepartmentAction,
  deactivateDepartmentAction,
  updateDepartmentAction,
} from "@/server/actions/admin";

type Dept = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count: {
    assets: number;
    categories: number;
    fieldDefs: number;
    statuses: number;
  };
};

export function DepartmentsManager({ initial }: { initial: Dept[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    isActive: true,
    cloneFromDepartmentId: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      description: "",
      isActive: true,
      cloneFromDepartmentId: "",
    });
    setOpen(true);
  }

  function openEdit(dept: Dept) {
    setEditing(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description ?? "",
      isActive: dept.isActive,
      cloneFromDepartmentId: "",
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        isActive: form.isActive,
        cloneFromDepartmentId: editing
          ? null
          : form.cloneFromDepartmentId || null,
      };
      const result = editing
        ? await updateDepartmentAction(editing.id, payload)
        : await createDepartmentAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(editing ? "Department updated" : "Department created");
      setOpen(false);
      window.location.reload();
    });
  }

  function deactivate(id: string) {
    if (!confirm("Deactivate this department? Users can no longer select it."))
      return;
    startTransition(async () => {
      const result = await deactivateDepartmentAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not deactivate");
        return;
      }
      toast.success("Department deactivated");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="mr-1 h-4 w-4" />
          Add department
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.map((dept) => (
              <TableRow key={dept.id} className={!dept.isActive ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{dept.name}</TableCell>
                <TableCell className="font-mono text-xs">{dept.code}</TableCell>
                <TableCell>{dept.isActive ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {dept._count.categories} cat · {dept._count.statuses} status ·{" "}
                  {dept._count.fieldDefs} fields
                </TableCell>
                <TableCell>{dept._count.assets}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(dept)}
                      disabled={pending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {dept.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deactivate(dept.id)}
                        disabled={pending}
                        title="Deactivate"
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    )}
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
              {editing ? "Edit department" : "Add department"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Clone config from</Label>
                <Select
                  value={form.cloneFromDepartmentId || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      cloneFromDepartmentId: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Start empty</SelectItem>
                    {initial.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Copies categories, statuses, and custom fields (not assets).
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, isActive: c === true }))
                }
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form.name || !form.code}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
