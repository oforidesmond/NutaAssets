import { z } from "zod";

export const conditionSchema = z.enum(["NEW", "GOOD", "FAIR", "POOR"]);

export const assetFormSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  categoryId: z.string().min(1, "Category is required"),
  branchId: z.string().min(1, "Branch is required"),
  locationId: z.string().optional().nullable(),
  assetTag: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  statusId: z.string().min(1, "Status is required"),
  assignedToText: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.union([z.string(), z.number()]).optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  condition: conditionSchema.optional().nullable(),
  remarks: z.string().optional().nullable(),
  acknowledgeDuplicates: z.boolean().optional().default(false),
  updatedAt: z.string().optional().nullable(),
});

export const changeStatusSchema = z.object({
  assetId: z.string().min(1),
  statusId: z.string().min(1),
  note: z.string().optional().nullable(),
});

export const transferSchema = z.object({
  assetId: z.string().min(1),
  branchId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const assignSchema = z.object({
  assetId: z.string().min(1),
  assignedToText: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const bulkActionSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Select at least one asset")
    .max(200, "You can only update 200 assets at a time"),
  action: z.enum([
    "change_status",
    "transfer",
    "assign",
    "set_category",
    "add_remark",
    "soft_delete",
  ]),
  statusId: z.string().optional(),
  branchId: z.string().optional(),
  locationId: z.string().optional().nullable(),
  categoryId: z.string().optional(),
  assignedToText: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const savedViewSchema = z.object({
  name: z.string().trim().min(1, "View name is required").max(80),
  departmentId: z.string().optional().nullable(),
  filters: z.record(z.string(), z.unknown()),
  columns: z.array(z.string()),
  sort: z
    .object({
      id: z.string(),
      desc: z.boolean(),
    })
    .optional()
    .nullable(),
  isDefault: z.boolean().optional().default(false),
});

export type AssetFormInput = z.infer<typeof assetFormSchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type SavedViewInput = z.infer<typeof savedViewSchema>;

export const STATUSES_REQUIRING_NOTE = [
  "Faulty",
  "In Repair",
  "Disposed",
  "Lost",
  "Retired",
] as const;

export const DEFAULT_ASSET_COLUMNS = [
  "assetTag",
  "category",
  "brand",
  "model",
  "serialNumber",
  "status",
  "branch",
  "assignedToText",
] as const;

export const ALL_ASSET_COLUMNS = [
  ...DEFAULT_ASSET_COLUMNS,
  "location",
  "condition",
  "remarks",
  "needsReview",
  "updatedAt",
] as const;
