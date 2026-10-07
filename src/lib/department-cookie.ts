export const DEPARTMENT_COOKIE = "assettrack_department";

export type DepartmentSelection = "all" | string;

export function parseDepartmentCookie(
  value: string | undefined | null,
): DepartmentSelection {
  if (!value || value === "all") return "all";
  return value;
}
