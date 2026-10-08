"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  AuthorizationError,
  assertBranchAccess,
  assertDepartmentAccess,
  authorize,
} from "@/lib/authorize";
import {
  addUnlistedItemSchema,
  applyEntryChunkSchema,
  createExerciseSchema,
  markVerifiedSchema,
  rejectEntrySchema,
  submitEntrySchema,
  verifyItemSchema,
} from "@/schemas/reconciliation";
import { fail, type ActionResult } from "@/server/actions/types";
import { ServiceError } from "@/server/services/admin-org";
import {
  addUnlistedItem,
  applyEntryChunk,
  cancelExercise,
  completeExercise,
  createExercise,
  markAssetVerifiedToday,
  previewEntryDiff,
  rejectEntry,
  removeUnlistedItem,
  startExercise,
  submitEntry,
  verifyItem,
  type EntryDiffPreview,
} from "@/server/services/reconciliation";
import { prisma } from "@/lib/db";
import {
  buildLegacyExportRows,
  getReconFormOptions,
} from "@/server/queries/reconciliation";

function handleReconError<T = undefined>(error: unknown): ActionResult<T> {
  if (error instanceof AuthorizationError) {
    return fail<T>({ ok: false, error: error.message });
  }
  if (error instanceof ServiceError) {
    return fail<T>({ ok: false, error: error.message });
  }
  console.error("[reconciliation action]", error);
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

function revalidateRecon(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

export async function createExerciseAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const parsed = createExerciseSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid exercise details.",
      });
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    for (const branchId of parsed.data.scopeBranchIds) {
      assertBranchAccess(user, branchId);
    }
    const exercise = await createExercise(parsed.data, user.id);
    revalidateRecon(["/reconciliation"]);
    return { ok: true, data: { id: exercise.id } };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function startExerciseAction(
  exerciseId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const exercise = await prisma.reconciliationExercise.findFirst({
      where: { id: exerciseId, deletedAt: null },
    });
    if (!exercise) return fail({ ok: false, error: "Exercise not found." });
    assertDepartmentAccess(user, exercise.departmentId);
    await startExercise(exerciseId, user.id);
    revalidateRecon([
      "/reconciliation",
      `/reconciliation/${exerciseId}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function cancelExerciseAction(
  exerciseId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "approve", "reconciliation");
    const exercise = await prisma.reconciliationExercise.findFirst({
      where: { id: exerciseId, deletedAt: null },
    });
    if (!exercise) return fail({ ok: false, error: "Exercise not found." });
    assertDepartmentAccess(user, exercise.departmentId);
    await cancelExercise(exerciseId, user.id);
    revalidateRecon([
      "/reconciliation",
      `/reconciliation/${exerciseId}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function completeExerciseAction(
  exerciseId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "approve", "reconciliation");
    const exercise = await prisma.reconciliationExercise.findFirst({
      where: { id: exerciseId, deletedAt: null },
    });
    if (!exercise) return fail({ ok: false, error: "Exercise not found." });
    assertDepartmentAccess(user, exercise.departmentId);
    await completeExercise(exerciseId, user.id);
    revalidateRecon([
      "/reconciliation",
      `/reconciliation/${exerciseId}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function verifyItemAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const parsed = verifyItemSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid verification.",
      });
    }
    const item = await prisma.reconciliationItem.findUnique({
      where: { id: parsed.data.itemId },
      include: {
        entry: { include: { exercise: true } },
      },
    });
    if (!item) return fail({ ok: false, error: "Item not found." });
    assertDepartmentAccess(user, item.entry.exercise.departmentId);
    assertBranchAccess(user, item.entry.branchId);
    await verifyItem(parsed.data, user.id);
    revalidateRecon([
      `/reconciliation/${item.entry.exerciseId}`,
      `/reconciliation/${item.entry.exerciseId}/${item.entryId}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function addUnlistedItemAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const parsed = addUnlistedItemSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid unlisted asset.",
      });
    }
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    assertBranchAccess(user, entry.branchId);
    const item = await addUnlistedItem(parsed.data, user.id);
    revalidateRecon([
      `/reconciliation/${entry.exerciseId}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}`,
    ]);
    return { ok: true, data: { id: item.id } };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function removeUnlistedItemAction(
  itemId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const item = await prisma.reconciliationItem.findUnique({
      where: { id: itemId },
      include: { entry: { include: { exercise: true } } },
    });
    if (!item) return fail({ ok: false, error: "Item not found." });
    assertDepartmentAccess(user, item.entry.exercise.departmentId);
    assertBranchAccess(user, item.entry.branchId);
    await removeUnlistedItem(itemId, user.id);
    revalidateRecon([
      `/reconciliation/${item.entry.exerciseId}/${item.entryId}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function submitEntryAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    const parsed = submitEntrySchema.safeParse(raw);
    if (!parsed.success) {
      return fail({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid submit request.",
      });
    }
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    assertBranchAccess(user, entry.branchId);
    await submitEntry(parsed.data.entryId, user.id, parsed.data.inventoryDate);
    revalidateRecon([
      `/reconciliation/${entry.exerciseId}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function rejectEntryAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "approve", "reconciliation");
    const parsed = rejectEntrySchema.safeParse(raw);
    if (!parsed.success) {
      return fail({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid rejection.",
      });
    }
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    await rejectEntry(parsed.data.entryId, parsed.data.comment, user.id);
    revalidateRecon([
      `/reconciliation/${entry.exerciseId}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}/review`,
    ]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function previewEntryDiffAction(
  entryId: string,
): Promise<ActionResult<EntryDiffPreview>> {
  try {
    const user = await requireUser();
    authorize(user, "approve", "reconciliation");
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    const data = await previewEntryDiff(entryId);
    return { ok: true, data };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function applyEntryChunkAction(
  raw: unknown,
): Promise<
  ActionResult<{
    processed: number;
    remaining: number;
    approved: boolean;
    nextItemIds: string[];
  }>
> {
  try {
    const user = await requireUser();
    authorize(user, "approve", "reconciliation");
    const parsed = applyEntryChunkSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid apply request." });
    }
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    const data = await applyEntryChunk({
      entryId: parsed.data.entryId,
      itemIds: parsed.data.itemIds,
      finalize: parsed.data.finalize,
      userId: user.id,
    });
    revalidateRecon([
      "/assets",
      `/reconciliation/${entry.exerciseId}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}`,
      `/reconciliation/${entry.exerciseId}/${entry.id}/review`,
    ]);
    return { ok: true, data };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function markAssetVerifiedAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = markVerifiedSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid request." });
    }
    const asset = await prisma.asset.findFirst({
      where: { id: parsed.data.assetId, deletedAt: null },
    });
    if (!asset) return fail({ ok: false, error: "Asset not found." });
    assertDepartmentAccess(user, asset.departmentId);
    assertBranchAccess(user, asset.branchId);
    await markAssetVerifiedToday(
      parsed.data.assetId,
      user.id,
      parsed.data.note,
    );
    revalidateRecon([`/assets/${asset.id}`]);
    return { ok: true };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function getReconFormOptionsAction(
  departmentId: string,
  branchId?: string,
) {
  try {
    const user = await requireUser();
    authorize(user, "reconcile", "reconciliation");
    assertDepartmentAccess(user, departmentId);
    if (branchId) assertBranchAccess(user, branchId);
    const data = await getReconFormOptions(departmentId, branchId);
    return { ok: true as const, data };
  } catch (error) {
    return handleReconError(error);
  }
}

export async function exportEntryLegacyAction(
  entryId: string,
): Promise<
  ActionResult<{
    rows: Awaited<ReturnType<typeof buildLegacyExportRows>> extends infer T
      ? T extends { rows: infer R }
        ? R
        : never
      : never;
    meta: {
      branchName: string;
      inventoryDate: string;
      preparedBy: string;
    };
  }>
> {
  try {
    const user = await requireUser();
    authorize(user, "export", "export");
    const entry = await prisma.reconciliationEntry.findUnique({
      where: { id: entryId },
      include: { exercise: true },
    });
    if (!entry) return fail({ ok: false, error: "Sheet not found." });
    assertDepartmentAccess(user, entry.exercise.departmentId);
    const built = await buildLegacyExportRows(entryId);
    if (!built) return fail({ ok: false, error: "Sheet not found." });
    return {
      ok: true,
      data: { rows: built.rows, meta: built.meta },
    };
  } catch (error) {
    return handleReconError(error);
  }
}
