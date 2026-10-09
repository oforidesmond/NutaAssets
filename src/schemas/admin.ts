import { z } from "zod";

import { normalizeGhanaPhone } from "@/lib/phone";

const ghanaPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((v, ctx) => {
    const normalized = normalizeGhanaPhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Ghana phone (e.g. 024XXXXXXX or 233XXXXXXXXX)",
      });
      return z.NEVER;
    }
    return normalized;
  });

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

export const fieldTypeSchema = z.enum([
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DECIMAL",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "EMAIL",
  "URL",
  "PHONE",
]);

export const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
});

export const fieldDefinitionSchema = z.object({
  departmentId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(64)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Key must start with a letter and use lowercase letters, numbers, underscores",
    ),
  label: z.string().trim().min(1, "Label is required").max(120),
  type: fieldTypeSchema,
  options: z.array(fieldOptionSchema).optional().nullable(),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  helpText: z.string().trim().max(500).optional().nullable(),
  placeholder: z.string().trim().max(120).optional().nullable(),
  defaultValue: z.unknown().optional().nullable(),
  showInList: z.boolean().default(false),
  searchable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

/** Update payload — key is immutable so omitted after create. */
export const fieldDefinitionUpdateSchema = fieldDefinitionSchema
  .omit({ key: true })
  .extend({
    key: z.string().optional(),
  });

export const fieldReorderSchema = z.object({
  departmentId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(12)
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  cloneFromDepartmentId: z.string().optional().nullable(),
});

export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "DEPT_ADMIN",
  "EDITOR",
  "VIEWER",
]);

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: ghanaPhoneSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  role: roleSchema.default("EDITOR"),
  isActive: z.boolean().default(true),
  departmentIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: ghanaPhoneSchema,
  role: roleSchema,
  isActive: z.boolean().default(true),
  departmentIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([]),
});

export const userResetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const settingsUpdateSchema = z.object({
  orgName: z.string().trim().min(1, "Organisation name is required").max(200),
  orgLogoUrl: z.string().trim().max(500).optional().nullable(),
  tagFormat: z
    .string()
    .trim()
    .min(1, "Tag format is required")
    .max(120),
  placeholders: z.string().trim().max(2000),
  attachmentsEnabled: z.boolean().default(false),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>;
export type FieldDefinitionUpdateInput = z.infer<
  typeof fieldDefinitionUpdateSchema
>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
