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
  departmentSchema,
  fieldDefinitionSchema,
  fieldDefinitionUpdateSchema,
  fieldReorderSchema,
  locationSchema,
  settingsUpdateSchema,
  statusSchema,
  userCreateSchema,
  userResetPasswordSchema,
  userUpdateSchema,
} from "@/schemas/admin";
import { fail, type ActionResult } from "@/server/actions/types";
import {
  createDepartment,
  deactivateDepartment,
  updateDepartment,
} from "@/server/services/admin-departments";
import {
  archiveFieldDefinition,
  createFieldDefinition,
  reorderFieldDefinitions,
  restoreFieldDefinition,
  updateFieldDefinition,
} from "@/server/services/admin-fields";
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
import {
  createUser,
  resetUserPassword,
  updateUser,
} from "@/server/services/admin-users";
import { updateSettings } from "@/server/services/admin-settings";
import { restoreAsset } from "@/server/services/assets";

async function requireSuperAdmin() {
  const user = await requireAdmin();
  if (user.role !== "SUPER_ADMIN") {
    throw new AuthorizationError("Only Super Admins can do that.");
  }
  return user;
}

async function requireManageUsers() {
  const session = await auth();
  authorize(session?.user, "manage_users");
  return session!.user;
}

async function requireManageSettings() {
  const session = await auth();
  authorize(session?.user, "manage_settings");
  return session!.user;
}

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

export async function createFieldAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = fieldDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const field = await createFieldDefinition(parsed.data, user.id);
    revalidatePath("/admin/fields");
    revalidatePath("/assets");
    return { ok: true, data: { id: field.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateFieldAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = fieldDefinitionUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    await updateFieldDefinition(id, parsed.data, user.id);
    revalidatePath("/admin/fields");
    revalidatePath("/assets");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function archiveFieldAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await archiveFieldDefinition(id, user.id);
    revalidatePath("/admin/fields");
    revalidatePath("/assets");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function restoreFieldAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await restoreFieldDefinition(id, user.id);
    revalidatePath("/admin/fields");
    revalidatePath("/assets");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function reorderFieldsAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = fieldReorderSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    await reorderFieldDefinitions(
      parsed.data.departmentId,
      parsed.data.orderedIds,
      user.id,
    );
    revalidatePath("/admin/fields");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function createDepartmentAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = departmentSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    const dept = await createDepartment(parsed.data, user.id);
    revalidatePath("/admin/departments");
    revalidatePath("/");
    return { ok: true, data: { id: dept.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateDepartmentAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireSuperAdmin();
    const parsed = departmentSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    const { cloneFromDepartmentId: _clone, ...rest } = parsed.data;
    void _clone;
    await updateDepartment(id, rest, user.id);
    revalidatePath("/admin/departments");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function deactivateDepartmentAction(
  id: string,
): Promise<ActionResult> {
  try {
    const user = await requireSuperAdmin();
    await deactivateDepartment(id, user.id);
    revalidatePath("/admin/departments");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function createUserAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireManageUsers();
    const parsed = userCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    const created = await createUser(parsed.data, user.id);
    revalidatePath("/admin/users");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return fail(handleError(error));
  }
}

export async function updateUserAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireManageUsers();
    const parsed = userUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await updateUser(id, parsed.data, user.id);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function resetUserPasswordAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireManageUsers();
    const parsed = userResetPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await resetUserPassword(id, parsed.data.password, user.id);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateSettingsAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireManageSettings();
    const parsed = settingsUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message };
    }
    await updateSettings(parsed.data, user.id);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}
