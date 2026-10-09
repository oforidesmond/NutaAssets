"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  AuthorizationError,
  assertBranchAccess,
  assertDepartmentAccess,
  authorize,
} from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  assetFormSchema,
  assignSchema,
  bulkActionSchema,
  changeStatusSchema,
  savedViewSchema,
  transferSchema,
} from "@/schemas/asset";
import { fail, type ActionResult } from "@/server/actions/types";
import { ServiceError } from "@/server/services/admin-org";
import {
  assignAsset,
  bulkUpdateAssets,
  changeAssetStatus,
  checkAssetDuplicates,
  createAsset,
  duplicateAsset,
  listAssigneeSuggestions,
  listBrandSuggestions,
  listModelSuggestions,
  softDeleteAsset,
  suggestTagForAsset,
  transferAsset,
  updateAsset,
} from "@/server/services/assets";

function handleAssetError<T = undefined>(error: unknown): ActionResult<T> {
  if (error instanceof AuthorizationError) {
    return fail<T>({ ok: false, error: error.message });
  }
  if (error instanceof ServiceError) {
    const withDup = error as ServiceError & {
      duplicates?: ActionResult["duplicates"];
      conflict?: boolean;
    };
    return fail<T>({
      ok: false,
      error: error.message,
      conflict: withDup.conflict,
      duplicates: withDup.duplicates
        ? {
            reasons: withDup.duplicates.reasons,
            tagHits: withDup.duplicates.tagHits,
            serialHits: withDup.duplicates.serialHits,
          }
        : undefined,
    });
  }
  console.error("[asset action]", error);
  return fail<T>({
    ok: false,
    error: "Something went wrong. Please try again.",
  });
}

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new AuthorizationError("You must be signed in.");
  return session.user;
}

