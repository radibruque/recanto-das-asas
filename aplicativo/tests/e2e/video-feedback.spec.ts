import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar meu criatório', exact: true }).click();
  await page.getByRole('button', { name: 'Mais menus', exact: true }).click();
  await page.getByRole('tab', { name: 'Demonstração', exact: true }).click();
  await page.getByRole('button', { name: 'Criar exemplos fictícios', exact: true }).click();
  await expect(page.getByText('Seu plantel tem 3 aves presentes.', { exact: true })).toBeVisible();
}

test('HOME retorna ao topo, não reconta os números e a pesagem é salva no Android', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const counters = page.locator('.tabular-nums > span');
  await expect(counters.first()).toHaveText('3');
  await page.getByRole('button', { name: 'Aves', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Abrir ficha de Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Pesar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Peso (gramas) *', { exact: true }).fill('95');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.bird-profile-weight')).toContainText('95 g');
  await page.getByRole('button', { name: 'Excluir ave', exact: true }).click();
  const panel = page.getByRole('dialog').locator('> div').last();
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error('Missing deletion panel');
  expect(Math.abs(bounds.y + bounds.height / 2 - 422)).toBeLessThan(8);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await expect(counters.first()).toHaveText('3');
});

test('relatórios legíveis e ações fecham ao tocar fora no Android', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByRole('button', { name: 'Ver relatórios', exact: true }).click();
  const table = page.locator('.documents-module .table-wrap').first();
  await table.scrollIntoViewIfNeeded();
  const dimensions = await table.evaluate(element => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
    cellWidth: element.querySelector('th')?.getBoundingClientRect().width ?? 0,
  }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.width);
  expect(dimensions.cellWidth).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Novo cadastro', exact: true }).filter({ visible: true }).click();
  await page.mouse.click(10, 100);
  await expect(page.getByRole('button', { name: 'Novo cadastro', exact: true }).filter({ visible: true })).toHaveAttribute('aria-expanded', 'false');
});

test('atalho de sincronização abre a configuração no computador', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Começar meu criatório', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir configuração de sincronização', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sincronização privada', exact: true })).toBeVisible();
});