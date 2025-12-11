import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Admin Activities", () => {
  test("should allow admin to add a new activity", async ({ page }) => {
    // 1. Zaloguj się jako administrator
    // 2. Poczekaj na załadowanie panelu administratora (handled by loginAsAdmin)
    await loginAsAdmin(page);

    // 3. Przejdź do zakładki “Zajęcia” (already there after login)
    await expect(page).toHaveURL("/admin/activities");

    // 4. Kliknij w przycisk "Dodaj zajęcia”
    await page.getByTestId("add-activity-button").click();

    // 5. Poczekaj na otwarcie się strony z formularzem
    await page.waitForURL("**/admin/activities/new");

    // Generate random data
    const randomId = Math.floor(Math.random() * 10000);
    const activityName = `Test Activity ${randomId}`;
    const activityDescription = `Description for test activity ${randomId}`;
    const cost = (Math.random() * 100).toFixed(2);
    const limit = Math.floor(Math.random() * 20) + 5;

    // Future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    futureDate.setHours(14, 30, 0, 0);
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const dateString = futureDate.toISOString().slice(0, 16);

    // 6. Uzupełnij formularz zajęć
    await page.getByTestId("activity-name-input").fill(activityName);
    await page.getByTestId("activity-description-input").fill(activityDescription);
    await page.getByTestId("activity-cost-input").fill(cost);
    await page.getByTestId("activity-limit-input").fill(limit.toString());
    await page.getByTestId("activity-date-input").fill(dateString);

    // Select first available worker (index 1 because 0 is placeholder)
    const workerSelect = page.getByTestId("activity-worker-select");
    await workerSelect.selectOption({ index: 1 });

    // Add 2 random tags
    const tags = [`tag${randomId}a`, `tag${randomId}b`];
    for (const tag of tags) {
      await page.getByTestId("activity-tags-input").fill(tag);
      await page.getByTestId("add-tag-button").click();
    }

    // 7. Zapisz formularz
    await page.getByTestId("submit-activity-button").click();

    // 8. Poczekaj na powrót do listy zajęć
    await page.waitForURL("admin/activities");

    // 9. Sprawdź czy nowe zajęcia się dodały
    // We look for the row with the specific name
    const newActivityRow = page.getByRole("row", { name: activityName });
    await expect(newActivityRow).toBeVisible();

    // Optionally verify details in the row
    await expect(newActivityRow.getByTestId("activity-name")).toHaveText(activityName);
  });
});
