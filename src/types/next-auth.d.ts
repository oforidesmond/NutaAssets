import { type Role } from "@prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      departmentIds: string[];
      branchIds: string[];
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    departmentIds: string[];
    branchIds: string[];
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    departmentIds: string[];
    branchIds: string[];
    mustChangePassword: boolean;
  }
}
