"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { AuthorizationError, authorize } from "@/lib/authorize";
import { fail, type ActionResult } from "@/server/actions/types";
import { ServiceError } from "@/server/services/admin-org";
import {
  applySuggestedTag,
  bulkClearNeedsReview,
  clearNeedsReview,
  clearPlaceholderFields,
  findDuplicatePeers,
} from "@/server/services/data-quality";

function handleError<T = undefined>(error: unknown): ActionResult<T> {
  if (error instanceof AuthorizationError) {
    return fail<T>({ ok: false, error: error.message });
  }
  if (error instanceof ServiceError) {
    return fail<T>({ ok: false, error: error.message });
  }
  console.error("[data-quality action]", error);
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

function revalidateReviewPaths(assetId?: string) {
  revalidatePath("/assets");
  revalidatePath("/assets/needs-review");
  revalidatePath("/dashboard");
  if (assetId) revalidatePath(`/assets/${assetId}`);
}

export async function clearNeedsReviewAction(
  assetId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    await clearNeedsReview(assetId, user.id);
    revalidateReviewPaths(assetId);
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function bulkClearNeedsReviewAction(
  assetIds: string[],
): Promise<ActionResult<{ processed: number }>> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const parsed = z.array(z.string().min(1)).max(200).safeParse(assetIds);
    if (!parsed.success) {
      return { ok: false, error: "Invalid selection." };
    }
    const result = await bulkClearNeedsReview(parsed.data, user.id);
    revalidateReviewPaths();
    return { ok: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function applySuggestedTagAction(
  assetId: string,
): Promise<ActionResult<{ tag: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    const asset = await applySuggestedTag(assetId, user.id);
    revalidateReviewPaths(assetId);
    return { ok: true, data: { tag: asset.assetTag ?? "" } };
  } catch (error) {
    return handleError(error);
  }
}

export async function clearPlaceholderFieldsAction(
  assetId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    authorize(user, "update", "asset");
    await clearPlaceholderFields(assetId, user.id);
    revalidateReviewPaths(assetId);
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function findDuplicatePeersAction(
  assetId: string,
): Promise<
  ActionResult<{
    tagHits: {
      id: string;
      assetTag: string | null;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      branch: { name: string };
    }[];
    serialHits: {
      id: string;
      assetTag: string | null;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      branch: { name: string };
    }[];
  }>
> {
  try {
    const user = await requireUser();
    authorize(user, "read", "asset");
    const peers = await findDuplicatePeers(assetId);
    return { ok: true, data: peers };
  } catch (error) {
    return handleError(error);
  }
}
