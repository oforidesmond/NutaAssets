import { type Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
  departmentIds: string[];
  branchIds: string[];
};

export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "reconcile"
  | "approve"
  | "admin"
  | "manage_users"
  | "manage_settings"
  | "view_audit";

export type Resource =
  | "asset"
  | "department"
  | "branch"
  | "category"
  | "status"
  | "field"
  | "person"
  | "user"
  | "reconciliation"
  | "report"
  | "import"
  | "export"
  | "setting"
  | "audit"
  | "dashboard";

const ROLE_ACTIONS: Record<Role, Set<Action>> = {
  SUPER_ADMIN: new Set([
    "read",
    "create",
    "update",
    "delete",
    "import",
    "export",
    "reconcile",
    "approve",
    "admin",
    "manage_users",
    "manage_settings",
    "view_audit",
  ]),
  DEPT_ADMIN: new Set([
    "read",
    "create",
    "update",
    "delete",
    "import",
    "export",
    "reconcile",
    "approve",
    "admin",
    "manage_users",
    "view_audit",
  ]),
  EDITOR: new Set([
    "read",
    "create",
    "update",
    "delete",
    "import",
    "export",
    "reconcile",
  ]),
  VIEWER: new Set(["read", "export", "view_audit"]),
};

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function authorize(
  user: AuthUser | null | undefined,
  action: Action,
  resource?: Resource,
): asserts user is AuthUser {
  void resource;
  if (!user) {
    throw new AuthorizationError("You must be signed in.");
  }

  const allowed = ROLE_ACTIONS[user.role];
  if (!allowed?.has(action)) {
    throw new AuthorizationError();
  }
}

export function can(user: AuthUser | null | undefined, action: Action): boolean {
  if (!user) return false;
  return ROLE_ACTIONS[user.role]?.has(action) ?? false;
}

/** Returns department IDs the user may access. Super Admin = all (null = unrestricted). */
export function scopedDepartmentIds(
  user: AuthUser,
  requestedDepartmentId?: string | null,
): string[] | null {
  if (user.role === "SUPER_ADMIN") {
    return requestedDepartmentId ? [requestedDepartmentId] : null;
  }

  if (requestedDepartmentId) {
    if (!user.departmentIds.includes(requestedDepartmentId)) {
      throw new AuthorizationError("That department is outside your access.");
    }
    return [requestedDepartmentId];
  }

  return user.departmentIds;
}

/** Returns branch IDs the user may access. Empty branch list = all branches in their depts. */
export function scopedBranchIds(
  user: AuthUser,
  requestedBranchId?: string | null,
): string[] | null {
  if (user.role === "SUPER_ADMIN") {
    return requestedBranchId ? [requestedBranchId] : null;
  }

  if (user.branchIds.length === 0) {
    return requestedBranchId ? [requestedBranchId] : null;
  }

  if (requestedBranchId) {
    if (!user.branchIds.includes(requestedBranchId)) {
      throw new AuthorizationError("That branch is outside your access.");
    }
    return [requestedBranchId];
  }

  return user.branchIds;
}

export function assertDepartmentAccess(user: AuthUser, departmentId: string) {
  if (user.role === "SUPER_ADMIN") return;
  if (!user.departmentIds.includes(departmentId)) {
    throw new AuthorizationError("That department is outside your access.");
  }
}

export function assertBranchAccess(user: AuthUser, branchId: string) {
  if (user.role === "SUPER_ADMIN") return;
  if (user.branchIds.length === 0) return;
  if (!user.branchIds.includes(branchId)) {
    throw new AuthorizationError("That branch is outside your access.");
  }
}
