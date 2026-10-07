"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/assets/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  assignAssetAction,
  changeStatusAction,
  deleteAssetAction,
  transferAssetAction,
} from "@/server/actions/assets";

type Event = {
  id: string;
  type: string;
  note: string | null;
  fromValue: unknown;
  toValue: unknown;
  createdAt: string | Date;
  user: { id: string; name: string } | null;
};

type Asset = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  condition: string | null;
  remarks: string | null;
  needsReview: boolean;
  reviewReasons: string[];
  purchaseDate: string | Date | null;
  purchaseCost: { toString(): string } | string | null;
  warrantyExpiry: string | Date | null;
  deletedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  category: { name: string };
  branch: { id: string; name: string };
  location: { name: string } | null;
  status: { id: string; name: string; color: string };
  department: { name: string };
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
  events: Event[];
};

type Sibling = {
  id: string;
  assetTag: string | null;
  brand: string | null;
  model: string | null;
  serialNumber?: string | null;
  category?: { name: string };
  status?: { name: string; color: string };
  branch?: { name: string };
};

type Props = {
  asset: Asset;
  sameAssignee: Sibling[];
  sameTag: Sibling[];
  sameSerial: Sibling[];
  canMutate: boolean;
  statuses: { id: string; name: string; color: string }[];
  branches: { id: string; name: string }[];
};

export function AssetDetail({
  asset,
  sameAssignee,
  sameTag,
  sameSerial,
  canMutate,
  statuses,
  branches,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<
    null | "status" | "transfer" | "assign"
  >(null);
  const [statusId, setStatusId] = useState(asset.status.id);
  const [branchId, setBranchId] = useState(asset.branch.id);
  const [assignee, setAssignee] = useState(asset.assignedToText ?? "");
  const [note, setNote] = useState("");

  function runAction() {
    startTransition(async () => {
      let res;
      if (dialog === "status") {
        res = await changeStatusAction({
          assetId: asset.id,
          statusId,
          note,
        });
      } else if (dialog === "transfer") {
        res = await transferAssetAction({
          assetId: asset.id,
          branchId,
          note,
        });
      } else {
        res = await assignAssetAction({
          assetId: asset.id,
          assignedToText: assignee,
          note,
        });
      }
      if (!res?.ok) toast.error(res?.error ?? "Failed");
      else {
        toast.success("Updated");
        setDialog(null);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
              {asset.assetTag ?? "Untitled asset"}
            </h1>
            <StatusBadge name={asset.status.name} color={asset.status.color} />
            {asset.needsReview && (
              <Badge variant="destructive">Needs review</Badge>
            )}
            {asset.deletedAt && <Badge variant="secondary">In recycle bin</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {asset.category.name}
            {asset.brand || asset.model
              ? ` · ${[asset.brand, asset.model].filter(Boolean).join(" ")}`
              : ""}{" "}
            · {asset.branch.name}
            {asset.location ? ` / ${asset.location.name}` : ""}
          </p>
        </div>
        {canMutate && !asset.deletedAt && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/assets/${asset.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog("status")}
            >
              Change status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog("transfer")}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog("assign")}
            >
              <UserRound className="h-3.5 w-3.5" />
              Assign
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!confirm("Move to recycle bin?")) return;
                startTransition(async () => {
                  const res = await deleteAssetAction(asset.id);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Moved to recycle bin");
                    router.push("/assets");
                  }
                });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="recon">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 pt-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Serial</dt>
                <dd className="font-medium">{asset.serialNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd className="font-medium">{asset.assignedToText ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Condition</dt>
                <dd className="font-medium">{asset.condition ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium">{asset.department.name}</dd>
              </div>
            </dl>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Purchase date</dt>
                <dd className="font-medium">
                  {asset.purchaseDate
                    ? formatDate(new Date(asset.purchaseDate))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purchase cost</dt>
                <dd className="font-medium">
                  {asset.purchaseCost
                    ? formatCurrency(Number(asset.purchaseCost.toString()))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Warranty expiry</dt>
                <dd className="font-medium">
                  {asset.warrantyExpiry
                    ? formatDate(new Date(asset.warrantyExpiry))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="font-medium">
                  {formatDateTime(new Date(asset.updatedAt))}
                  {asset.updatedBy ? ` by ${asset.updatedBy.name}` : ""}
                </dd>
              </div>
            </dl>
          </div>

          {asset.remarks && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Remarks
              </h3>
              <p className="whitespace-pre-wrap text-sm">{asset.remarks}</p>
            </div>
          )}

          {asset.reviewReasons.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Review reasons
              </h3>
              <div className="flex flex-wrap gap-1">
                {asset.reviewReasons.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(sameAssignee.length > 0 ||
            sameTag.length > 0 ||
            sameSerial.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {sameAssignee.length > 0 && (
                <RelatedPanel
                  title={`Also assigned to ${asset.assignedToText}`}
                  items={sameAssignee}
                />
              )}
              {sameTag.length > 0 && (
                <RelatedPanel title="Same asset tag" items={sameTag} />
              )}
              {sameSerial.length > 0 && (
                <RelatedPanel title="Same serial number" items={sameSerial} />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          {asset.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-6">
              {asset.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">
                    {event.type.replaceAll("_", " ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(event.createdAt))}
                    {event.user ? ` · ${event.user.name}` : ""}
                  </div>
                  {event.note && (
                    <p className="mt-1 text-sm">{event.note}</p>
                  )}
                  {(event.fromValue != null || event.toValue != null) && (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(
                        { from: event.fromValue, to: event.toValue },
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="attachments" className="pt-4">
          <p className="text-sm text-muted-foreground">
            Attachments arrive in a later phase (optional Vercel Blob).
          </p>
        </TabsContent>

        <TabsContent value="recon" className="pt-4">
          <p className="text-sm text-muted-foreground">
            Reconciliation history will appear here in Phase 5.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "status"
                ? "Change status"
                : dialog === "transfer"
                  ? "Transfer"
                  : "Assign"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {dialog === "status" && (
              <>
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
                <Label>Note</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Required for Faulty, Disposed…"
                />
              </>
            )}
            {dialog === "transfer" && (
              <>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Reason (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </>
            )}
            {dialog === "assign" && (
              <>
                <Label>Assigned to</Label>
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={runAction} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelatedPanel({
  title,
  items,
}: {
  title: string;
  items: Sibling[];
}) {
  return (
    <div className="rounded-md border p-3">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/assets/${item.id}`}
              className="text-primary hover:underline"
            >
              {item.assetTag ?? "No tag"}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              · {[item.brand, item.model].filter(Boolean).join(" ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
