"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraft } from "@/hooks/use-form-draft";
import { hasText } from "@/lib/form-draft";
import { createExerciseAction } from "@/server/actions/reconciliation";

type Dept = { id: string; name: string; code: string };
type Branch = { id: string; name: string; code: string };

type ExerciseDraft = {
  departmentId: string;
  name: string;
  startDate: string;
  endDate: string;
  notes: string;
  scopeBranchIds: string[];
};

export function CreateExerciseForm({
  departments,
  branches,
  initialDepartmentId,
}: {
  departments: Dept[];
  branches: Branch[];
  initialDepartmentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [departmentId, setDepartmentId] = useState(
    initialDepartmentId ?? departments[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scopeBranchIds, setScopeBranchIds] = useState<string[]>(
    branches.map((b) => b.id),
  );

  const draftKey = "recon:new";
  const draftValues = useMemo<ExerciseDraft>(
    () => ({
      departmentId,
      name,
      startDate,
      endDate,
      notes,
      scopeBranchIds,
    }),
    [departmentId, name, startDate, endDate, notes, scopeBranchIds],
  );

  const restoreDraft = useCallback(
    (draft: ExerciseDraft) => {
      const deptOk = departments.some((d) => d.id === draft.departmentId);
      if (deptOk) setDepartmentId(draft.departmentId);
      setName(draft.name ?? "");
      if (hasText(draft.startDate)) setStartDate(draft.startDate);
      setEndDate(draft.endDate ?? "");
      setNotes(draft.notes ?? "");
      const validIds = new Set(branches.map((b) => b.id));
      const scoped = (draft.scopeBranchIds ?? []).filter((id) =>
        validIds.has(id),
      );
      setScopeBranchIds(scoped);
    },
    [branches, departments],
  );

  const { clearDraft } = useFormDraft({
    draftKey,
    values: draftValues,
    isEmpty: (v) => !hasText(v.name) && !hasText(v.notes) && !hasText(v.endDate),
    onRestore: restoreDraft,
  });

  function toggleBranch(id: string) {
    setScopeBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createExerciseAction({
        departmentId,
        name,
        startDate,
        endDate: endDate || null,
        notes: notes || null,
        scopeBranchIds,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not create exercise.");
        return;
      }
      clearDraft();
      toast.success("Exercise created as draft.");
      router.push(`/reconciliation/${res.data!.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="dept">Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger id="dept">
            <SelectValue placeholder="Select department" />
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

      <div className="space-y-2">
        <Label htmlFor="name">Exercise name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 2026 Annual ICT Reconciliation"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start">Start date</Label>
          <Input
            id="start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End date (optional)</Label>
          <Input
            id="end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Branches in scope</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScopeBranchIds(branches.map((b) => b.id))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScopeBranchIds([])}
          >
            Clear
          </Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
          {branches.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={scopeBranchIds.includes(b.id)}
                onCheckedChange={() => toggleBranch(b.id)}
              />
              <span>
                {b.name}{" "}
                <span className="text-muted-foreground">({b.code})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !departmentId}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/reconciliation")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
