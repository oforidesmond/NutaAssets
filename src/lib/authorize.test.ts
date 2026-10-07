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
});
