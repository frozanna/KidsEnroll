import { test, expect } from "@playwright/test";
import { loginAsParent } from "./helpers/auth";

// Helper to generate unique child names per run
function generateChildName(prefix: string) {
  const now = Date.now();
  const random = Math.floor(Math.random() * 100000);
  return `${prefix}-${now}-${random}`;
}

test("parent can add a new child from dashboard", async ({ page }) => {
  // 0. Logowanie jako rodzic na podstawie zmiennych z .env.test
  await loginAsParent(page);

  // 1. Upewnij się, że dashboard jest widoczny
  await expect(
    page.getByTestId("parent-dashboard-add-child-button").or(page.getByTestId("empty-children-add-child-button"))
  ).toBeVisible({ timeout: 10000 });

  // 2. Kliknięcie w przycisk "Dodaj dziecko"
  const addChildButton = (await page.getByTestId("parent-dashboard-add-child-button").isVisible())
    ? page.getByTestId("parent-dashboard-add-child-button")
    : page.getByTestId("empty-children-add-child-button");

  await addChildButton.click();

  // 3. Poczekaj na otwarcie się strony z formularzem dziecka
  const formLocator = page.getByTestId("child-form-create");
  await expect(formLocator).toBeVisible();

  // 4. Uzupełnij formularz dziecka dynamicznymi danymi
  const firstName = generateChildName("ImieTest");
  const lastName = generateChildName("NazwiskoTest");

  await page.getByTestId("child-form-first-name").fill(firstName);
  await page.getByTestId("child-form-last-name").fill(lastName);
  await page.getByTestId("child-form-birth-date").fill("2020-01-01");
  await page.getByTestId("child-form-description").fill("Opis testowy dziecka dodanego z testu E2E.");

  // 5. Zapisz formularz
  await page.getByTestId("child-form-submit-button").click();

  // 6. Poczekaj na powrót do widoku dashboardu
  await expect(page.getByTestId("parent-dashboard-add-child-button")).toBeVisible();

  // 7. Sprawdź, czy nowo dodane dziecko jest widoczne na akordeonie
  await expect(page.getByText(firstName)).toBeVisible();
  await expect(page.getByText(lastName)).toBeVisible();
});
