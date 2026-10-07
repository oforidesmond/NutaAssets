import { z } from "zod";

export const branchTypeSchema = z.enum([
  "BRANCH",
  "HEAD_OFFICE",
  "DATA_CENTER",
  "OTHER",
]);

export const statusKindSchema = z.enum([
  "IN_USE",
  "NOT_IN_USE",
  "NEEDS_ATTENTION",
  "END_OF_LIFE",
]);

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Branch code is required")
    .max(12)
    .transform((v) => v.toUpperCase()),
  type: branchTypeSchema.default("BRANCH"),
  address: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const locationSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().trim().min(1, "Location name is required").max(120),
});

export const categorySchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().trim().min(1, "Category name is required").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Category code is required")
    .max(12)
    .transform((v) => v.toUpperCase()),
  icon: z.string().trim().max(64).optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const statusSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().trim().min(1, "Status name is required").max(80),
  color: z.string().trim().min(1, "Colour is required").max(40),
  kind: statusKindSchema,
  isDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type StatusInput = z.infer<typeof statusSchema>;
