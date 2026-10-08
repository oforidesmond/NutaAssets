import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow1!";

async function ensureLoggedIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function pickSelect(
  page: Page,
  placeholder: string | RegExp,
  optionName: RegExp,
) {
  const trigger = page.getByRole("combobox").filter({ hasText: placeholder });
  await trigger.click();
  const option = page.getByRole("option", { name: optionName }).first();
  await option.waitFor({ state: "visible", timeout: 10_000 });
  await option.click();
}

test.describe("AssetTrack smoke", () => {
  test("login → dashboard → add asset → reports → recon → help", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await expect(page.getByText("Total assets")).toBeVisible();

    await page.goto("/assets/needs-review");
    await expect(
      page.getByRole("heading", { name: "Needs review" }),
    ).toBeVisible();

    await page.goto("/assets/new");
    await expect(page.getByRole("heading", { name: "Add asset" })).toBeVisible();

    // Category — first combobox on the form
    await page.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "Laptop", exact: true }).click();

    // Branch
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /Barekese/i }).click();

    await page.getByLabel("Brand").fill("HP");
    await page.getByLabel("Model").fill("E2E Pavilion");
    await page.getByLabel("Serial number").fill(`E2E-SN-${Date.now()}`);

    await page.getByRole("button", { name: "Save asset" }).click();
    await page.waitForURL(/\/assets\/[^/]+$/, { timeout: 25_000 });
    await expect(page.getByText(/E2E Pavilion|HP/i).first()).toBeVisible();

    await page.goto("/admin/fields");
    await expect(page.getByRole("heading", { name: /field/i })).toBeVisible();

    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await page.getByRole("link", { name: /Register by branch/i }).click();
    await expect(
      page.getByRole("heading", { name: "Register by branch" }),
    ).toBeVisible();

    await page.goto("/reconciliation");
    await expect(
      page.getByRole("heading", { name: "Reconciliation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /New exercise/i }).click();
    await expect(page.getByRole("heading", { name: /New|Create/i })).toBeVisible();

    await page.goto("/help");
    await expect(page.getByRole("heading", { name: /Help/i })).toBeVisible();
    await expect(page.getByText(/Add an asset/i)).toBeVisible();

    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+K" : "Control+K",
    );
    await expect(page.getByPlaceholder(/Search assets/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
