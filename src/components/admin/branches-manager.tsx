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
  createBranchAction,
  createLocationAction,
  deleteBranchAction,
  deleteLocationAction,
  updateBranchAction,
  updateLocationAction,
} from "@/server/actions/admin";

type Location = { id: string; name: string; branchId: string };
type Branch = {
  id: string;
  name: string;
  code: string;
  type: "BRANCH" | "HEAD_OFFICE" | "DATA_CENTER" | "OTHER";
  address: string | null;
  isActive: boolean;
  sortOrder: number;
  locations: Location[];
  _count: { assets: number };
};

const emptyBranch = {
  name: "",
  code: "",
  type: "BRANCH" as const,
  address: "",
  isActive: true,
  sortOrder: 0,
};

export function BranchesManager({ initial }: { initial: Branch[] }) {
  const [branches, setBranches] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<{
    name: string;
    code: string;
    type: Branch["type"];
    address: string;
    isActive: boolean;
    sortOrder: number;
  }>(emptyBranch);
  const [locationBranchId, setLocationBranchId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyBranch);
    setOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      type: branch.type,
      address: branch.address ?? "",
      isActive: branch.isActive,
      sortOrder: branch.sortOrder,
    });
    setOpen(true);
  }

  function saveBranch() {
    startTransition(async () => {
      const payload = {
        ...form,
        address: form.address || null,
      };
      const result = editing
        ? await updateBranchAction(editing.id, payload)
        : await createBranchAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save branch");
        return;
      }
      toast.success(editing ? "Branch updated" : "Branch created");
      setOpen(false);
      window.location.reload();
    });
  }

  function removeBranch(id: string) {
    if (!confirm("Deactivate and remove this branch?")) return;
    startTransition(async () => {
      const result = await deleteBranchAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete");
        return;
      }
      toast.success("Branch removed");
      setBranches((prev) => prev.filter((b) => b.id !== id));
    });
  }

  function saveLocation() {
    if (!locationBranchId || !locationName.trim()) return;
    startTransition(async () => {
      if (editingLocation) {
        const result = await updateLocationAction(
          editingLocation.id,
          locationName,
        );
        if (!result.ok) {
          toast.error(result.error ?? "Could not update location");
          return;
        }
        toast.success("Location updated");
      } else {
        const result = await createLocationAction({
          branchId: locationBranchId,
          name: locationName,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Could not add location");
          return;
        }
        toast.success("Location added");
      }
      setLocationBranchId(null);
      setEditingLocation(null);
      setLocationName("");
      window.location.reload();
    });
  }

  function removeLocation(id: string) {
    if (!confirm("Remove this location?")) return;
    startTransition(async () => {
      const result = await deleteLocationAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete location");
        return;
      }
      toast.success("Location removed");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Branch codes feed into suggested asset tags.
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="h-4 w-4" />
          Add branch
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">
                  {branch.name}
                  {!branch.isActive && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (inactive)
                    </span>
                  )}
                </TableCell>
                <TableCell>{branch.code}</TableCell>
                <TableCell className="text-muted-foreground">
                  {branch.type.replaceAll("_", " ")}
                </TableCell>
                <TableCell>{branch._count.assets}</TableCell>
                <TableCell>
                  <ul className="space-y-1 text-sm">
                    {branch.locations.map((loc) => (
                      <li
                        key={loc.id}
                        className="flex items-center gap-2"
                      >
                        <span>{loc.name}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setLocationBranchId(branch.id);
                            setEditingLocation(loc);
                            setLocationName(loc.name);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeLocation(loc.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setLocationBranchId(branch.id);
                          setEditingLocation(null);
                          setLocationName("");
                        }}
                      >
                        + Add location
                      </button>
                    </li>
                  </ul>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(branch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBranch(branch.id)}
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
              {editing ? "Edit branch" : "Add branch"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    type: v as Branch["type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRANCH">Branch</SelectItem>
                  <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                  <SelectItem value="DATA_CENTER">Data Center</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBranch} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!locationBranchId}
        onOpenChange={(v) => {
          if (!v) {
            setLocationBranchId(null);
            setEditingLocation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit location" : "Add location"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="loc-name">Name</Label>
            <Input
              id="loc-name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Cash Office, Server Room…"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLocationBranchId(null);
                setEditingLocation(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveLocation} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
