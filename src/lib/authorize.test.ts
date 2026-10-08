import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  authorize,
  can,
  scopedDepartmentIds,
} from "@/lib/authorize";

const viewer = {
  id: "u1",
  role: "VIEWER" as const,
  departmentIds: ["d1"],
  branchIds: [],
};

const editor = {
  id: "u2",
  role: "EDITOR" as const,
  departmentIds: ["d1"],
  branchIds: ["b1"],
};

const admin = {
  id: "u3",
  role: "SUPER_ADMIN" as const,
  departmentIds: [],
  branchIds: [],
};

const deptAdmin = {
  id: "u4",
  role: "DEPT_ADMIN" as const,
  departmentIds: ["d1"],
  branchIds: [],
};

describe("authorize", () => {
  it("allows viewers to read", () => {
    expect(() => authorize(viewer, "read", "asset")).not.toThrow();
    expect(can(viewer, "create")).toBe(false);
  });

  it("blocks viewers from mutating", () => {
    expect(() => authorize(viewer, "create", "asset")).toThrow(
      AuthorizationError,
    );
  });

  it("allows editors to create assets", () => {
    expect(() => authorize(editor, "create", "asset")).not.toThrow();
  });

  it("scopes departments for non-super-admins", () => {
    expect(scopedDepartmentIds(editor)).toEqual(["d1"]);
    expect(scopedDepartmentIds(admin)).toBeNull();
  });

  it("allows editors to reconcile but not approve", () => {
    expect(() => authorize(editor, "reconcile", "reconciliation")).not.toThrow();
    expect(can(editor, "approve")).toBe(false);
    expect(() => authorize(editor, "approve", "reconciliation")).toThrow(
      AuthorizationError,
    );
  });

  it("allows dept admins to reconcile and approve", () => {
    expect(() =>
      authorize(deptAdmin, "reconcile", "reconciliation"),
    ).not.toThrow();
    expect(() =>
      authorize(deptAdmin, "approve", "reconciliation"),
    ).not.toThrow();
  });

  it("blocks viewers from reconcile and approve", () => {
    expect(can(viewer, "reconcile")).toBe(false);
    expect(can(viewer, "approve")).toBe(false);
  });
});
