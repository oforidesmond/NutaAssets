import type { FieldType, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { isSafeTypeChange, slugifyFieldKey } from "@/lib/custom-fields";
import { prisma } from "@/lib/db";
import type {
  FieldDefinitionInput,
  FieldDefinitionUpdateInput,
} from "@/schemas/admin";
import { ServiceError } from "@/server/services/admin-org";

async function fieldHasStoredValues(departmentId: string, key: string) {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "Asset"
      WHERE "departmentId" = ${departmentId}
        AND "deletedAt" IS NULL
        AND "customFields" ? ${key}
        AND "customFields" ->> ${key} IS NOT NULL
        AND "customFields" ->> ${key} <> ''
        AND "customFields" ->> ${key} <> 'null'
    ) AS "exists"
  `;
  return rows[0]?.exists ?? false;
}

export async function createFieldDefinition(
  input: FieldDefinitionInput,
  userId: string,
) {
  if (
    (input.type === "SELECT" || input.type === "MULTI_SELECT") &&
    (!input.options || input.options.length === 0)
  ) {
    throw new ServiceError("Add at least one option for select fields.");
  }

  let key = input.key;
  if (!key) {
    let categoryCode: string | null = null;
    if (input.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: input.categoryId, deletedAt: null },
        select: { code: true },
      });
      categoryCode = cat?.code ?? null;
    }
    key = slugifyFieldKey(input.label, categoryCode);
  }

  const field = await prisma.fieldDefinition.create({
    data: {
      departmentId: input.departmentId,
      categoryId: input.categoryId || null,
      key,
      label: input.label,
      type: input.type,
      options: (input.options ?? null) as Prisma.InputJsonValue,
      required: input.required,
      unique: input.unique,
      helpText: input.helpText || null,
      placeholder: input.placeholder || null,
      defaultValue:
        input.defaultValue === undefined
          ? undefined
          : (input.defaultValue as Prisma.InputJsonValue),
      showInList: input.showInList,
      searchable: input.searchable,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });

  await writeAuditLog({
    userId,
    action: "FIELD_CREATE",
    entityType: "FieldDefinition",
    entityId: field.id,
    after: field,
  });
  return field;
}

export async function updateFieldDefinition(
  id: string,
  input: FieldDefinitionUpdateInput,
  userId: string,
) {
  const before = await prisma.fieldDefinition.findUnique({ where: { id } });
  if (!before) throw new ServiceError("Custom field not found.");

  if (before.type !== input.type) {
    const hasData = await fieldHasStoredValues(before.departmentId, before.key);
    if (hasData && !isSafeTypeChange(before.type, input.type as FieldType)) {
      throw new ServiceError(
        `Cannot change type from ${before.type} to ${input.type} — assets already have values for this field. Archive it and create a new field instead.`,
      );
    }
  }

  if (
    (input.type === "SELECT" || input.type === "MULTI_SELECT") &&
    (!input.options || input.options.length === 0)
  ) {
    throw new ServiceError("Add at least one option for select fields.");
  }

  const field = await prisma.fieldDefinition.update({
    where: { id },
    data: {
      categoryId: input.categoryId || null,
      label: input.label,
      type: input.type,
      options: (input.options ?? null) as Prisma.InputJsonValue,
      required: input.required,
      unique: input.unique,
      helpText: input.helpText || null,
      placeholder: input.placeholder || null,
      defaultValue:
        input.defaultValue === undefined
          ? undefined
          : (input.defaultValue as Prisma.InputJsonValue),
      showInList: input.showInList,
      searchable: input.searchable,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });

  await writeAuditLog({
    userId,
    action: "FIELD_UPDATE",
    entityType: "FieldDefinition",
    entityId: id,
    before,
    after: field,
  });
  return field;
}

export async function archiveFieldDefinition(id: string, userId: string) {
  const before = await prisma.fieldDefinition.findUnique({ where: { id } });
  if (!before) throw new ServiceError("Custom field not found.");

  const field = await prisma.fieldDefinition.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    userId,
    action: "FIELD_ARCHIVE",
    entityType: "FieldDefinition",
    entityId: id,
    before,
    after: field,
  });
  return field;
}

export async function restoreFieldDefinition(id: string, userId: string) {
  const before = await prisma.fieldDefinition.findUnique({ where: { id } });
  if (!before) throw new ServiceError("Custom field not found.");

  const field = await prisma.fieldDefinition.update({
    where: { id },
    data: { isActive: true },
  });

  await writeAuditLog({
    userId,
    action: "FIELD_RESTORE",
    entityType: "FieldDefinition",
    entityId: id,
    before,
    after: field,
  });
  return field;
}

export async function reorderFieldDefinitions(
  departmentId: string,
  orderedIds: string[],
  userId: string,
) {
  const existing = await prisma.fieldDefinition.findMany({
    where: { departmentId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((f) => f.id));
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new ServiceError("One or more fields do not belong to this department.");
    }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.fieldDefinition.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  await writeAuditLog({
    userId,
    action: "FIELD_REORDER",
    entityType: "Department",
    entityId: departmentId,
    after: { orderedIds },
  });
}
