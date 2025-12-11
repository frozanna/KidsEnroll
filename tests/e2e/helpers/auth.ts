import type { Page } from "@playwright/test";

export async function loginAsParent(page: Page) {
  const username = process.env.E2E_USERNAME ?? "";
  const password = process.env.E2E_PASSWORD ?? "";

  if (!username || !password) {
    throw new Error("Missing E2E_USERNAME or E2E_PASSWORD env variables");
  }

  await page.goto("/auth/login");

  await page.getByTestId("auth-login-email").fill(username);
  await page.getByTestId("auth-login-password").fill(password);
  await page.getByTestId("auth-login-submit").click();

  console.log("Logging in as parent:", password);

  await page.waitForURL("**/app/dashboard");
}
