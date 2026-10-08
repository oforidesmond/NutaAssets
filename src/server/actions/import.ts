"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  AuthorizationError,
  assertDepartmentAccess,
  authorize,
  can,
} from "@/lib/authorize";
import { limitImport } from "@/lib/rate-limit";
import {
  dryRunExistingSchema,
  importChunkSchema,
  saveMappingTemplateSchema,
  startImportJobSchema,
} from "@/schemas/import";
import { fail, type ActionResult } from "@/server/actions/types";
import { ServiceError } from "@/server/services/admin-org";
import {
  findExistingAssetsForImport,
  getImportContext,
  listRecentImportJobs,
  processImportChunk,
  saveMappingTemplate,
  startImportJob,
  undoImportJob,
  type ImportContext,
} from "@/server/services/import";

function handleImportError<T = undefined>(error: unknown): ActionResult<T> {
  if (error instanceof AuthorizationError) {
    return fail<T>({ ok: false, error: error.message });
  }
  if (error instanceof ServiceError) {
    return fail<T>({ ok: false, error: error.message });
  }
  console.error("[import action]", error);
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

export async function getImportContextAction(
  departmentId: string,
): Promise<ActionResult<ImportContext>> {
  try {
    const user = await requireUser();
    // Used by import wizard and legacy export — allow either permission
    if (!can(user, "import") && !can(user, "export")) {
      throw new AuthorizationError(
        "You do not have permission to import or export.",
      );
    }
    assertDepartmentAccess(user, departmentId);
    const data = await getImportContext(departmentId);
    return { ok: true, data };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function findExistingForImportAction(
  raw: unknown,
): Promise<
  ActionResult<{ id: string; assetTag: string | null; serialNumber: string | null }[]>
> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const parsed = dryRunExistingSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid lookup request." });
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const data = await findExistingAssetsForImport(
      parsed.data.departmentId,
      parsed.data.tags,
      parsed.data.serials,
    );
    return { ok: true, data };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function startImportJobAction(
  raw: unknown,
): Promise<ActionResult<{ jobId: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const rl = limitImport(user.id);
    if (!rl.ok) {
      return fail({
        ok: false,
        error: "Too many import requests. Wait a moment and try again.",
      });
    }
    const parsed = startImportJobSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid import job details." });
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const job = await startImportJob({
      userId: user.id,
      departmentId: parsed.data.departmentId,
      fileName: parsed.data.fileName,
      mapping: parsed.data.mapping,
      totalRows: parsed.data.totalRows,
    });
    return { ok: true, data: { jobId: job.id } };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function importChunkAction(
  raw: unknown,
): Promise<
  ActionResult<{
    created: number;
    updated: number;
    skipped: number;
    flagged: number;
    errors: { sourceRow: number; message: string }[];
    job: {
      id: string;
      created: number;
      updated: number;
      skipped: number;
      flagged: number;
      status: string;
    };
  }>
> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const rl = limitImport(user.id);
    if (!rl.ok) {
      return fail({
        ok: false,
        error: "Too many import requests. Wait a moment and try again.",
      });
    }
    const parsed = importChunkSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid import chunk." });
    }
    assertDepartmentAccess(user, parsed.data.departmentId);
    const result = await processImportChunk({
      jobId: parsed.data.jobId,
      departmentId: parsed.data.departmentId,
      userId: user.id,
      rows: parsed.data.rows,
      isLast: parsed.data.isLast,
    });
    if (parsed.data.isLast) {
      revalidatePath("/assets");
      revalidatePath("/import");
    }
    return {
      ok: true,
      data: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        flagged: result.flagged,
        errors: result.errors,
        job: {
          id: result.job.id,
          created: result.job.created,
          updated: result.job.updated,
          skipped: result.job.skipped,
          flagged: result.job.flagged,
          status: result.job.status,
        },
      },
    };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function undoImportJobAction(
  jobId: string,
): Promise<ActionResult<{ softDeleted: number }>> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const result = await undoImportJob(jobId, user.id);
    revalidatePath("/assets");
    revalidatePath("/import");
    return { ok: true, data: { softDeleted: result.count } };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function listRecentImportJobsAction(): Promise<
  ActionResult<
    {
      id: string;
      fileName: string;
      totalRows: number;
      created: number;
      updated: number;
      skipped: number;
      flagged: number;
      status: string;
      createdAt: string;
      departmentId: string | null;
    }[]
  >
> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const jobs = await listRecentImportJobs(user.id);
    return {
      ok: true,
      data: jobs.map((j) => ({
        ...j,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return handleImportError(error);
  }
}

export async function saveMappingTemplateAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await requireUser();
    authorize(user, "import", "import");
    const parsed = saveMappingTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail({ ok: false, error: "Invalid mapping template." });
    }
    const template = await saveMappingTemplate(parsed.data);
    return { ok: true, data: { id: template.id, name: template.name } };
  } catch (error) {
    return handleImportError(error);
  }
}
