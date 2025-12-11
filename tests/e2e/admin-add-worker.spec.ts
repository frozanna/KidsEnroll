import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test("admin can add a new worker", async ({ page }) => {
  // 1. Zaloguj się jako administrator
  await loginAsAdmin(page);

  // 2. Poczekaj na załadowanie panelu administratora (navbar)
  await expect(page.getByTestId("admin-navbar")).toBeVisible();

  // 3. Przejdź do zakładki "Opiekunowie"
  await page.getByTestId("admin-nav-workers-link").click();

  // 4. Kliknij w przycisk "Dodaj opiekuna"
  await expect(page.getByTestId("admin-workers-page")).toBeVisible();
  await page.getByTestId("admin-add-worker-button").click();

  // 5. Poczekaj na otwarcie się strony z formularzem
  const createForm = page.getByTestId("admin-worker-create-form");
  await expect(createForm).toBeVisible();

  // 6. Uzupełnij formularz opiekuna
  const uniqueSuffix = Math.random().toString(36).slice(2, 10);
  const firstName = `Jan-${uniqueSuffix}`;
  const lastName = `Kowalski-${uniqueSuffix}`;
  const email = `jan.kowalski.${uniqueSuffix}@example.com`;

  await page.getByTestId("admin-worker-first-name-input").fill(firstName);
  await page.getByTestId("admin-worker-last-name-input").fill(lastName);
  await page.getByTestId("admin-worker-email-input").fill(email);

  // 7. Zapisz formularz
  await page.getByTestId("admin-worker-submit-button").click();

  // 8. Poczekaj na powrót do listy opiekunów
  await expect(page.getByTestId("admin-workers-page")).toBeVisible();
  await expect(page.getByTestId("admin-workers-table")).toBeVisible();

  // 9. Sprawdź czy nowy opiekun się dodał
  const rows = page.getByTestId("admin-workers-row");
  await expect(rows.filter({ hasText: firstName }).filter({ hasText: lastName })).toHaveCount(1);
});
