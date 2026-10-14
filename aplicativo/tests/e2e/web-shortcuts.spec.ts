import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { createVisualVault, navigateVisual, visualPassword } from './visual-helpers';

async function saveBird(page: Page, identification: string, photo = false) {
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
  await expect(form).toBeVisible();
  await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(identification);
  await form.getByLabel('Nome', { exact: true }).fill(photo ? 'Ave do atalho' : `Ave ${identification}`);
  await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
  if (photo) {
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
      const context = canvas.getContext('2d')!; context.fillStyle = '#054973'; context.fillRect(0, 0, 160, 120);
      context.fillStyle = '#67994b'; context.fillRect(12, 12, 136, 96); return canvas.toDataURL('image/png').split(',')[1];
    });
    const input = form.getByLabel('Foto principal da ave', { exact: true });
    const section = input.locator('xpath=ancestor::details[not(@open)][1]');
    if (await section.count()) await section.locator(':scope > summary').click();
    await input.setInputFiles({ name: 'foto-ficticia-atalho.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(form.getByText('foto-ficticia-atalho.png', { exact: true })).toBeVisible();
  }
  await form.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(form).not.toBeVisible();
}

const layouts = [
  { platform: 'web', width: 360 }, { platform: 'web', width: 1440 },
  { platform: 'android', width: 360 }, { platform: 'android', width: 390 }, { platform: 'android', width: 1280 },
] as const;

