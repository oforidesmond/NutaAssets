"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assetFormSchema, type AssetFormInput } from "@/schemas/asset";
import {
  checkDuplicatesAction,
  createAssetAction,
  getLocationsForBranchAction,
  suggestTagAction,
  updateAssetAction,
} from "@/server/actions/assets";

type Option = { id: string; name: string; code?: string };
type StatusOption = Option & { color: string; isDefault?: boolean };

type Props = {
  mode: "create" | "edit";
  assetId?: string;
  departmentId: string;
  defaults?: Partial<AssetFormInput>;
  categories: Option[];
  branches: Option[];
  statuses: StatusOption[];
  updatedAt?: string;
};

export function AssetForm({
  mode,
  assetId,
  departmentId,
  defaults,
  categories,
  branches,
  statuses,
  updatedAt,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locations, setLocations] = useState<Option[]>([]);
  const [dupWarning, setDupWarning] = useState<{
    reasons: string[];
    tagHits: { id: string; assetTag: string | null }[];
    serialHits: { id: string; serialNumber: string | null }[];
  } | null>(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(
    Boolean(defaults?.purchaseDate || defaults?.purchaseCost),
  );

  const defaultStatus =
    defaults?.statusId ??
    statuses.find((s) => (s as StatusOption & { isDefault?: boolean }).isDefault)
      ?.id ??
    statuses[0]?.id ??
    "";

  const form = useForm<AssetFormInput>({
    // zod v4 + RHF resolver typings are slightly mismatched
    resolver: zodResolver(assetFormSchema) as never,
    defaultValues: {
      departmentId,
      categoryId: defaults?.categoryId ?? "",
      branchId: defaults?.branchId ?? "",
      locationId: defaults?.locationId ?? null,
      assetTag: defaults?.assetTag ?? "",
      serialNumber: defaults?.serialNumber ?? "",
      brand: defaults?.brand ?? "",
      model: defaults?.model ?? "",
      statusId: defaultStatus,
      assignedToText: defaults?.assignedToText ?? "",
      purchaseDate: defaults?.purchaseDate ?? "",
      purchaseCost: defaults?.purchaseCost ?? "",
      warrantyExpiry: defaults?.warrantyExpiry ?? "",
      condition: defaults?.condition ?? null,
      remarks: defaults?.remarks ?? "",
      acknowledgeDuplicates: false,
      updatedAt: updatedAt ?? null,
    },
  });

  const branchId = form.watch("branchId");
  const categoryId = form.watch("categoryId");
  const assetTag = form.watch("assetTag");
  const serialNumber = form.watch("serialNumber");

  useEffect(() => {
    if (!branchId) {
      setLocations([]);
      return;
    }
    void getLocationsForBranchAction(branchId).then((res) => {
      if (res.ok && res.data) setLocations(res.data.items);
    });
  }, [branchId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!assetTag && !serialNumber) {
        setDupWarning(null);
        return;
      }
      void checkDuplicatesAction({
        departmentId,
        assetTag,
        serialNumber,
        excludeId: assetId,
      }).then((res) => {
        if (res.duplicates && res.duplicates.reasons.length > 0) {
          setDupWarning(res.duplicates);
          setAcknowledge(false);
        } else {
          setDupWarning(null);
        }
      });
    }, 400);
    return () => clearTimeout(t);
  }, [assetTag, serialNumber, departmentId, assetId]);

  const retained = useMemo(
    () => ({
      branchId: form.getValues("branchId"),
      locationId: form.getValues("locationId"),
      categoryId: form.getValues("categoryId"),
      statusId: form.getValues("statusId"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending],
  );

  function suggestTag() {
    if (!branchId || !categoryId) {
      toast.error("Pick a category and branch first");
      return;
    }
    startTransition(async () => {
      const res = await suggestTagAction({
        departmentId,
        branchId,
        categoryId,
      });
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not suggest tag");
        return;
      }
      form.setValue("assetTag", res.data.tag);
    });
  }

  function onSubmit(values: AssetFormInput, addAnother = false) {
    if (dupWarning && !acknowledge) {
      toast.error("Acknowledge the duplicate warning to continue");
      return;
    }
    startTransition(async () => {
      const payload = {
        ...values,
        acknowledgeDuplicates: acknowledge || !dupWarning,
        updatedAt,
      };
      const result =
        mode === "edit" && assetId
          ? await updateAssetAction(assetId, payload)
          : await createAssetAction(payload);

      if (!result.ok) {
        if (result.duplicates) {
          setDupWarning(result.duplicates);
          toast.error(result.error);
          return;
        }
        if (result.conflict) {
          toast.error(result.error);
          return;
        }
        toast.error(result.error ?? "Could not save asset");
        return;
      }

      toast.success(mode === "edit" ? "Asset updated" : "Asset created");
      if (addAnother && result.data) {
        form.reset({
          ...form.getValues(),
          assetTag: "",
          serialNumber: "",
          brand: "",
          model: "",
          assignedToText: "",
          remarks: "",
          branchId: retained.branchId,
          locationId: retained.locationId,
          categoryId: retained.categoryId,
          statusId: retained.statusId,
          acknowledgeDuplicates: false,
        });
        setDupWarning(null);
        setAcknowledge(false);
        return;
      }
      router.push(`/assets/${result.data?.id}`);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form
        className="mx-auto max-w-3xl space-y-8"
        onSubmit={form.handleSubmit((v) => onSubmit(v, false))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            // allow normal submit via button
          }
        }}
      >
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Identification</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assetTag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset tag</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={suggestTag}
                      disabled={pending}
                    >
                      Suggest
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Placement</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("locationId", null);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-location</FormLabel>
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assignedToText"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Assigned to</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Person or unit name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Status & condition</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="statusId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Not set</SelectItem>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="GOOD">Good</SelectItem>
                      <SelectItem value="FAIR">Fair</SelectItem>
                      <SelectItem value="POOR">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-3">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setPurchaseOpen((v) => !v)}
          >
            {purchaseOpen ? "Hide" : "Show"} purchase & warranty
          </button>
          {purchaseOpen && (
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase cost (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="warrantyExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warranty expiry</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}
        </section>

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {dupWarning && (
          <div className="rounded-md border border-amber-500/40 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Possible duplicate ({dupWarning.reasons.join(", ")})
            </p>
            <ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-100">
              {dupWarning.tagHits.map((h) => (
                <li key={h.id}>
                  Tag match:{" "}
                  <Link className="underline" href={`/assets/${h.id}`}>
                    {h.assetTag}
                  </Link>
                </li>
              ))}
              {dupWarning.serialHits.map((h) => (
                <li key={h.id}>
                  Serial match:{" "}
                  <Link className="underline" href={`/assets/${h.id}`}>
                    {h.serialNumber}
                  </Link>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
              />
              Save anyway and flag for review
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="submit" disabled={pending}>
            {mode === "edit" ? "Save changes" : "Save asset"}
          </Button>
          {mode === "create" && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={form.handleSubmit((v) => onSubmit(v, true))}
            >
              Save & add another
            </Button>
          )}
          <Button type="button" variant="outline" asChild>
            <Link href={assetId ? `/assets/${assetId}` : "/assets"}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
