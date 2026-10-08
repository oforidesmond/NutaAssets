"use server";

import { auth } from "@/lib/auth";
import { AuthorizationError, authorize } from "@/lib/authorize";
import { fail, type ActionResult } from "@/server/actions/types";
import { searchAssetsQuick } from "@/server/queries/search";

export async function searchAssetsAction(
  q: string,
): Promise<
  ActionResult<
    {
      id: string;
      assetTag: string | null;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      category: { name: string };
      branch: { name: string };
      status: { name: string; color: string };
    }[]
  >
> {
  try {
    const session = await auth();
    if (!session?.user) throw new AuthorizationError("You must be signed in.");
    authorize(session.user, "read", "asset");
    const rows = await searchAssetsQuick(session.user, q);
    return { ok: true, data: rows };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return fail({ ok: false, error: error.message });
    }
    console.error("[search]", error);
    return fail({ ok: false, error: "Search failed." });
  }
}
