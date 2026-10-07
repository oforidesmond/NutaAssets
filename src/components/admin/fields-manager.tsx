"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldType } from "@prisma/client";
import { Archive, GripVertical, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { DynamicField } from "@/components/forms/dynamic-field";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ALL_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  slugifyFieldKey,
  type FieldOption,
} from "@/lib/custom-fields";
import { cn } from "@/lib/utils";
import {
  archiveFieldAction,
  createFieldAction,
  reorderFieldsAction,
  restoreFieldAction,
  updateFieldAction,
} from "@/server/actions/admin";

type CategoryOption = { id: string; name: string; code: string };

type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  required: boolean;
  unique: boolean;
  helpText: string | null;
  placeholder: string | null;
  defaultValue: unknown;
  showInList: boolean;
  searchable: boolean;
  sortOrder: number;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string; code: string } | null;
};

type FormState = {
  label: string;
  key: string;
  type: FieldType;
  categoryId: string;
  optionsText: string;
  required: boolean;
  unique: boolean;
  helpText: string;
  placeholder: string;
  showInList: boolean;
  searchable: boolean;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  label: "",
  key: "",
  type: "TEXT",
  categoryId: "",
  optionsText: "",
  required: false,
  unique: false,
  helpText: "",
  placeholder: "",
  showInList: false,
  searchable: true,
  isActive: true,
});

function optionsToText(options: unknown): string {
  if (!Array.isArray(options)) return "";
  return options
    .map((o) => {
      if (o && typeof o === "object" && "label" in o) {
        return String((o as FieldOption).label);
      }
      return String(o);
    })
    .join("\n");
}

function textToOptions(text: string): FieldOption[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({
      value: slugifyFieldKey(label).replace(/^field$/, label.toLowerCase()),
      label,
    }));
}

export function FieldsManager({
  departmentId,
  initial,
  categories,
}: {
  departmentId: string;
  initial: FieldRow[];
  categories: CategoryOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visible = useMemo(
    () => rows.filter((r) => showArchived || r.isActive),
    [rows, showArchived],
  );

  const previewOptions = useMemo(
    () => textToOptions(form.optionsText),
    [form.optionsText],
  );

  const previewValue = useMemo(() => {
    if (form.type === "BOOLEAN") return false;
    if (form.type === "MULTI_SELECT") return [];
    return "";
  }, [form.type]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(field: FieldRow) {
    setEditing(field);
    setForm({
      label: field.label,
      key: field.key,
      type: field.type,
      categoryId: field.categoryId ?? "",
      optionsText: optionsToText(field.options),
      required: field.required,
      unique: field.unique,
      helpText: field.helpText ?? "",
      placeholder: field.placeholder ?? "",
      showInList: field.showInList,
      searchable: field.searchable,
      isActive: field.isActive,
    });
    setOpen(true);
  }

  function onLabelChange(label: string) {
    setForm((f) => {
      const cat = categories.find((c) => c.id === f.categoryId);
      const nextKey =
        editing != null
          ? f.key
          : slugifyFieldKey(label, cat?.code ?? null);
      return { ...f, label, key: nextKey };
    });
  }

  function save() {
    startTransition(async () => {
      const needsOptions =
        form.type === "SELECT" || form.type === "MULTI_SELECT";
      const options = needsOptions ? textToOptions(form.optionsText) : null;
      if (needsOptions && (!options || options.length === 0)) {
        toast.error("Add at least one option (one per line).");
        return;
      }

      const payload = {
        departmentId,
        categoryId: form.categoryId || null,
        key: form.key,
        label: form.label,
        type: form.type,
        options,
        required: form.required,
        unique: form.unique,
        helpText: form.helpText || null,
        placeholder: form.placeholder || null,
        defaultValue: null,
        showInList: form.showInList,
        searchable: form.searchable,
        sortOrder: editing?.sortOrder ?? rows.length,
        isActive: form.isActive,
      };

      const result = editing
        ? await updateFieldAction(editing.id, payload)
        : await createFieldAction(payload);

      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(editing ? "Field updated" : "Field created");
      setOpen(false);
      window.location.reload();
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      const result = await archiveFieldAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not archive");
        return;
      }
      toast.success("Field archived");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: false } : r)),
      );
    });
  }

  function restore(id: string) {
    startTransition(async () => {
      const result = await restoreFieldAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not restore");
        return;
      }
      toast.success("Field restored");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: true } : r)),
      );
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visible.findIndex((r) => r.id === active.id);
    const newIndex = visible.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
    const archived = rows.filter((r) => !reorderedVisible.some((v) => v.id === r.id));
    const next = [...reorderedVisible, ...archived];
    setRows(next);

    startTransition(async () => {
      const result = await reorderFieldsAction({
        departmentId,
        orderedIds: next.map((r) => r.id),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not reorder");
        setRows(initial);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(c) => setShowArchived(c === true)}
          />
          <Label htmlFor="show-archived" className="font-normal">
            Show archived
          </Label>
        </div>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="mr-1 h-4 w-4" />
          Add field
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={visible.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No custom fields yet. Add one to extend asset forms.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      pending={pending}
                      onEdit={() => openEdit(field)}
                      onArchive={() => archive(field.id)}
                      onRestore={() => restore(field.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit custom field" : "Add custom field"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-label">Label</Label>
              <Input
                id="cf-label"
                value={form.label}
                onChange={(e) => onLabelChange(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-key">Key (immutable)</Label>
              <Input
                id="cf-key"
                value={form.key}
                disabled={editing != null}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    key: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ""),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Used in exports and filters. Cannot change after creation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as FieldType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category scope</Label>
                <Select
                  value={form.categoryId || "__all__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: v === "__all__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.type === "SELECT" || form.type === "MULTI_SELECT") && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-options">Options (one per line)</Label>
                <Textarea
                  id="cf-options"
                  value={form.optionsText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, optionsText: e.target.value }))
                  }
                  rows={4}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cf-help">Help text</Label>
              <Input
                id="cf-help"
                value={form.helpText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, helpText: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-ph">Placeholder</Label>
              <Input
                id="cf-ph"
                value={form.placeholder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, placeholder: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["required", "Required"],
                  ["showInList", "Show in list"],
                  ["searchable", "Searchable"],
                  ["unique", "Unique (soft)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <Checkbox
                    checked={form[key]}
                    onCheckedChange={(c) =>
                      setForm((f) => ({ ...f, [key]: c === true }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Form preview
              </p>
              <DynamicField
                field={{
                  key: form.key || "preview",
                  label: form.label || "Field label",
                  type: form.type,
                  options: previewOptions,
                  required: form.required,
                  helpText: form.helpText || null,
                  placeholder: form.placeholder || null,
                }}
                value={previewValue}
                onChange={() => {}}
                mode="form"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form.label || !form.key}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableFieldRow({
  field,
  pending,
  onEdit,
  onArchive,
  onRestore,
}: {
  field: FieldRow;
  pending: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        !field.isActive && "opacity-60",
        isDragging && "bg-muted/50",
      )}
    >
      <TableCell>
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{field.label}</TableCell>
      <TableCell className="font-mono text-xs">{field.key}</TableCell>
      <TableCell>{FIELD_TYPE_LABELS[field.type]}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {field.category?.name ?? "All"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {[
          field.required && "req",
          field.showInList && "list",
          field.searchable && "search",
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            disabled={pending}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {field.isActive ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onArchive}
              disabled={pending}
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={onRestore}
              disabled={pending}
              title="Restore"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
