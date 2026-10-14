import { expect, test, type Page } from '@playwright/test';
import { clickVisualContextControl, createVisualVault, navigateVisual, readVisualState, visualPassword } from './visual-helpers';

const active = (page: Page) => page.locator('.cached-view:not([hidden])');

for (const native of [false, true]) test(`lightweight context ${native ? 'Android back' : 'browser Back'} restores a bird list after another module commits data`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  if (native) await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
  await createVisualVault(page, native ? 'dark' : 'light', true);
  await navigateVisual(page, 'Aves');
  await page.getByLabel('Buscar aves', { exact: true }).fill('Pingo');
  await active(page).locator('details.filter-panel > summary').click();
  await page.getByRole('combobox', { name: 'Espécie', exact: true }).selectOption('Calopsita (Nymphicus hollandicus)');
  await page.getByRole('combobox', { name: 'Sexo', exact: true }).selectOption('macho');
  await page.getByRole('button', { name: 'Pingo · EX-003', exact: true }).scrollIntoViewIfNeeded();
  const listPosition = await page.evaluate(() => scrollY);
  expect(listPosition).toBeGreaterThan(0);

  await page.getByRole('navigation', { name: 'Navegação inferior', exact: true }).getByRole('button', { name: 'Abrir todos os menus', exact: true }).click();
  await page.getByRole('navigation', { name: 'Navegação principal', exact: true }).getByRole('button', { name: 'Financeiro', exact: true }).click();
  await expect(page.locator('.page-title h1')).toHaveText('Financeiro');
  await active(page).getByRole('button', { name: 'Nova conta financeira', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Conta financeira', exact: true });
  await form.getByLabel('Nome da conta', { exact: true }).fill('QA conta criada fora da lista');
  await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click();
  await expect(form).not.toBeVisible();
  expect((await readVisualState(page)).accounts.some(account => account.scope === 'demo' && account.name === 'QA conta criada fora da lista')).toBe(true);

  if (native) await page.evaluate(() => window.dispatchEvent(new CustomEvent('recanto:native-back')));
  else await page.getByRole('button', { name: 'Voltar ao contexto anterior', exact: true }).click();
  await expect(page.locator('.page-title h1')).toHaveText('Aves');
  await expect(page.getByLabel('Buscar aves', { exact: true })).toHaveValue('Pingo');
  await expect(page.getByRole('combobox', { name: 'Espécie', exact: true })).toHaveValue('Calopsita (Nymphicus hollandicus)');
  await expect(page.getByRole('combobox', { name: 'Sexo', exact: true })).toHaveValue('macho');
  await expect(active(page).locator('.bird-list-row')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(listPosition - 5);
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(listPosition + 5);
  // Visiting a module must not retain offscreen copies of its records and files.
  await expect(page.locator('.cached-view')).toHaveCount(1);
  await expect(page.locator('.commercial-module')).toHaveCount(0);
});

test('a bird detail keeps its selected tab across modules and reads the current shared health records', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createVisualVault(page, 'dark', true);
  await navigateVisual(page, 'Aves');
  await active(page).getByRole('button', { name: 'Pingo · EX-003', exact: true }).click();
  await active(page).getByRole('button', { name: 'Pesar', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Registrar peso', exact: true });
  await form.getByLabel('Peso (gramas) *', { exact: true }).fill('91.5');
  await form.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(form).not.toBeVisible();
  await active(page).getByRole('tab', { name: 'Saúde e peso', exact: true }).click();
  await expect(active(page)).toContainText('91,5 g');

  await navigateVisual(page, 'Financeiro');
  await expect(page.locator('.breeding')).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar ao contexto anterior', exact: true }).click();
  await expect(active(page).locator('.bird-profile-name')).toHaveText('Pingo');
  await expect(active(page).getByRole('tab', { name: 'Saúde e peso', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(active(page)).toContainText('91,5 g');

  await navigateVisual(page, 'Saúde e manejo');
  await active(page).getByRole('button', { name: 'Ver histórico de Pingo · EX-003', exact: true }).click();
  await expect(active(page)).toContainText('91,5 g');
  const state = await readVisualState(page);
  const bird = state.birds.find(record => record.scope === 'demo' && record.identification === 'EX-003');
  expect(state.health.filter(record => record.scope === 'demo' && record.birdId === bird?.id && record.weightGrams === 91.5)).toHaveLength(1);

  await clickVisualContextControl(page, 'Bloquear');
  await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await navigateVisual(page, 'Aves');
  await expect(active(page).locator('.bird-list-row')).toHaveCount(3);
  await expect(active(page).locator('.bird-profile-name')).toHaveCount(0);
  expect((await readVisualState(page)).health.filter(record => record.scope === 'demo' && record.birdId === bird?.id && record.weightGrams === 91.5)).toHaveLength(1);
});
