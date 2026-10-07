"use server";

import { compare, hash } from "bcryptjs";
import { AuthError } from "next-auth";

import { auth, signIn } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { changePasswordSchema, loginSchema } from "@/schemas/auth";

export type ActionResult = {
  ok: boolean;
  error?: string;
};

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error:
          error.message.includes("locked")
            ? "Account temporarily locked after too many failed attempts. Try again in 15 minutes."
            : "Email or password is incorrect.",
      };
    }
    // Next.js redirect throws; rethrow so navigation works
    throw error;
  }
}

export async function changePasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
  });

  if (!user) {
    return { ok: false, error: "User not found." };
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  });

  return { ok: true };
}
