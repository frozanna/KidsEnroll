import type { Page } from "@playwright/test";

async function logIfInvalidCredentialsShown(page: Page) {
  const errorText = "Nieprawidłowe dane logowania";
  // Give the UI a brief moment to render potential error message
  const isVisible = await page
    .locator(`text=${errorText}`)
    .isVisible()
    .catch(() => false);
  if (isVisible) {
    console.log(`[Auth Helper] UI shows error: ${errorText}`);
  } else {
    console.log(`[Auth Helper] UI does not show error: ${errorText}`);
  }
}

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

  await logIfInvalidCredentialsShown(page);
  const currentURL = page.url();
  console.log(`You are currently on: ${currentURL}`);

  await page.waitForURL("**/app/dashboard");
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const username = process.env.E2E_ADMIN_USERNAME ?? "";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "";

  if (!username || !password) {
    throw new Error("Missing E2E_USERNAME or E2E_PASSWORD env variables");
  }

  await page.goto("/auth/login");

  await page.getByTestId("auth-login-email").fill(username);
  await page.getByTestId("auth-login-password").fill(password);
  await page.getByTestId("auth-login-submit").click();

  await logIfInvalidCredentialsShown(page);

  const currentURL = page.url();
  console.log(`You are currently on: ${currentURL}`);

  await page.waitForURL("/admin/activities");
}
