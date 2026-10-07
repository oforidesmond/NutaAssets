import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
          include: {
            departments: true,
            branches: true,
          },
        });

        if (!user || !user.isActive) {
          await writeAuditLog({
            action: "LOGIN_FAILED",
            entityType: "User",
            after: { email, reason: "not_found_or_inactive" },
          });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAuditLog({
            userId: user.id,
            action: "LOGIN_LOCKED",
            entityType: "User",
            entityId: user.id,
          });
          throw new Error("Account temporarily locked. Try again later.");
        }

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          const failedLogins = user.failedLogins + 1;
          const lockedUntil =
            failedLogins >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null;

          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins, lockedUntil },
          });

          await writeAuditLog({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            after: { failedLogins, locked: Boolean(lockedUntil) },
          });

          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        await writeAuditLog({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "User",
          entityId: user.id,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentIds: user.departments.map((d) => d.departmentId),
          branchIds: user.branches.map((b) => b.branchId),
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
