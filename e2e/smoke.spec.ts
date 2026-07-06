import { expect, test } from '@playwright/test';

/**
 * C2 — smoke test: the app loads, all four tabs render, a production plan
 * can be created and survives a reload (persisted stores).
 */
test('loads, navigates the four tabs, plans and persists', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Foxhole Swiss Army Knife/);

  // Production: pick a target through the searchable combobox (A1.1 —
  // the empty order shows a quick-add search row).
  const combo = page.locator('input[role="combobox"]').first();
  await combo.click();
  await combo.fill('120mm');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Flux de production|Production flow/i)).toBeVisible();

  // The four tabs render their surface.
  const tabs = page.locator('nav button');
  await tabs.nth(1).click(); // deployment
  await expect(page.locator('aside')).toBeVisible();
  await tabs.nth(2).click(); // logistics
  await expect(page.locator('aside')).toBeVisible();
  await tabs.nth(3).click(); // attack
  await expect(page.locator('aside')).toBeVisible();

  // Persistence: the production target survives a reload.
  await page.reload();
  await tabs.nth(0).click();
  await expect(combo).toHaveValue(/120mm/);
});
