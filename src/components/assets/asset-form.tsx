"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";

import { ScanDialog } from "@/components/assets/scan-dialog";
import { DynamicField } from "@/components/forms/dynamic-field";
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
import { useFormDraft } from "@/hooks/use-form-draft";
import {
  applyCustomFieldDefaults,
} from "@/lib/dynamic-schema";
import { fieldsForCategory, readCustomFieldsJson } from "@/lib/custom-fields";
import { hasText } from "@/lib/form-draft";
import { assetFormSchema, type AssetFormInput } from "@/schemas/asset";
import {
  checkDuplicatesAction,
  createAssetAction,
  getLocationsForBranchAction,
  suggestTagAction,
  updateAssetAction,
} from "@/server/actions/assets";
import type { FieldType } from "@prisma/client";

type AssetDraftValues = Omit<
  AssetFormInput,
  "acknowledgeDuplicates" | "updatedAt"
> & {
  purchaseOpen?: boolean;
};

function isAssetDraftEmpty(values: AssetDraftValues): boolean {
  if (
    [
      values.assetTag,
      values.serialNumber,
      values.brand,
      values.model,
      values.assignedToText,
      values.remarks,
      values.purchaseDate,
      values.purchaseCost,
      values.warrantyExpiry,
      values.categoryId,
      values.branchId,
      values.locationId,
    ].some(hasText)
  ) {
    return false;
  }
  if (values.condition) return false;
  const cf = values.customFields ?? {};
  return !Object.values(cf).some(hasText);
}

type Option = { id: string; name: string; code?: string };
type StatusOption = Option & { color: string; isDefault?: boolean };

export type AssetFormFieldDef = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  required: boolean;
  helpText: string | null;
  placeholder: string | null;
  defaultValue: unknown;
  categoryId: string | null;
  isActive: boolean;
};

