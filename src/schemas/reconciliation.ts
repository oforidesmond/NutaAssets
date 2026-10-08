import { z } from "zod";

export const RECON_APPLY_CHUNK_SIZE = 200;

export const reconciliationResultSchema = z.enum([
  "FOUND",
  "FOUND_DIFFERENT",
  "MISSING",
  "NEW_UNLISTED",
]);

/** Observed fields for FOUND_DIFFERENT / NEW_UNLISTED (D35). */
export const observedSchema = z.object({
  statusId: z.string().min(1).optional().nullable(),
  locationId: z.string().min(1).optional().nullable(),
  assignedToText: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  assetTag: z.string().optional().nullable(),
});

export const createExerciseSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  name: z.string().trim().min(1, "Name is required").max(160),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  scopeBranchIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one branch"),
  notes: z.string().optional().nullable(),
});

export const verifyItemSchema = z.object({
  itemId: z.string().min(1),
  result: z.enum(["FOUND", "FOUND_DIFFERENT", "MISSING"]),
  observed: observedSchema.optional().nullable(),
  note: z.string().optional().nullable(),
});

export const addUnlistedItemSchema = z.object({
  entryId: z.string().min(1),
  observed: observedSchema.extend({
    categoryId: z.string().min(1, "Category is required"),
    statusId: z.string().min(1, "Status is required"),
  }),
  note: z.string().optional().nullable(),
});

export const submitEntrySchema = z.object({
  entryId: z.string().min(1),
  inventoryDate: z.string().optional().nullable(),
});

export const rejectEntrySchema = z.object({
  entryId: z.string().min(1),
  comment: z.string().trim().min(1, "A comment is required when rejecting"),
});

export const applyEntryChunkSchema = z.object({
  entryId: z.string().min(1),
  /** Item IDs to apply in this chunk (max 200). Omit to apply next pending batch. */
  itemIds: z.array(z.string().min(1)).max(RECON_APPLY_CHUNK_SIZE).optional(),
  /** When true, mark entry APPROVED after this chunk if nothing remains. */
  finalize: z.boolean().optional().default(false),
});

export const markVerifiedSchema = z.object({
  assetId: z.string().min(1),
  note: z.string().optional().nullable(),
});

export type ObservedFields = z.infer<typeof observedSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type VerifyItemInput = z.infer<typeof verifyItemSchema>;
export type AddUnlistedItemInput = z.infer<typeof addUnlistedItemSchema>;
export type ApplyEntryChunkInput = z.infer<typeof applyEntryChunkSchema>;