for (const layout of layouts) for (const theme of ['light', 'dark'] as const) {
  test(`${layout.platform} ${layout.width}px ${theme}: contextual creation and five mobile destinations preserve data and viewport`, async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(180000);
    const height = 760, errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: layout.width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (layout.platform === 'android') await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
    await createVisualVault(page, theme, false);
    const compact = layout.platform === 'android' || layout.width <= 900;
    const shortcuts = page.getByRole('navigation', { name: 'Navegação inferior', exact: true, includeHidden: true });
    await expect(shortcuts).toHaveCount(1);
    if (compact) {
      await expect(shortcuts).toBeVisible();
      await expect(shortcuts.getByRole('button')).toHaveCount(5);
      expect(await shortcuts.getByRole('button').allTextContents()).toEqual(['Hoje', 'Aves', 'Reprodução', 'Comercial', 'Mais']);
      await expect(shortcuts.getByRole('button', { name: /Novo|Cadastrar/ })).toHaveCount(0);
      expect(await shortcuts.getByRole('button').evaluateAll(buttons => buttons.every(button => {
        const icon = button.querySelector('svg')?.getBoundingClientRect(), label = button.querySelector('span')?.getBoundingClientRect();
        return !!icon && !!label && icon.bottom <= label.top + 1;
      }))).toBe(true);
    } else await expect(shortcuts).not.toBeVisible();
    await navigateVisual(page, 'Aves');
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole('button', { name: 'Novo', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
      await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(`CANCELADO-${attempt}`);
      if (compact && attempt === 1 && layout.width < 900) {
        await page.setViewportSize({ width: layout.width, height: 430 });
        await form.getByLabel('Nome', { exact: true }).fill('Cancelado fictício');
        const cancel = form.getByRole('button', { name: 'Cancelar', exact: true }); await cancel.scrollIntoViewIfNeeded();
        const rect = await cancel.boundingBox(); expect(rect).not.toBeNull(); expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(430);
      }
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(form).not.toBeVisible();
      await page.setViewportSize({ width: layout.width, height });
    }
    const identification = `ATALHO-${layout.platform}-${layout.width}-${theme}`;
    await saveBird(page, identification, true);
    for (let index = 1; index <= 6; index++) await saveBird(page, `${identification}-${index}`);
    const active = page.locator('.cached-view:not([hidden])');
    await expect(active.locator('.bird-list-row')).toHaveCount(7);
    await expect(page.getByRole('button', { name: /^CANCELADO-/ })).toHaveCount(0);
    const search = page.getByLabel('Buscar aves', { exact: true });
    await search.fill('Ave do atalho');
    await expect(active.locator('.bird-list-row')).toHaveCount(1);
    // Thumbnail preparation begins near the viewport; inspect the filtered row through a real scroll.
    await active.locator('.bird-list-photo').scrollIntoViewIfNeeded();
    const image = active.locator('.bird-list-photo img'); await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    if (layout.platform === 'web') {
      const dimensions = await active.locator('.bird-list-photo').boundingBox();
      expect(dimensions!.width).toBeCloseTo(layout.width === 360 ? 56 : 60, 0);
    }
    await page.screenshot({ path: testInfo.outputPath(`${layout.platform}-${layout.width}-${theme}-aves.png`) });
    await search.fill('');
    if (compact) {
      await shortcuts.getByRole('button', { name: 'Reprodução', exact: true }).click();
      await expect(page.locator('.page-title h1')).toHaveText('Reprodução');
      await expect(page.getByRole('button', { name: 'Casais', exact: true })).toBeVisible();
      await shortcuts.getByRole('button', { name: 'Comercial', exact: true }).click();
      await expect(page.locator('.page-title h1')).toHaveText('Resumo');
      await expect(page.getByRole('heading', { name: 'Resumo comercial', exact: true })).toBeVisible();
      await shortcuts.getByRole('button', { name: 'Hoje', exact: true }).click();
      await expect(page.locator('.page-title h1')).toHaveText('Hoje');
      await shortcuts.getByRole('button', { name: 'Abrir todos os menus', exact: true }).click();
      const primary = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
      await expect(primary.locator('button.nav-item')).toHaveCount(20);
      await expect(page.locator('#main-navigation')).toHaveCount(1);
      const geometry = await page.locator('.sidebar.open').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, wrap: getComputedStyle(element).flexWrap }));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1); expect(geometry.wrap).toBe('nowrap');
      await page.keyboard.press('Escape'); await expect(page.locator('.drawer-backdrop')).toHaveCount(0);
    }
    await navigateVisual(page, 'Casais'); await expect(page.getByRole('button', { name: 'Formar casal', exact: true })).toBeVisible();
    await navigateVisual(page, 'Financeiro'); await expect(page.getByRole('button', { name: 'Contas a receber', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Contas a pagar', exact: true })).toBeVisible();
    await navigateVisual(page, 'Configurações'); await navigateVisual(page, 'Reportar problema');
    await page.reload(); await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await navigateVisual(page, 'Aves'); await expect(active.locator('.bird-list-row')).toHaveCount(7);
    await search.fill('Ave do atalho'); await expect(page.getByRole('button', { name: `Ave do atalho · ${identification}`, exact: true })).toBeVisible(); await search.fill('');
    if (compact) {
      await page.evaluate(() => scrollTo(0, 0)); const before = await shortcuts.boundingBox();
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const after = await shortcuts.boundingBox(); expect(after!.y).toBeCloseTo(before!.y, 0); expect(after!.y + after!.height).toBeCloseTo(height, 0);
      const last = active.locator('.bird-list-open').last(), rect = await last.boundingBox(); expect(rect!.y + rect!.height).toBeLessThanOrEqual(after!.y - 8);
      expect(await last.evaluate(element => { const rect = element.getBoundingClientRect(); return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('.bird-list-open') === element; })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(errors).toEqual([]);
  });
}

test('Windows keeps the desktop sidebar and hides mobile bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await createVisualVault(page, 'dark', false);
  await page.evaluate(() => { document.documentElement.dataset.platform = 'desktop'; });
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'desktop');
  await expect(page.getByRole('navigation', { name: 'Navegação inferior', exact: true, includeHidden: true })).not.toBeVisible();
  await expect(page.getByRole('group', { name: 'Setor de trabalho', exact: true })).toBeVisible();
  await navigateVisual(page, 'Aves'); await expect(page.getByRole('button', { name: 'Novo', exact: true })).toBeVisible();
});
