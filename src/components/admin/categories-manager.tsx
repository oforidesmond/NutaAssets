"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/actions/admin";

type Category = {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  parentId: string | null;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: { assets: number };
};

const empty = {
  name: "",
  code: "",
  icon: "",
  parentId: "",
  isActive: true,
};

export function CategoriesManager({
  departmentId,
  initial,
}: {
  departmentId: string;
  initial: Category[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(empty);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      code: cat.code,
      icon: cat.icon ?? "",
      parentId: cat.parentId ?? "",
      isActive: cat.isActive,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        departmentId,
        name: form.name,
        code: form.code,
        icon: form.icon || null,
        parentId: form.parentId || null,
        isActive: form.isActive,
      };
      const result = editing
        ? await updateCategoryAction(editing.id, payload)
        : await createCategoryAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false);
      window.location.reload();
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this category?")) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete");
        return;
      }
      toast.success("Category removed");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Categories replace free-text asset types and drive tag suggestions.
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No categories yet for this department.
                </TableCell>
              </TableRow>
            ) : (
              initial.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{cat.code}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cat.parent?.name ?? "—"}
                  </TableCell>
                  <TableCell>{cat._count.assets}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(cat.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit category" : "Add category"}
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
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Icon (lucide name, optional)</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="Laptop"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Parent</Label>
              <Select
                value={form.parentId || "__none"}
                onValueChange={(v) =>
                  setForm({ ...form, parentId: v === "__none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {initial
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
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
