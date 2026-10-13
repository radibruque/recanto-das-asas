import { test, expect } from '@playwright/test';
import { clickVisualContextControl, createVisualVault, revealVisualContextControl } from './visual-helpers';

test('theme follows the system, keeps an explicit preference, and updates browser color', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  const chooser = page.getByRole('group', { name: 'Tema da interface' });
  await expect(chooser.getByRole('button', { name: 'Sistema', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await chooser.getByRole('button', { name: 'Claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F4F8FA');
  expect(await page.evaluate(() => localStorage.getItem('recanto.ui.theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await chooser.getByRole('button', { name: 'Sistema', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await chooser.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#233B46');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
});

test('preference is applied before React loads and only writes its visual storage key', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('recanto.ui.theme', 'dark'));
  await page.route(/\/assets\/.*\.js$/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['recanto.ui.theme']);
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#233B46');
});

test('blocked visual storage keeps theme usable without preventing vault creation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked in test', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked in test', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('group', { name: 'Tema da interface' }).getByRole('button', { name: 'Claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Senha da base', { exact: true }).fill('senha-ficticia-armazenamento');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-ficticia-armazenamento');
  await page.getByRole('button', { name: 'Criar base privada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Painel Criatório', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme controls remain independent of real and demonstration vaults and lock state', async ({ page }) => {
  await createVisualVault(page, 'light', false);
  await revealVisualContextControl(page, 'Escuro');
  const chooser = page.getByRole('group', { name: 'Tema da interface' });
  await chooser.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await clickVisualContextControl(page, 'Demonstração');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await clickVisualContextControl(page, 'Meu criatório');
  await clickVisualContextControl(page, 'Bloquear');
  await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('group', { name: 'Tema da interface' }).getByRole('button', { name: 'Escuro', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('cached production app keeps the selected theme when reopened offline', async ({ page, context }) => {
  test.skip(process.env.RECANTO_E2E_PREVIEW !== '1', 'Service worker caching belongs to the production build.');
  await createVisualVault(page, 'dark', false);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Abra seus registros', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('group', { name: 'Tema da interface' }).getByRole('button', { name: 'Escuro', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
