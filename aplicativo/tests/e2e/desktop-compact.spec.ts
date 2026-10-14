import { test, expect } from '@playwright/test';
import { createVisualVault, visualGeometry } from './visual-helpers';

test('desktop presentation at a narrow width uses the compact drawer and keeps mobile shortcuts hidden (CSS simulation)', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 760 });
  await createVisualVault(page, 'dark', false);
  // The build/ASAR verification checks app://recanto; this test checks its CSS presentation only.
  await page.evaluate(() => { document.documentElement.dataset.platform = 'desktop'; });
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'android');
  await expect(page.getByRole('navigation', { name: 'Navegação inferior', includeHidden: true })).not.toBeVisible();
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).click({ position: { x: 490, y: 100 } });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
});
