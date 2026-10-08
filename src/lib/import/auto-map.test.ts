import { describe, expect, it } from "vitest";

import { autoMapColumns } from "@/lib/import/auto-map";

describe("autoMapColumns", () => {
  it("maps the Nwabiagya-style headers", () => {
    const mapping = autoMapColumns([
      "Asset Tag/Label",
      "Asset Type",
      "Brand",
      "Model",
      "Serial Number",
      "User Assigned",
      "Status",
      "Location",
      "Remarks",
    ]);
    expect(mapping["Asset Tag/Label"]).toBe("assetTag");
    expect(mapping["Asset Type"]).toBe("category");
    expect(mapping["Brand"]).toBe("brand");
    expect(mapping["Model"]).toBe("model");
    expect(mapping["Serial Number"]).toBe("serialNumber");
    expect(mapping["User Assigned"]).toBe("assignedToText");
    expect(mapping["Status"]).toBe("status");
    expect(mapping["Location"]).toBe("branch");
    expect(mapping["Remarks"]).toBe("remarks");
  });

  it("leaves unknown columns as skip", () => {
    const mapping = autoMapColumns(["Foo", "Bar"]);
    expect(mapping["Foo"]).toBe("skip");
    expect(mapping["Bar"]).toBe("skip");
  });
});
