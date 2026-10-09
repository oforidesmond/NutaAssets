"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ScanDialog } from "@/components/assets/scan-dialog";
import { StatusBadge } from "@/components/assets/status-badge";
import { EntryStatusBadge } from "@/components/reconciliation/entry-status-badge";
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
import { SuggestInput } from "@/components/ui/suggest-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { assigneeSuggestionsAction } from "@/server/actions/assets";
import {
  addUnlistedItemAction,
  removeUnlistedItemAction,
  submitEntryAction,
  verifyItemAction,
} from "@/server/actions/reconciliation";

type Option = { id: string; name: string; color?: string };

type SheetItem = {
  id: string;
  result: string | null;
  note: string | null;
  observed: unknown;
  assetId: string | null;
  asset: {
    id: string;
    assetTag: string | null;
    serialNumber: string | null;
    brand: string | null;
    model: string | null;
    assignedToText: string | null;
    category: { id: string; name: string };
    status: { id: string; name: string; color: string };
    location: { id: string; name: string } | null;
  } | null;
};

type Counts = {
  total: number;
  pending: number;
  found: number;
  different: number;
  missing: number;
  unlisted: number;
};

type Filter =
  | "all"
  | "pending"
  | "FOUND"
  | "FOUND_DIFFERENT"
  | "MISSING"
  | "NEW_UNLISTED";

