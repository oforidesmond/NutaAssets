"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import {
  AuthorizationError,
  assertDepartmentAccess,
  authorize,
} from "@/lib/authorize";
import {
  branchSchema,
  categorySchema,
  locationSchema,
  statusSchema,
} from "@/schemas/admin";
import { fail, type ActionResult } from "@/server/actions/types";
import {
  createBranch,
  createCategory,
  createLocation,
  createStatus,
  softDeleteBranch,
  softDeleteCategory,
  softDeleteLocation,
  softDeleteStatus,
  ServiceError,
  updateBranch,
  updateCategory,
  updateLocation,
  updateStatus,
} from "@/server/services/admin-org";
import { restoreAsset } from "@/server/services/assets";

function handleError(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ServiceError) {
    return { ok: false, error: error.message };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return { ok: false, error: "That name or code is already in use." };
  }
  console.error("[admin action]", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function requireAdmin() {
  const session = await auth();
  authorize(session?.user, "admin");
  return session!.user;
}

export async function createBranchAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = branchSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    const branch = await createBranch(parsed.data, user.id);
    revalidatePath("/admin/branches");
    return { ok: true, data: { id: branch.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateBranchAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = branchSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await updateBranch(id, parsed.data, user.id);
    revalidatePath("/admin/branches");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await softDeleteBranch(id, user.id);
    revalidatePath("/admin/branches");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function createLocationAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = locationSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    const location = await createLocation(parsed.data, user.id);
    revalidatePath("/admin/branches");
    return { ok: true, data: { id: location.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateLocationAction(
  id: string,
  name: string,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    if (!name.trim()) return { ok: false, error: "Location name is required." };
    await updateLocation(id, name.trim(), user.id);
    revalidatePath("/admin/branches");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteLocationAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await softDeleteLocation(id, user.id);
    revalidatePath("/admin/branches");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function createCategoryAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const category = await createCategory(parsed.data, user.id);
    revalidatePath("/admin/categories");
    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateCategoryAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    await updateCategory(id, parsed.data, user.id);
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await softDeleteCategory(id, user.id);
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function createStatusAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = statusSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const status = await createStatus(parsed.data, user.id);
    revalidatePath("/admin/statuses");
    return { ok: true, data: { id: status.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateStatusAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = statusSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    await updateStatus(id, parsed.data, user.id);
    revalidatePath("/admin/statuses");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteStatusAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await softDeleteStatus(id, user.id);
    revalidatePath("/admin/statuses");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function restoreAssetAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    authorize(user, "update", "asset");
    await restoreAsset(id, user.id);
    revalidatePath("/admin/recycle-bin");
    revalidatePath("/assets");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}
