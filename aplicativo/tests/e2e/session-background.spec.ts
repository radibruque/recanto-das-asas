import { test, expect } from '@playwright/test';
import { createVisualVault, clickVisualContextControl, navigateVisual, visualPassword } from './visual-helpers';

for (const platform of ['web', 'android'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${platform} ${theme}: simulated background keeps the active session; explicit lock and reopening require authentication`, async ({ page }) => {
    await page.setViewportSize({ width: platform === 'android' ? 390 : 1440, height: 844 });
    if (platform === 'android') await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
    await createVisualVault(page, theme, false);
    await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
    await form.getByLabel('Identificação ou anilha *', { exact: true }).fill('SESSAO-QA');
    await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
    await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
    // This exercises browser session events, not Android process survival or a physical biometric sensor.
    await page.clock.install();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.fastForward(11 * 60 * 1000);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByRole('button', { name: 'SESSAO-QA', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toHaveCount(0);
    await clickVisualContextControl(page, 'Bloquear'); await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toBeVisible();
    await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await navigateVisual(page, 'Aves'); await expect(page.getByRole('button', { name: 'SESSAO-QA', exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toBeVisible();
    await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await navigateVisual(page, 'Aves'); await expect(page.getByRole('button', { name: 'SESSAO-QA', exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('senha-ficticia-qa-visual')))).toBe(false);
  });
}
