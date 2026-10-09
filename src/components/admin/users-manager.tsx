"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
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
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/server/actions/admin";

type Role = "SUPER_ADMIN" | "DEPT_ADMIN" | "EDITOR" | "VIEWER";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | Date | null;
  departments: { departmentId: string; department: { name: string } }[];
  branches: { branchId: string; branch: { name: string } }[];
};

type Option = { id: string; name: string };

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  DEPT_ADMIN: "Department Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export function UsersManager({
  initial,
  departments,
  branches,
}: {
  initial: UserRow[];
  departments: Option[];
  branches: Option[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "EDITOR" as Role,
    isActive: true,
    departmentIds: [] as string[],
    branchIds: [] as string[],
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "EDITOR",
      isActive: true,
      departmentIds: [],
      branchIds: [],
    });
    setOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      password: "",
      role: user.role,
      isActive: user.isActive,
      departmentIds: user.departments.map((d) => d.departmentId),
      branchIds: user.branches.map((b) => b.branchId),
    });
    setOpen(true);
  }

  function toggleId(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function save() {
    startTransition(async () => {
      if (editing) {
        const result = await updateUserAction(editing.id, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          isActive: form.isActive,
          departmentIds: form.departmentIds,
          branchIds: form.branchIds,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Could not save");
          return;
        }
        toast.success("User updated");
      } else {
        if (form.password.length < 8) {
          toast.error("Temporary password must be at least 8 characters");
          return;
        }
        const result = await createUserAction({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: form.role,
          isActive: form.isActive,
          departmentIds: form.departmentIds,
          branchIds: form.branchIds,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Could not create");
          return;
        }
        if (result.data?.smsSent) {
          toast.success(
            "User created — login credentials sent by SMS. They must change password on first login.",
          );
        } else {
          toast.warning(
            "User created, but SMS failed — share the email and temporary password manually.",
          );
        }
      }
      setOpen(false);
      window.location.reload();
    });
  }

  function resetPassword() {
    if (!resetUserId || tempPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPasswordAction(resetUserId, {
        password: tempPassword,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not reset");
        return;
      }
      if (result.data?.smsSent) {
        toast.success(
          "Password reset — credentials sent by SMS. User must change it on next login.",
        );
      } else {
        toast.warning(
          "Password reset, but SMS failed — share the temporary password manually.",
        );
      }
      setResetOpen(false);
      setTempPassword("");
      setResetUserId(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="mr-1 h-4 w-4" />
          Add user
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.map((user) => (
              <TableRow
                key={user.id}
                className={!user.isActive ? "opacity-60" : undefined}
              >
                <TableCell className="font-medium">
                  {user.name}
                  {user.mustChangePassword && (
                    <span className="ml-2 text-xs text-amber-600">
                      must change pwd
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{user.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.phone ?? "—"}
                </TableCell>
                <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {user.departments.map((d) => d.department.name).join(", ") ||
                    (user.role === "SUPER_ADMIN" ? "All" : "—")}
                </TableCell>
                <TableCell>{user.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(user)}
                      disabled={pending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setResetUserId(user.id);
                        setTempPassword("");
                        setResetOpen(true);
                      }}
                      disabled={pending}
                      title="Reset password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
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
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="024XXXXXXX or 233XXXXXXXXX"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Ghana number. Used to SMS login credentials.
              </p>
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Min 8 characters. Sent by SMS; user must change it on first
                  login.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, role: v as Role }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Departments</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.departmentIds.includes(d.id)}
                      onCheckedChange={() =>
                        setForm((f) => ({
                          ...f,
                          departmentIds: toggleId(f.departmentIds, d.id),
                        }))
                      }
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Branch restriction (optional)</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.branchIds.includes(b.id)}
                      onCheckedChange={() =>
                        setForm((f) => ({
                          ...f,
                          branchIds: toggleId(f.branchIds, b.id),
                        }))
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to allow all branches in their departments.
              </p>
            </div>
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
            <Button
              onClick={save}
              disabled={
                pending || !form.name || !form.email || !form.phone
              }
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Temporary password</Label>
            <Input
              type="password"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sent by SMS to the user&apos;s phone number.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resetPassword} disabled={pending}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
