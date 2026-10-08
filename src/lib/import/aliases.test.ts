import { describe, expect, it } from "vitest";

import {
  extractModelFromType,
  resolveAlias,
} from "@/lib/import/aliases";

const CATEGORY_ALIASES = {
  "SYSTEM UNIT": "Desktop/System Unit",
  "CISCO SWITCH": "Switch",
  "SERVER R730": "Server",
  "STAR LINK": "Satellite/Starlink",
};

const KNOWN = [
  "Laptop",
  "Desktop/System Unit",
  "Monitor",
  "Printer",
  "Server",
  "Switch",
  "Satellite/Starlink",
];

describe("resolveAlias", () => {
  it("maps SYSTEM UNIT to Desktop/System Unit", () => {
    const r = resolveAlias("SYSTEM UNIT", CATEGORY_ALIASES, KNOWN);
    expect(r.resolved).toBe("Desktop/System Unit");
    expect(r.fromAlias).toBe(true);
    expect(r.unknown).toBe(false);
  });

  it("maps case-insensitive known names", () => {
    const r = resolveAlias("laptop", {}, KNOWN);
    expect(r.resolved).toBe("Laptop");
    expect(r.fromAlias).toBe(false);
  });

  it("flags truly unknown values", () => {
    const r = resolveAlias("QUANTUM TOASTER", CATEGORY_ALIASES, KNOWN);
    expect(r.resolved).toBeNull();
    expect(r.unknown).toBe(true);
  });

  it("maps status INACTIVE", () => {
    const r = resolveAlias(
      "INACTIVE",
      { INACTIVE: "Inactive" },
      ["Active", "Inactive", "Faulty"],
    );
    expect(r.resolved).toBe("Inactive");
  });
});

describe("extractModelFromType", () => {
  it("extracts R730 from SERVER R730", () => {
    expect(extractModelFromType("SERVER R730", "Server")).toBe("R730");
  });

  it("returns null when not a server suffix type", () => {
    expect(extractModelFromType("LAPTOP", "Laptop")).toBeNull();
  });
});