export async function createAssetAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "create", "asset");
    const parsed = assetFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    assertBranchAccess(user, parsed.data.branchId);
    const asset = await createAsset(parsed.data, user.id);
    revalidatePath("/assets");
    return { ok: true, data: { id: asset.id } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function updateAssetAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = assetFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    assertBranchAccess(user, parsed.data.branchId);
    const asset = await updateAsset(id, parsed.data, user.id);
    revalidatePath("/assets");
    revalidatePath(`/assets/${id}`);
    return { ok: true, data: { id: asset.id } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "delete", "asset");
    await softDeleteAsset(id, user.id);
    revalidatePath("/assets");
    revalidatePath("/admin/recycle-bin");
    return { ok: true };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function changeStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = changeStatusSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await changeAssetStatus({ ...parsed.data, userId: user.id });
    revalidatePath("/assets");
    revalidatePath(`/assets/${parsed.data.assetId}`);
    return { ok: true };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function transferAssetAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = transferSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertBranchAccess(user, parsed.data.branchId);
    await transferAsset({ ...parsed.data, userId: user.id });
    revalidatePath("/assets");
    revalidatePath(`/assets/${parsed.data.assetId}`);
    return { ok: true };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function assignAssetAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = assignSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await assignAsset({ ...parsed.data, userId: user.id });
    revalidatePath("/assets");
    revalidatePath(`/assets/${parsed.data.assetId}`);
    return { ok: true };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function duplicateAssetAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "create", "asset");
    const asset = await duplicateAsset(id, user.id);
    revalidatePath("/assets");
    return { ok: true, data: { id: asset.id } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function bulkAssetsAction(
  raw: unknown,
): Promise<ActionResult<{ processed: number }>> {
  try {
    const user = await requireUser();
    const parsed = bulkActionSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    if (parsed.data.action === "soft_delete") {
      authorize(user, "delete", "asset");
    } else {
      authorize(user, "update", "asset");
    }
    if (parsed.data.branchId) assertBranchAccess(user, parsed.data.branchId);
    const result = await bulkUpdateAssets(parsed.data, user.id);
    revalidatePath("/assets");
    revalidatePath("/admin/recycle-bin");
    return { ok: true, data: result };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function checkDuplicatesAction(input: {
  departmentId: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  excludeId?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    assertDepartmentAccess(user, input.departmentId);
    const result = await checkAssetDuplicates(input);
    return {
      ok: true,
      duplicates: {
        reasons: result.reasons,
        tagHits: result.tagHits,
        serialHits: result.serialHits,
      },
    };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function suggestTagAction(input: {
  departmentId: string;
  branchId: string;
  categoryId: string;
}): Promise<ActionResult<{ tag: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "create", "asset");
    const tag = await suggestTagForAsset(input);
    return { ok: true, data: { tag } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function brandSuggestionsAction(
  departmentId: string,
  q: string,
): Promise<ActionResult<{ items: string[] }>> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const items = await listBrandSuggestions(departmentId, q);
    return { ok: true, data: { items } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function modelSuggestionsAction(
  departmentId: string,
  q: string,
): Promise<ActionResult<{ items: string[] }>> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const items = await listModelSuggestions(departmentId, q);
    return { ok: true, data: { items } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function assigneeSuggestionsAction(
  q: string,
): Promise<ActionResult<{ items: string[] }>> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const items = await listAssigneeSuggestions(q);
    return { ok: true, data: { items } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function saveViewAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const parsed = savedViewSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    if (parsed.data.isDefault) {
      await prisma.savedView.updateMany({
        where: {
          userId: user.id,
          departmentId: parsed.data.departmentId ?? null,
        },
        data: { isDefault: false },
      });
    }
    const view = await prisma.savedView.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        departmentId: parsed.data.departmentId ?? null,
        filters: parsed.data.filters as object,
        columns: parsed.data.columns,
        sort: parsed.data.sort ?? undefined,
        isDefault: parsed.data.isDefault ?? false,
      },
    });
    await writeAuditLog({
      userId: user.id,
      action: "SAVED_VIEW_CREATE",
      entityType: "SavedView",
      entityId: view.id,
      after: view,
    });
    revalidatePath("/assets");
    return { ok: true, data: { id: view.id } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function deleteViewAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const view = await prisma.savedView.findFirst({
      where: { id, userId: user.id },
    });
    if (!view) return { ok: false, error: "View not found." };
    await prisma.savedView.delete({ where: { id } });
    revalidatePath("/assets");
    return { ok: true };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function getLocationsForBranchAction(
  branchId: string,
): Promise<ActionResult<{ items: { id: string; name: string }[] }>> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const items = await prisma.location.findMany({
      where: { branchId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { ok: true, data: { items } };
  } catch (error) {
    return handleAssetError(error);
  }
}

export async function exportAssetsAction(input: {
  filters: Record<string, string>;
  columns: string[];
  ids?: string[];
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetTag: string | null;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      assignedToText: string | null;
      condition: string | null;
      remarks: string | null;
      needsReview: boolean;
      updatedAt: string;
      customFields: unknown;
      category: { name: string };
      branch: { name: string };
      location: { name: string } | null;
      status: { name: string; color?: string };
    }[];
    columns: string[];
    fieldDefs: {
      key: string;
      label: string;
      type: import("@prisma/client").FieldType;
      options: unknown;
    }[];
  }>
> {
  try {
    const user = await requireUser();
    authorize(user, "export", "export");

    const { listAssets, parseAssetListParams } = await import(
      "@/server/queries/assets"
    );

    if (input.ids && input.ids.length > 0) {
      const assets = await prisma.asset.findMany({
        where: { id: { in: input.ids }, deletedAt: null },
        take: 2000,
        include: {
          category: { select: { name: true } },
          branch: { select: { name: true } },
          location: { select: { name: true } },
          status: { select: { name: true, color: true } },
        },
      });
      const deptIds = [...new Set(assets.map((a) => a.departmentId))];
      const fieldDefs = await prisma.fieldDefinition.findMany({
        where: { departmentId: { in: deptIds }, isActive: true },
        select: {
          key: true,
          label: true,
          type: true,
          options: true,
        },
      });
      return {
        ok: true,
        data: {
          rows: assets.map((a) => ({
            id: a.id,
            assetTag: a.assetTag,
            serialNumber: a.serialNumber,
            brand: a.brand,
            model: a.model,
            assignedToText: a.assignedToText,
            condition: a.condition,
            remarks: a.remarks,
            needsReview: a.needsReview,
            updatedAt: a.updatedAt.toISOString(),
            customFields: a.customFields,
            category: a.category,
            branch: a.branch,
            location: a.location,
            status: a.status,
          })),
          columns: input.columns,
          fieldDefs,
        },
      };
    }

    const params = parseAssetListParams({
      ...input.filters,
      page: "1",
      pageSize: "2000",
      columns: input.columns.join(","),
    });
    const list = await listAssets(user, params);
    return {
      ok: true,
      data: {
        rows: list.rows.map((a) => ({
          id: a.id,
          assetTag: a.assetTag,
          serialNumber: a.serialNumber,
          brand: a.brand,
          model: a.model,
          assignedToText: a.assignedToText,
          condition: a.condition,
          remarks: a.remarks,
          needsReview: a.needsReview,
          updatedAt: a.updatedAt.toISOString(),
          customFields: a.customFields,
          category: { name: a.category.name },
          branch: { name: a.branch.name },
          location: a.location ? { name: a.location.name } : null,
          status: { name: a.status.name, color: a.status.color },
        })),
        columns: input.columns,
        fieldDefs: list.fieldDefs,
      },
    };
  } catch (error) {
    return handleAssetError(error);
  }
}
