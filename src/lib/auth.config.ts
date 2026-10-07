import type { Role } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma / Node-only imports).
 * Full credentials provider lives in auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id?: string;
          role: Role;
          departmentIds: string[];
          branchIds: string[];
          mustChangePassword: boolean;
        };
        token.id = u.id!;
        token.role = u.role;
        token.departmentIds = u.departmentIds;
        token.branchIds = u.branchIds;
        token.mustChangePassword = u.mustChangePassword;
      }

      if (trigger === "update" && session?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.departmentIds = (token.departmentIds as string[]) ?? [];
        session.user.branchIds = (token.branchIds as string[]) ?? [];
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
