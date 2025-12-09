import { test, expect } from "@playwright/test";

// Prosty smoke test strony głównej
test("homepage has title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KidsEnroll/i);
});
