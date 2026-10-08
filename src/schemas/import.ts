import { z } from "zod";

export const duplicatePolicySchema = z.enum(["skip", "update", "flag"]);

export const columnMappingSchema = z.record(
  z.string(),
  z.string(),
);

export const importChunkRowSchema = z.object({
  sourceRow: z.number().int().positive(),
  assetTag: z.string().nullable(),
  serialNumber: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  assignedToText: z.string().nullable(),
  remarks: z.string().nullable(),
  categoryId: z.string().min(1),
  statusId: z.string().min(1),
  branchId: z.string().min(1),
  locationId: z.string().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
  reviewReasons: z.array(z.string()).default([]),
  action: z.enum(["create", "update", "skip"]),
  matchAssetId: z.string().nullable(),
});

export const startImportJobSchema = z.object({
  departmentId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mapping: columnMappingSchema,
  totalRows: z.number().int().nonnegative(),
  duplicatePolicy: duplicatePolicySchema,
});

export const importChunkSchema = z.object({
  jobId: z.string().min(1),
  departmentId: z.string().min(1),
  rows: z.array(importChunkRowSchema).max(200),
  isLast: z.boolean().optional(),
});

export const saveMappingTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  mapping: columnMappingSchema,
});

export const dryRunExistingSchema = z.object({
  departmentId: z.string().min(1),
  tags: z.array(z.string()).max(5000),
  serials: z.array(z.string()).max(5000),
});

export type ImportChunkRowInput = z.infer<typeof importChunkRowSchema>;
export type StartImportJobInput = z.infer<typeof startImportJobSchema>;
export type ImportChunkInput = z.infer<typeof importChunkSchema>;