export function BranchSheet({
  exerciseId,
  entryId,
  branchName,
  exerciseName,
  entryStatus,
  comment,
  locked,
  canSubmit,
  canApprove,
  items,
  counts,
  categories,
  statuses,
  locations,
  initialFilter,
  initialQ,
}: {
  exerciseId: string;
  entryId: string;
  branchName: string;
  exerciseName: string;
  entryStatus: string;
  comment: string | null;
  locked: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  items: SheetItem[];
  counts: Counts;
  categories: Option[];
  statuses: Option[];
  locations: Option[];
  initialFilter: Filter;
  initialQ: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState(initialQ);
  const [scanOpen, setScanOpen] = useState(false);
  const [differItem, setDifferItem] = useState<SheetItem | null>(null);
  const [missingItem, setMissingItem] = useState<SheetItem | null>(null);
  const [missingNote, setMissingNote] = useState("");
  const [unlistedOpen, setUnlistedOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const verified = counts.total - counts.pending;
  const progress =
    counts.total === 0 ? 0 : Math.round((verified / counts.total) * 100);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "pending") list = list.filter((i) => i.result == null);
    else if (filter !== "all") list = list.filter((i) => i.result === filter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((i) => {
        const a = i.asset;
        const obs = (i.observed ?? {}) as Record<string, string>;
        const hay = [
          a?.assetTag,
          a?.serialNumber,
          a?.brand,
          a?.model,
          a?.assignedToText,
          a?.category.name,
          obs.assetTag,
          obs.serialNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return list;
  }, [items, filter, q]);

  function refresh(opts?: { filter?: Filter; q?: string }) {
    const params = new URLSearchParams();
    const f = opts?.filter ?? filter;
    const query = opts?.q ?? q;
    if (f !== "all") params.set("filter", f);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    router.push(
      `/reconciliation/${exerciseId}/${entryId}${qs ? `?${qs}` : ""}`,
    );
    router.refresh();
  }

  function markFound(item: SheetItem) {
    if (locked) return;
    startTransition(async () => {
      const res = await verifyItemAction({
        itemId: item.id,
        result: "FOUND",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not mark found.");
        return;
      }
      toast.success("Marked found");
      router.refresh();
    });
  }

  function confirmMissing() {
    if (!missingItem) return;
    startTransition(async () => {
      const res = await verifyItemAction({
        itemId: missingItem.id,
        result: "MISSING",
        note: missingNote,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not mark missing.");
        return;
      }
      toast.success("Marked missing");
      setMissingItem(null);
      setMissingNote("");
      router.refresh();
    });
  }

  function onScan(value: string) {
    const raw = value.trim();
    const idMatch = raw.match(/\/a\/([a-z0-9]+)/i);
    const assetId = idMatch?.[1];
    const needle = (assetId ?? raw).toLowerCase();

    const hit = items.find((i) => {
      if (assetId && i.assetId === assetId) return true;
      if (!i.asset) return false;
      return (
        i.asset.id === needle ||
        i.asset.assetTag?.toLowerCase() === needle ||
        i.asset.serialNumber?.toLowerCase() === needle
      );
    });

    if (!hit) {
      toast.error("No matching asset on this sheet.");
      return;
    }

    setHighlightId(hit.id);
    setFilter("all");
    setQ(hit.asset?.assetTag ?? hit.asset?.serialNumber ?? "");
    if (!locked && hit.result == null && hit.assetId) {
      markFound(hit);
    } else {
      toast.message(
        hit.asset?.assetTag ?? hit.asset?.serialNumber ?? "Item found on sheet",
      );
    }
  }

  function onSubmit() {
    if (counts.pending > 0) {
      toast.error(
        `${counts.pending} asset(s) still need a result before you can submit.`,
      );
      return;
    }
    startTransition(async () => {
      const res = await submitEntryAction({
        entryId,
        inventoryDate: new Date().toISOString().slice(0, 10),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not submit.");
        return;
      }
      toast.success("Sheet submitted for approval.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{exerciseName}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight">
                {branchName}
              </h1>
              <EntryStatusBadge status={entryStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {verified}/{counts.total} verified ({progress}%)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="mr-1 size-4" />
              Scan
            </Button>
            {!locked && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUnlistedOpen(true)}
              >
                <Plus className="mr-1 size-4" />
                Unlisted
              </Button>
            )}
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>

        {comment && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Returned: {comment}
          </p>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tag, serial, assignee…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refresh({ q });
            }}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              ["all", `All (${counts.total})`],
              ["pending", `Pending (${counts.pending})`],
              ["FOUND", `Found (${counts.found})`],
              ["FOUND_DIFFERENT", `Differ (${counts.different})`],
              ["MISSING", `Missing (${counts.missing})`],
              ["NEW_UNLISTED", `New (${counts.unlisted})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                refresh({ filter: key });
              }}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1 text-xs",
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3">
        {filtered.length === 0 ? (
          <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {counts.total === 0
              ? "Blank sheet — add any assets you find with Unlisted."
              : "No items match this filter."}
          </li>
        ) : (
          filtered.map((item) => (
            <li
              key={item.id}
              id={`item-${item.id}`}
              className={cn(
                "rounded-lg border bg-card p-3",
                highlightId === item.id && "ring-2 ring-primary",
              )}
            >
              <ItemCard
                item={item}
                locked={locked}
                pending={pending}
                onFound={() => markFound(item)}
                onDiffer={() => setDifferItem(item)}
                onMissing={() => {
                  setMissingItem(item);
                  setMissingNote("");
                }}
                onRemoveUnlisted={() => {
                  startTransition(async () => {
                    const res = await removeUnlistedItemAction(item.id);
                    if (!res.ok) {
                      toast.error(res.error ?? "Could not remove.");
                      return;
                    }
                    toast.success("Removed unlisted item");
                    router.refresh();
                  });
                }}
              />
            </li>
          ))
        )}
      </ul>

      {!locked && canSubmit && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            className="w-full sm:w-auto"
            disabled={pending || counts.pending > 0}
            onClick={onSubmit}
          >
            <Send className="mr-1.5 size-4" />
            Submit sheet
          </Button>
          {counts.pending > 0 && (
            <p className="mt-1 text-center text-xs text-muted-foreground sm:text-left">
              Finish all pending items first ({counts.pending} left).
            </p>
          )}
        </div>
      )}

      {locked && canApprove && entryStatus === "SUBMITTED" && (
        <Button asChild>
          <Link href={`/reconciliation/${exerciseId}/${entryId}/review`}>
            Review &amp; approve
          </Link>
        </Button>
      )}

      <ScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={(v) => {
          setScanOpen(false);
          onScan(v);
        }}
        title="Scan asset on this sheet"
      />

      {differItem?.asset && (
        <DifferDialog
          key={differItem.id}
          item={differItem}
          open
          onOpenChange={(o) => !o && setDifferItem(null)}
          statuses={statuses}
          locations={locations}
          pending={pending}
          onSave={(payload) => {
            startTransition(async () => {
              const res = await verifyItemAction({
                itemId: differItem.id,
                result: "FOUND_DIFFERENT",
                observed: payload.observed,
                note: payload.note,
              });
              if (!res.ok) {
                toast.error(res.error ?? "Could not save differences.");
                return;
              }
              toast.success("Saved differences");
              setDifferItem(null);
              router.refresh();
            });
          }}
        />
      )}

      <Dialog
        open={!!missingItem}
        onOpenChange={(o) => !o && setMissingItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as missing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {missingItem?.asset?.assetTag ??
              missingItem?.asset?.serialNumber ??
              "This asset"}{" "}
            was not found at {branchName}.
          </p>
          <div className="space-y-2">
            <Label htmlFor="missing-note">Note (required)</Label>
            <Textarea
              id="missing-note"
              value={missingNote}
              onChange={(e) => setMissingNote(e.target.value)}
              placeholder="e.g. Not seen in Cash Office or Magazine"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !missingNote.trim()}
              onClick={confirmMissing}
            >
              Confirm missing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnlistedDialog
        open={unlistedOpen}
        onOpenChange={setUnlistedOpen}
        categories={categories}
        statuses={statuses}
        locations={locations}
        pending={pending}
        onSave={(observed) => {
          startTransition(async () => {
            const res = await addUnlistedItemAction({
              entryId,
              observed,
            });
            if (!res.ok) {
              toast.error(res.error ?? "Could not add unlisted asset.");
              return;
            }
            toast.success("Added unlisted asset");
            setUnlistedOpen(false);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function ItemCard({
  item,
  locked,
  pending,
  onFound,
  onDiffer,
  onMissing,
  onRemoveUnlisted,
}: {
  item: SheetItem;
  locked: boolean;
  pending: boolean;
  onFound: () => void;
  onDiffer: () => void;
  onMissing: () => void;
  onRemoveUnlisted: () => void;
}) {
  const isUnlisted = item.result === "NEW_UNLISTED";
  const obs = (item.observed ?? {}) as Record<string, string | null>;
  const title =
    item.asset?.assetTag ??
    obs.assetTag ??
    item.asset?.serialNumber ??
    obs.serialNumber ??
    "No tag";
  const category =
    item.asset?.category.name ??
    (isUnlisted ? "Unlisted" : "—");
  const status = item.asset?.status;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {category}
            {item.asset?.brand ? ` · ${item.asset.brand}` : ""}
            {item.asset?.model ? ` ${item.asset.model}` : ""}
          </p>
          {item.asset?.assignedToText && (
            <p className="text-sm text-muted-foreground">
              → {item.asset.assignedToText}
            </p>
          )}
          {isUnlisted && (
            <p className="text-sm text-muted-foreground">
              {[obs.brand, obs.model, obs.assignedToText]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {status && (
            <StatusBadge name={status.name} color={status.color} />
          )}
          {item.result && (
            <span className="text-xs font-medium text-muted-foreground">
              {item.result === "FOUND"
                ? "Found"
                : item.result === "FOUND_DIFFERENT"
                  ? "Details differ"
                  : item.result === "MISSING"
                    ? "Missing"
                    : "New"}
            </span>
          )}
        </div>
      </div>

      {!locked && !isUnlisted && item.assetId && (
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            size="sm"
            variant={item.result === "FOUND" ? "default" : "outline"}
            disabled={pending}
            onClick={onFound}
            className="h-11"
          >
            <Check className="mr-1 size-4" />
            Found
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              item.result === "FOUND_DIFFERENT" ? "default" : "outline"
            }
            disabled={pending}
            onClick={onDiffer}
            className="h-11"
          >
            <Pencil className="mr-1 size-4" />
            Differ
          </Button>
          <Button
            type="button"
            size="sm"
            variant={item.result === "MISSING" ? "destructive" : "outline"}
            disabled={pending}
            onClick={onMissing}
            className="h-11"
          >
            <X className="mr-1 size-4" />
            Missing
          </Button>
        </div>
      )}

      {!locked && isUnlisted && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onRemoveUnlisted}
        >
          <Trash2 className="mr-1 size-3.5" />
          Remove
        </Button>
      )}
    </div>
  );
}

function DifferDialog({
  item,
  open,
  onOpenChange,
  statuses,
  locations,
  pending,
  onSave,
}: {
  item: SheetItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statuses: Option[];
  locations: Option[];
  pending: boolean;
  onSave: (payload: {
    observed: {
      statusId?: string | null;
      locationId?: string | null;
      assignedToText?: string | null;
      serialNumber?: string | null;
      brand?: string | null;
      model?: string | null;
      remarks?: string | null;
    };
    note?: string | null;
  }) => void;
}) {
  const asset = item.asset!;
  const [statusId, setStatusId] = useState(asset.status.id);
  const [locationId, setLocationId] = useState(asset.location?.id ?? "");
  const [assignedToText, setAssignedToText] = useState(
    asset.assignedToText ?? "",
  );
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber ?? "");
  const [brand, setBrand] = useState(asset.brand ?? "");
  const [model, setModel] = useState(asset.model ?? "");
  const [remarks, setRemarks] = useState("");
  const [note, setNote] = useState("");

  const fetchAssignees = useCallback(async (q: string) => {
    const res = await assigneeSuggestionsAction(q);
    return res.ok ? (res.data?.items ?? []) : [];
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Details differ</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Update what you actually found for{" "}
          {asset.assetTag ?? asset.serialNumber ?? "this asset"}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sub-location</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Assigned to</Label>
            <SuggestInput
              value={assignedToText}
              onChange={setAssignedToText}
              fetchSuggestions={fetchAssignees}
              placeholder="Person or unit name"
            />
          </div>
          <div className="space-y-2">
            <Label>Serial</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Remarks / note</Label>
            <Textarea
              value={note || remarks}
              onChange={(e) => {
                setNote(e.target.value);
                setRemarks(e.target.value);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                observed: {
                  statusId,
                  locationId: locationId || null,
                  assignedToText,
                  serialNumber,
                  brand,
                  model,
                  remarks: remarks || null,
                },
                note: note || null,
              })
            }
          >
            Save differences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlistedDialog({
  open,
  onOpenChange,
  categories,
  statuses,
  locations,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Option[];
  statuses: Option[];
  locations: Option[];
  pending: boolean;
  onSave: (observed: {
    categoryId: string;
    statusId: string;
    locationId?: string | null;
    assetTag?: string | null;
    serialNumber?: string | null;
    brand?: string | null;
    model?: string | null;
    assignedToText?: string | null;
    remarks?: string | null;
  }) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [assignedToText, setAssignedToText] = useState("");
  const [remarks, setRemarks] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add unlisted asset</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Found something not on the expected list? Record it here — it will be
          added to the register when the sheet is approved.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Asset tag</Label>
            <Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Serial</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Assigned to</Label>
            <Input
              value={assignedToText}
              onChange={(e) => setAssignedToText(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Sub-location</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !categoryId || !statusId}
            onClick={() =>
              onSave({
                categoryId,
                statusId,
                locationId: locationId || null,
                assetTag: assetTag || null,
                serialNumber: serialNumber || null,
                brand: brand || null,
                model: model || null,
                assignedToText: assignedToText || null,
                remarks: remarks || null,
              })
            }
          >
            Add to sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
