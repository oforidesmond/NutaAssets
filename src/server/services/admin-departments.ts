import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { DepartmentInput } from "@/schemas/admin";
import { ServiceError } from "@/server/services/admin-org";

async function cloneDepartmentConfig(
  tx: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
) {
  const [categories, statuses, fields] = await Promise.all([
    tx.category.findMany({
      where: { departmentId: sourceId, deletedAt: null },
    }),
    tx.status.findMany({
      where: { departmentId: sourceId, deletedAt: null },
    }),
    tx.fieldDefinition.findMany({
      where: { departmentId: sourceId },
    }),
  ]);

  const categoryIdMap = new Map<string, string>();

  for (const cat of categories) {
    const created = await tx.category.create({
      data: {
        departmentId: targetId,
        name: cat.name,
        code: cat.code,
        icon: cat.icon,
        parentId: null,
        isActive: cat.isActive,
      },
    });
    categoryIdMap.set(cat.id, created.id);
  }

  // Second pass for parent links
  for (const cat of categories) {
    if (!cat.parentId) continue;
    const newId = categoryIdMap.get(cat.id);
    const newParentId = categoryIdMap.get(cat.parentId);
    if (newId && newParentId) {
      await tx.category.update({
        where: { id: newId },
        data: { parentId: newParentId },
      });
    }
  }

  for (const status of statuses) {
    await tx.status.create({
      data: {
        departmentId: targetId,
        name: status.name,
        color: status.color,
        kind: status.kind,
        isDefault: status.isDefault,
        sortOrder: status.sortOrder,
      },
    });
  }

  for (const field of fields) {
    await tx.fieldDefinition.create({
      data: {
        departmentId: targetId,
        categoryId: field.categoryId
          ? (categoryIdMap.get(field.categoryId) ?? null)
          : null,
        key: field.key,
        label: field.label,
        type: field.type,
        options: field.options as Prisma.InputJsonValue,
        required: field.required,
        unique: field.unique,
        helpText: field.helpText,
        placeholder: field.placeholder,
        defaultValue: field.defaultValue as Prisma.InputJsonValue,
        showInList: field.showInList,
        searchable: field.searchable,
        sortOrder: field.sortOrder,
        isActive: field.isActive,
      },
    });
  }
}

export async function createDepartment(input: DepartmentInput, userId: string) {
  const department = await prisma.$transaction(async (tx) => {
    const created = await tx.department.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description || null,
        isActive: input.isActive,
      },
    });

    if (input.cloneFromDepartmentId) {
      const source = await tx.department.findFirst({
        where: { id: input.cloneFromDepartmentId, deletedAt: null },
      });
      if (!source) {
        throw new ServiceError("Source department to clone from was not found.");
      }
      await cloneDepartmentConfig(tx, source.id, created.id);
    }

    return created;
  });

  await writeAuditLog({
    userId,
    action: "DEPARTMENT_CREATE",
    entityType: "Department",
    entityId: department.id,
    after: {
      ...department,
      clonedFrom: input.cloneFromDepartmentId ?? null,
    },
  });
  return department;
}

export async function updateDepartment(
  id: string,
  input: Omit<DepartmentInput, "cloneFromDepartmentId">,
  userId: string,
) {
  const before = await prisma.department.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Department not found.");

  const department = await prisma.department.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      isActive: input.isActive,
    },
  });

  await writeAuditLog({
    userId,
    action: "DEPARTMENT_UPDATE",
    entityType: "Department",
    entityId: id,
    before,
    after: department,
  });
  return department;
}

export async function deactivateDepartment(id: string, userId: string) {
  const before = await prisma.department.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Department not found.");

  const department = await prisma.department.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    userId,
    action: "DEPARTMENT_DEACTIVATE",
    entityType: "Department",
    entityId: id,
    before,
    after: department,
  });
  return department;
}

export async function listDepartmentsAdmin() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          assets: { where: { deletedAt: null } },
          categories: { where: { deletedAt: null } },
          fieldDefs: true,
          statuses: { where: { deletedAt: null } },
        },
      },
    },
  });
}