type Props = {
  mode: "create" | "edit";
  assetId?: string;
  departmentId: string;
  defaults?: Partial<AssetFormInput>;
  categories: Option[];
  branches: Option[];
  statuses: StatusOption[];
  fieldDefs?: AssetFormFieldDef[];
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
  fieldDefs = [],
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
  const [scanTarget, setScanTarget] = useState<"assetTag" | "serialNumber" | null>(
    null,
  );
  const [purchaseOpen, setPurchaseOpen] = useState(
    Boolean(defaults?.purchaseDate || defaults?.purchaseCost),
  );

  const defaultStatus =
    defaults?.statusId ??
    statuses.find((s) => (s as StatusOption & { isDefault?: boolean }).isDefault)
      ?.id ??
    statuses[0]?.id ??
    "";

  const initialCustom = applyCustomFieldDefaults(
    fieldDefs,
    defaults?.categoryId ?? null,
    readCustomFieldsJson(defaults?.customFields),
  );

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
      customFields: initialCustom,
      acknowledgeDuplicates: false,
      updatedAt: updatedAt ?? null,
    },
  });

  const branchId = form.watch("branchId");
  const categoryId = form.watch("categoryId");
  const assetTag = form.watch("assetTag");
  const serialNumber = form.watch("serialNumber");
  const customFields = form.watch("customFields") ?? {};

  const draftKey =
    mode === "edit" && assetId
      ? `asset:edit:${assetId}`
      : `asset:create:${departmentId}`;

  const [draftValues, setDraftValues] = useState<AssetDraftValues>(() => {
    const v = form.getValues();
    const { acknowledgeDuplicates: _a, updatedAt: _u, ...rest } = v;
    void _a;
    void _u;
    return { ...rest, purchaseOpen };
  });

  const editBaseline = useMemo(() => {
    if (mode !== "edit") return null;
    return JSON.stringify({
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
      customFields: initialCustom,
    });
  }, [mode, defaults, defaultStatus, initialCustom]);

  const restoreAssetDraft = useCallback(
    (draft: AssetDraftValues) => {
      const categoryOk = categories.some((c) => c.id === draft.categoryId);
      const branchOk = branches.some((b) => b.id === draft.branchId);
      const statusOk = statuses.some((s) => s.id === draft.statusId);
      const nextCategoryId = categoryOk ? draft.categoryId : "";
      const nextBranchId = branchOk ? draft.branchId : "";
      const nextStatusId = statusOk ? draft.statusId : defaultStatus;
      const nextLocationId = branchOk ? (draft.locationId ?? null) : null;
      const { purchaseOpen: draftPurchaseOpen, ...draftFields } = draft;

      form.reset({
        departmentId,
        categoryId: nextCategoryId,
        branchId: nextBranchId,
        locationId: nextLocationId,
        assetTag: draftFields.assetTag ?? "",
        serialNumber: draftFields.serialNumber ?? "",
        brand: draftFields.brand ?? "",
        model: draftFields.model ?? "",
        statusId: nextStatusId,
        assignedToText: draftFields.assignedToText ?? "",
        purchaseDate: draftFields.purchaseDate ?? "",
        purchaseCost: draftFields.purchaseCost ?? "",
        warrantyExpiry: draftFields.warrantyExpiry ?? "",
        condition: draftFields.condition ?? null,
        remarks: draftFields.remarks ?? "",
        customFields: draft.customFields ?? {},
        acknowledgeDuplicates: false,
        updatedAt: updatedAt ?? null,
      });
      setDraftValues({
        ...draftFields,
        departmentId,
        categoryId: nextCategoryId,
        branchId: nextBranchId,
        locationId: nextLocationId,
        statusId: nextStatusId,
        purchaseOpen:
          draftPurchaseOpen != null
            ? Boolean(draftPurchaseOpen)
            : Boolean(draft.purchaseDate || draft.purchaseCost),
      });
      if (draftPurchaseOpen != null) {
        setPurchaseOpen(Boolean(draftPurchaseOpen));
      } else if (draft.purchaseDate || draft.purchaseCost) {
        setPurchaseOpen(true);
      }
    },
    [branches, categories, defaultStatus, departmentId, form, statuses, updatedAt],
  );

  const isDraftEmpty = useCallback(
    (v: AssetDraftValues) => {
      if (isAssetDraftEmpty(v)) return true;
      if (!editBaseline) return false;
      const { purchaseOpen: _po, departmentId: _d, ...comparable } = v;
      void _po;
      void _d;
      return JSON.stringify(comparable) === editBaseline;
    },
    [editBaseline],
  );

  const { clearDraft } = useFormDraft({
    draftKey,
    values: draftValues,
    isEmpty: isDraftEmpty,
    onRestore: restoreAssetDraft,
  });

  // Push form changes into draft state only when content actually changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      const {
        acknowledgeDuplicates: _a,
        updatedAt: _u,
        ...rest
      } = value as AssetFormInput;
      void _a;
      void _u;
      const next: AssetDraftValues = {
        departmentId: rest.departmentId ?? departmentId,
        categoryId: rest.categoryId ?? "",
        branchId: rest.branchId ?? "",
        locationId: rest.locationId ?? null,
        assetTag: rest.assetTag ?? "",
        serialNumber: rest.serialNumber ?? "",
        brand: rest.brand ?? "",
        model: rest.model ?? "",
        statusId: rest.statusId ?? "",
        assignedToText: rest.assignedToText ?? "",
        purchaseDate: rest.purchaseDate ?? "",
        purchaseCost: rest.purchaseCost ?? "",
        warrantyExpiry: rest.warrantyExpiry ?? "",
        condition: rest.condition ?? null,
        remarks: rest.remarks ?? "",
        customFields: rest.customFields ?? {},
        purchaseOpen,
      };
      setDraftValues((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    });
    return () => subscription.unsubscribe();
  }, [form, departmentId, purchaseOpen]);

  useEffect(() => {
    setDraftValues((prev) =>
      prev.purchaseOpen === purchaseOpen ? prev : { ...prev, purchaseOpen },
    );
  }, [purchaseOpen]);

  const scopedFields = useMemo(
    () => fieldsForCategory(fieldDefs, categoryId || null),
    [fieldDefs, categoryId],
  );

  useEffect(() => {
    const next = applyCustomFieldDefaults(
      fieldDefs,
      categoryId || null,
      readCustomFieldsJson(form.getValues("customFields")),
    );
    // Drop values for fields that no longer apply to this category
    const allowed = new Set(scopedFields.map((f) => f.key));
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      if (allowed.has(k)) cleaned[k] = v;
    }
    const current = form.getValues("customFields") ?? {};
    if (JSON.stringify(current) !== JSON.stringify(cleaned)) {
      form.setValue("customFields", cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  useEffect(() => {
    if (!branchId) {
      setLocations((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    void getLocationsForBranchAction(branchId).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setLocations(res.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    const locId = form.getValues("locationId");
    if (!locId || locations.length === 0) return;
    if (!locations.some((l) => l.id === locId)) {
      form.setValue("locationId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

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
      clearDraft();
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
                  <div className="flex flex-wrap gap-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setScanTarget("assetTag")}
                    >
                      Scan
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
                  <div className="flex flex-wrap gap-2">
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setScanTarget("serialNumber")}
                    >
                      Scan
                    </Button>
                  </div>
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

        {scopedFields.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Custom fields</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {scopedFields.map((def) => (
                <DynamicField
                  key={def.key}
                  field={def}
                  mode="form"
                  value={customFields[def.key]}
                  onChange={(v) =>
                    form.setValue(
                      "customFields",
                      { ...form.getValues("customFields"), [def.key]: v },
                      { shouldDirty: true },
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}

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
      <ScanDialog
        open={scanTarget != null}
        onOpenChange={(open) => {
          if (!open) setScanTarget(null);
        }}
        title={
          scanTarget === "serialNumber"
            ? "Scan serial number"
            : "Scan asset tag"
        }
        onScan={(value) => {
          if (scanTarget) {
            form.setValue(scanTarget, value, { shouldDirty: true });
          }
          setScanTarget(null);
        }}
      />
    </Form>
  );
}
