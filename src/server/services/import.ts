import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseAliasSetting, type AliasMap } from "@/lib/import/aliases";
import type { MappingTemplate } from "@/lib/import/types";
import { matchKey } from "@/lib/normalise";
import type { ImportChunkRowInput } from "@/schemas/import";
import { ServiceError } from "@/server/services/admin-org";

export type ImportContext = {
  departmentId: string;
  departmentName: string;
  categories: { id: string; name: string; code: string }[];
  statuses: { id: string; name: string; color: string; isDefault: boolean }[];
  branches: { id: string; name: string; code: string }[];
  locations: { id: string; name: string; branchId: string }[];
  fieldDefs: {
    id: string;
    key: string;
    label: string;
    type: string;
    categoryId: string | null;
  }[];
  categoryAliases: AliasMap;
  statusAliases: AliasMap;
  mappingTemplates: MappingTemplate[];
  defaultStatusId: string | null;
};

export async function getImportContext(
  departmentId: string,
): Promise<ImportContext> {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null, isActive: true },
  });
  if (!department) throw new ServiceError("Department not found.");

  const [categories, statuses, branches, locations, fieldDefs, settings] =
    await Promise.all([
      prisma.category.findMany({
        where: { departmentId, deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.status.findMany({
        where: { departmentId, deletedAt: null },
        select: { id: true, name: true, color: true, isDefault: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.branch.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.location.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, branchId: true },
        orderBy: { name: "asc" },
      }),
      prisma.fieldDefinition.findMany({
        where: { departmentId, isActive: true },
        select: {
          id: true,
          key: true,
          label: true,
          type: true,
          categoryId: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.setting.findMany({
        where: {
          key: {
            in: ["category_aliases", "status_aliases", "import_mappings"],
          },
        },
      }),
    ]);

  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const templatesRaw = settingMap.import_mappings;
  const mappingTemplates: MappingTemplate[] = Array.isArray(templatesRaw)
    ? (templatesRaw as MappingTemplate[])
    : [];

  return {
    departmentId: department.id,
    departmentName: department.name,
    categories,
    statuses,
    branches,
    locations,
    fieldDefs,
    categoryAliases: parseAliasSetting(settingMap.category_aliases),
    statusAliases: parseAliasSetting(settingMap.status_aliases),
    mappingTemplates,
    defaultStatusId: statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? null,
  };
}

export async function findExistingAssetsForImport(
  departmentId: string,
  tags: string[],
  serials: string[],
) {
  const tagKeys = tags.map((t) => matchKey(t)).filter(Boolean) as string[];
  const serialKeys = serials
    .map((s) => matchKey(s))
    .filter(Boolean) as string[];

  if (tagKeys.length === 0 && serialKeys.length === 0) return [];

  const or: Prisma.AssetWhereInput[] = [];
  if (tagKeys.length > 0) {
    or.push({
      OR: tagKeys.map((t) => ({
        assetTag: { equals: t, mode: "insensitive" as const },
      })),
    });
  }
  if (serialKeys.length > 0) {
    or.push({
      OR: serialKeys.map((s) => ({
        serialNumber: { equals: s, mode: "insensitive" as const },
      })),
    });
  }

  return prisma.asset.findMany({
    where: {
      departmentId,
      deletedAt: null,
      OR: or,
    },
    select: { id: true, assetTag: true, serialNumber: true },
    take: 5000,
  });
}

export async function startImportJob(input: {
  userId: string;
  departmentId: string;
  fileName: string;
  mapping: Record<string, string>;
  totalRows: number;
}) {
  return prisma.importJob.create({
    data: {
      userId: input.userId,
      departmentId: input.departmentId,
      fileName: input.fileName,
      mapping: input.mapping as Prisma.InputJsonValue,
      totalRows: input.totalRows,
      status: "PENDING",
    },
  });
}

export async function processImportChunk(input: {
  jobId: string;
  departmentId: string;
  userId: string;
  rows: ImportChunkRowInput[];
  isLast?: boolean;
}) {
  const job = await prisma.importJob.findFirst({
    where: { id: input.jobId },
  });
  if (!job) throw new ServiceError("Import job not found.");
  if (job.status === "UNDONE") {
    throw new ServiceError("This import was undone and cannot continue.");
  }
  if (job.userId !== input.userId) {
    throw new ServiceError("You can only continue your own import jobs.");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let flagged = 0;
  const errors: { sourceRow: number; message: string }[] = [];

  for (const row of input.rows) {
    if (row.action === "skip") {
      skipped += 1;
      continue;
    }

    try {
      if (row.action === "update" && row.matchAssetId) {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.asset.findFirst({
            where: { id: row.matchAssetId!, deletedAt: null },
          });
          if (!existing) {
            throw new Error("Matched asset no longer exists");
          }
          const reviewReasons = Array.from(
            new Set([...(existing.reviewReasons ?? []), ...row.reviewReasons]),
          );
          const updatedAsset = await tx.asset.update({
            where: { id: existing.id },
            data: {
              categoryId: row.categoryId,
              branchId: row.branchId,
              locationId: row.locationId,
              statusId: row.statusId,
              assetTag: row.assetTag,
              serialNumber: row.serialNumber,
              brand: row.brand,
              model: row.model,
              assignedToText: row.assignedToText,
              remarks: row.remarks,
              customFields: row.customFields as Prisma.InputJsonValue,
              needsReview: reviewReasons.length > 0,
              reviewReasons,
              importJobId: input.jobId,
              updatedById: input.userId,
            },
          });
          await tx.assetEvent.create({
            data: {
              assetId: updatedAsset.id,
              type: "UPDATED",
              note: `Updated via import ${input.jobId}`,
              toValue: {
                assetTag: updatedAsset.assetTag,
                serialNumber: updatedAsset.serialNumber,
              },
              userId: input.userId,
            },
          });
        });
        updated += 1;
        if (row.reviewReasons.length > 0) flagged += 1;
      } else {
        await prisma.$transaction(async (tx) => {
          const createdAsset = await tx.asset.create({
            data: {
              departmentId: input.departmentId,
              categoryId: row.categoryId,
              branchId: row.branchId,
              locationId: row.locationId,
              statusId: row.statusId,
              assetTag: row.assetTag,
              serialNumber: row.serialNumber,
              brand: row.brand,
              model: row.model,
              assignedToText: row.assignedToText,
              remarks: row.remarks,
              customFields: row.customFields as Prisma.InputJsonValue,
              needsReview: row.reviewReasons.length > 0,
              reviewReasons: row.reviewReasons,
              importJobId: input.jobId,
              createdById: input.userId,
              updatedById: input.userId,
            },
          });
          await tx.assetEvent.create({
            data: {
              assetId: createdAsset.id,
              type: "CREATED",
              note: `Created via import ${input.jobId}`,
              toValue: {
                assetTag: createdAsset.assetTag,
                serialNumber: createdAsset.serialNumber,
              },
              userId: input.userId,
            },
          });
        });
        created += 1;
        if (row.reviewReasons.length > 0) flagged += 1;
      }
    } catch (error) {
      errors.push({
        sourceRow: row.sourceRow,
        message:
          error instanceof Error ? error.message : "Failed to import row",
      });
    }
  }

  const existingErrors = Array.isArray(job.errors)
    ? (job.errors as { sourceRow: number; message: string }[])
    : [];

  const next = await prisma.importJob.update({
    where: { id: input.jobId },
    data: {
      created: { increment: created },
      updated: { increment: updated },
      skipped: { increment: skipped },
      flagged: { increment: flagged },
      errors: [...existingErrors, ...errors] as Prisma.InputJsonValue,
      status: input.isLast ? "COMPLETED" : "PENDING",
    },
  });

  if (input.isLast) {
    await writeAuditLog({
      userId: input.userId,
      action: "IMPORT_COMPLETE",
      entityType: "ImportJob",
      entityId: job.id,
      after: {
        created: next.created,
        updated: next.updated,
        skipped: next.skipped,
        flagged: next.flagged,
        fileName: job.fileName,
      },
    });
  }

  return {
    created,
    updated,
    skipped,
    flagged,
    errors,
    job: next,
  };
}

export async function undoImportJob(jobId: string, userId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId } });
  if (!job) throw new ServiceError("Import job not found.");
  if (job.status === "UNDONE") {
    throw new ServiceError("This import was already undone.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const assets = await tx.asset.findMany({
      where: { importJobId: jobId, deletedAt: null },
      select: { id: true },
    });
    const now = new Date();
    if (assets.length > 0) {
      await tx.asset.updateMany({
        where: { importJobId: jobId, deletedAt: null },
        data: { deletedAt: now, updatedById: userId },
      });
      for (const asset of assets) {
        await tx.assetEvent.create({
          data: {
            assetId: asset.id,
            type: "DELETED",
            note: `Soft-deleted by undo import ${jobId}`,
            userId,
          },
        });
      }
    }
    const updated = await tx.importJob.update({
      where: { id: jobId },
      data: { status: "UNDONE" },
    });
    return { count: assets.length, job: updated };
  });

  await writeAuditLog({
    userId,
    action: "IMPORT_UNDO",
    entityType: "ImportJob",
    entityId: jobId,
    after: { softDeleted: result.count },
  });

  return result;
}

export async function listRecentImportJobs(userId: string, take = 10) {
  return prisma.importJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      fileName: true,
      totalRows: true,
      created: true,
      updated: true,
      skipped: true,
      flagged: true,
      status: true,
      createdAt: true,
      departmentId: true,
    },
  });
}

export async function saveMappingTemplate(input: {
  name: string;
  mapping: Record<string, string>;
}) {
  const existing = await prisma.setting.findUnique({
    where: { key: "import_mappings" },
  });
  const list: MappingTemplate[] = Array.isArray(existing?.value)
    ? (existing!.value as MappingTemplate[])
    : [];
  const template: MappingTemplate = {
    id: `map_${Date.now()}`,
    name: input.name,
    mapping: input.mapping as MappingTemplate["mapping"],
    createdAt: new Date().toISOString(),
  };
  const next = [...list.filter((t) => t.name !== input.name), template].slice(
    -20,
  );
  await prisma.setting.upsert({
    where: { key: "import_mappings" },
    create: {
      key: "import_mappings",
      value: next as unknown as Prisma.InputJsonValue,
    },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });
  return template;
}
