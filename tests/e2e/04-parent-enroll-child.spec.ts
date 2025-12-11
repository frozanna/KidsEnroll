import { test, expect } from "@playwright/test";
import { loginAsParent } from "./helpers/auth";

test.describe("Parent Enrollment", () => {
  test("parent can enroll a child to an activity", async ({ page }) => {
    // 1. Zaloguj się jako rodzic
    await loginAsParent(page);

    // 2. Poczekaj na załadowanie dashboardu
    await expect(page.getByTestId("enroll-activity-button")).toBeVisible();

    // Ensure a child exists (simple check to make test robust)
    if (await page.getByTestId("empty-children-add-child-button").isVisible()) {
      await page.getByTestId("empty-children-add-child-button").click();
      // Assuming these test IDs exist based on parent-dashboard-add-child.spec.ts
      await page.getByTestId("child-form-first-name").fill("Test");
      await page.getByTestId("child-form-last-name").fill("Child");
      await page.getByTestId("child-form-birth-date").fill("2020-01-01");
      await page.getByTestId("child-form-submit-button").click();
      await expect(page.getByTestId("enroll-activity-button")).toBeVisible();
    }

    // 3. Kliknij przycisk “Zapisz na zajęcia”
    await page.getByTestId("enroll-activity-button").click();

    // 4. Poczekaj na przejście do widoku listy zajęć
    await page.waitForURL("**/app/zajecia");

    // Find an available enroll button (not disabled)
    // Using CSS selector for partial attribute match
    const enrollButton = page.locator('button[data-testid^="enroll-button-"]:not([disabled])').first();

    // Wait for at least one activity to be available
    await expect(enrollButton).toBeVisible({ timeout: 10000 });

    // Extract activity ID from testid to verify later
    const testId = await enrollButton.getAttribute("data-testid");
    const activityId = testId?.replace("enroll-button-", "");
    if (!activityId) throw new Error("Could not extract activity ID from enroll button");

    // 5. Kliknij przycisk “Zapisz”
    await enrollButton.click();

    // 6. Poczekaj na otwarcie pop-upu
    const dialog = page.getByTestId("enroll-dialog");
    await expect(dialog).toBeVisible();

    // 7. Wybierz za pomocą radio buttonu któreś dziecko
    const childRadio = page.locator('input[data-testid^="child-radio-"]').first();
    await expect(childRadio).toBeVisible();
    await childRadio.check();

    // Get the child ID to find the correct accordion later
    const childId = await childRadio.getAttribute("value");

    // 8. Kliknij zapisz
    await page.getByTestId("enroll-submit-button").click();

    // 9. Poczekaj na załadowanie widoku zajęć (dialog closes)
    await expect(dialog).toBeHidden();

    // 10. Wróć na stronę główną za pomocą przycisku “EnrollKids”
    await page.getByTestId("nav-home-link").click();
    await page.waitForURL("**/app/dashboard");

    // 11. Przy dziecku zapisanym na zajęcia kliknij “Rozwiń”
    const accordionTrigger = page.getByTestId(`child-accordion-trigger-${childId}`);
    await expect(accordionTrigger).toBeVisible();
    await accordionTrigger.click();

    // 12. Poczekaj do rozwinięcia listy zajęć (implicit in expect visibility)

    // 13. Sprawdź czy wybrane zajęcia są na liście za zapisów dziecka
    await expect(page.getByTestId(`enrollment-item-${activityId}`)).toBeVisible();
  });
});
