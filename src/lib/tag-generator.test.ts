import { describe, expect, it } from "vitest";

import { parseTagFormatSetting, suggestNextTag } from "./tag-generator";

describe("suggestNextTag", () => {
  it("starts at 0001 when no existing tags", () => {
    expect(
      suggestNextTag({
        template: "NRB/{BRANCH}/EQ/{SEQ:4}",
        branchCode: "BK",
        existingTags: [],
      }),
    ).toBe("NRB/BK/EQ/0001");
  });

  it("increments from the highest matching sequence", () => {
    expect(
      suggestNextTag({
        template: "NRB/{BRANCH}/EQ/{SEQ:4}",
        branchCode: "BK",
        existingTags: ["NRB/BK/EQ/0003", "NRB/BK/EQ/0012", "NRB/BH/EQ/0099"],
      }),
    ).toBe("NRB/BK/EQ/0013");
  });

  it("supports dept and category tokens", () => {
    expect(
      suggestNextTag({
        template: "{DEPT}/{BRANCH}/{CAT}/{SEQ:3}",
        branchCode: "HO",
        departmentCode: "ICT",
        categoryCode: "LT",
        existingTags: ["ICT/HO/LT/007"],
      }),
    ).toBe("ICT/HO/LT/008");
  });
});

describe("parseTagFormatSetting", () => {
  it("reads template from setting value", () => {
    expect(parseTagFormatSetting({ template: "X/{SEQ:2}" })).toBe("X/{SEQ:2}");
    expect(parseTagFormatSetting(null)).toBe("NRB/{BRANCH}/EQ/{SEQ:4}");
  });
});
