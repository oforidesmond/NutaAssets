"use server";

import { cookies } from "next/headers";

import { DEPARTMENT_COOKIE } from "@/lib/department-cookie";

export async function setDepartmentAction(value: string) {
  const store = await cookies();
  store.set(DEPARTMENT_COOKIE, value || "all", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
}
