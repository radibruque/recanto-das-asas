import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createVisualVault, visualMenus, visualPassword } from './visual-helpers';

async function createPhotoFile(page: Page, testInfo: TestInfo) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#054973';
    context.fillRect(0, 0, 160, 120);
    context.fillStyle = '#67994b';
    context.fillRect(12, 12, 136, 96);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const path = testInfo.outputPath('foto-ficticia-atalho.png');
  await writeFile(path, Buffer.from(encoded, 'base64'));
  return path;
}

async function saveBirdThroughShortcut(page: Page, shortcuts: Locator, identification: string, photo?: string) {
  await shortcuts.getByRole('button', { name: 'Cadastrar ave pelo atalho', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
  await expect(form).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(identification);
  await form.getByLabel('Nome', { exact: true }).fill(photo ? 'Ave do atalho' : `Ave ${identification}`);
  await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
  if (photo) {
    await form.getByLabel('Foto principal da ave', { exact: true }).setInputFiles(photo);
    await expect(form.getByText('foto-ficticia-atalho.png', { exact: true })).toBeVisible();
  }
  await form.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(form).not.toBeVisible();
}

for (const width of [360, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`web shortcuts perform all five actions, preserve records and stay clear of content at ${width}px in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 760 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createVisualVault(page, theme, false);
    const shortcuts = page.getByRole('navigation', { name: 'Atalhos rápidos', exact: true });
    await expect(shortcuts).toBeVisible();
    await expect(shortcuts.getByRole('button')).toHaveCount(5);

    // Cancellation must not require leaving Aves before reopening the shortcut.
    for (let attempt = 0; attempt < 2; attempt++) {
      await shortcuts.getByRole('button', { name: 'Cadastrar ave pelo atalho', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
      await expect(form).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(`CANCELADO-${attempt}`);
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.main-content > section')).toHaveCount(1);
    }
    const identification = `ATALHO-${width}-${theme}`;
    const photo = await createPhotoFile(page, testInfo);
    await saveBirdThroughShortcut(page, shortcuts, identification, photo);
    // A populated real UI fixture gives the page enough height to test scrolling.
    for (let index = 1; index <= 6; index++) await saveBirdThroughShortcut(page, shortcuts, `${identification}-${index}`);
    await shortcuts.getByRole('button', { name: 'Aves', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Aves');
    await expect(shortcuts.getByRole('button', { name: 'Aves', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.main-content .bird-list-row')).toHaveCount(7);
    await expect(page.getByRole('button', { name: /^CANCELADO-/ })).toHaveCount(0);
    await expect(page.locator('.main-content > section')).toHaveCount(1);

    const search = page.getByLabel('Buscar registros', { exact: true });
    await search.fill('Ave do atalho');
    await expect(page.locator('.main-content .bird-list-row')).toHaveCount(1);
    const record = page.locator('.main-content .bird-list-row').first();
    await expect(record.getByRole('button', { name: `Ave do atalho · ${identification}`, exact: true })).toBeVisible();
    const image = record.locator('.bird-list-photo img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const dimensions = await record.locator('.bird-list-photo').boundingBox();
    expect(dimensions).not.toBeNull();
    expect(dimensions!.width).toBeCloseTo(width === 360 ? 56 : 60, 0);
    expect(dimensions!.height).toBeCloseTo(width === 360 ? 56 : 60, 0);
    await search.fill('');

    await shortcuts.getByRole('button', { name: 'Casais', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Casais');
    await expect(shortcuts.getByRole('button', { name: 'Casais', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Formar casal', exact: true })).toBeVisible();
    await expect(page.locator('.main-content > section')).toHaveCount(1);
    await shortcuts.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Financeiro');
    await expect(shortcuts.getByRole('button', { name: 'Financeiro', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Contas a receber', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contas a pagar', exact: true })).toBeVisible();
    await expect(page.locator('.main-content > section')).toHaveCount(1);

    const openMenus = shortcuts.getByRole('button', { name: 'Abrir todos os menus', exact: true });
    const primary = page.getByRole('navigation', { name: 'Navegação principal', exact: true, includeHidden: true });
    const primaryElement = await primary.elementHandle();
    await openMenus.click();
    await expect(openMenus).toHaveAttribute('aria-expanded', 'true');
    await expect(primary).toBeVisible();
    await expect(primary.locator('button.nav-item')).toHaveCount(20);
    await expect(page.locator('#main-navigation')).toHaveCount(1);
    expect(await primary.evaluate((element, before) => element === before, primaryElement)).toBe(true);
    const drawerGeometry = await page.locator('.sidebar.open').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      wrapping: getComputedStyle(element).flexWrap,
    }));
    expect(drawerGeometry.scrollWidth).toBeLessThanOrEqual(drawerGeometry.clientWidth + 1);
    expect(drawerGeometry.wrapping).toBe('nowrap');
    await page.keyboard.press('Escape');
    await expect(openMenus).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.drawer-backdrop')).toHaveCount(0);
    await expect(page.locator('.page-title h1')).toHaveText('Financeiro');

    // Reuse the same twenty destinations, including the bottom of the drawer.
    const destinations = width === 1440 && theme === 'light' ? visualMenus : ['Configurações', 'Reportar problema'] as const;
    for (const destination of destinations) {
      await openMenus.click();
      await primary.getByRole('button', { name: destination, exact: true, includeHidden: true }).and(primary.locator('button.nav-item')).click();
      await expect(page.locator('.page-title h1')).toHaveText(destination);
      await expect(openMenus).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#main-navigation')).toHaveCount(1);
    }

    await page.reload();
    await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword);
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Painel Criatório', exact: true })).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Aves', exact: true }).click();
    await expect(page.locator('.main-content .bird-list-row')).toHaveCount(7);
    await page.getByLabel('Buscar registros', { exact: true }).fill('Ave do atalho');
    await expect(page.getByRole('button', { name: `Ave do atalho · ${identification}`, exact: true })).toBeVisible();
    await page.getByLabel('Buscar registros', { exact: true }).fill('');

    await page.evaluate(() => scrollTo(0, 0));
    const beforeScroll = await shortcuts.boundingBox();
    expect(beforeScroll).not.toBeNull();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const afterScroll = await shortcuts.boundingBox();
    expect(afterScroll).not.toBeNull();
    expect(afterScroll!.y).toBeCloseTo(beforeScroll!.y, 0);
    expect(afterScroll!.y + afterScroll!.height).toBeCloseTo(760, 0);
    const last = page.locator('.main-content .bird-list-open').last();
    const lastPosition = await last.boundingBox();
    expect(lastPosition).not.toBeNull();
    expect(lastPosition!.y + lastPosition!.height).toBeLessThanOrEqual(afterScroll!.y - 8);
    expect(await last.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('.bird-list-open') === element;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await primaryElement?.dispose();
  });
}

for (const width of [360, 390, 1280]) for (const theme of ['light', 'dark'] as const) {
  test(`native Android shortcuts perform all five actions and preserve the viewport at ${width}px in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const height = 760;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Exercise Capacitor's Android branch, including a wide tablet viewport.
    await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
    await createVisualVault(page, theme, false);
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'android');
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'android');
    const shortcuts = page.getByRole('navigation', { name: 'Atalhos rápidos', exact: true });
    await expect(shortcuts).toBeVisible();
    await expect(shortcuts.getByRole('button')).toHaveCount(5);
    const iconLayout = await shortcuts.getByRole('button').evaluateAll(buttons => buttons.every(button => {
      const icon = button.querySelector('svg')?.getBoundingClientRect();
      const label = button.querySelector('span')?.getBoundingClientRect();
      return !!icon && !!label && icon.bottom <= label.top + 1;
    }));
    expect(iconLayout).toBe(true);

    for (let attempt = 0; attempt < 2; attempt++) {
      await shortcuts.getByRole('button', { name: 'Cadastrar ave pelo atalho', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
      await expect(form).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(`ANDROID-CANCELADO-${attempt}`);
      if (attempt === 1 && width < 900) {
        // Approximate the viewport reduction caused by an on-screen keyboard.
        await page.setViewportSize({ width, height: 430 });
        await form.getByLabel('Nome', { exact: true }).fill('Cadastro fictício cancelado');
        const button = form.getByRole('button', { name: 'Cancelar', exact: true });
        await button.scrollIntoViewIfNeeded();
        const position = await button.boundingBox();
        expect(position).not.toBeNull();
        expect(position!.y).toBeGreaterThanOrEqual(0);
        expect(position!.y + position!.height).toBeLessThanOrEqual(430);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.setViewportSize({ width, height });
    }

    const identification = `ANDROID-ATALHO-${width}-${theme}`;
    await saveBirdThroughShortcut(page, shortcuts, identification, await createPhotoFile(page, testInfo));
    for (let index = 1; index <= 6; index++) await saveBirdThroughShortcut(page, shortcuts, `${identification}-${index}`);
    await shortcuts.getByRole('button', { name: 'Aves', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Aves');
    await expect(shortcuts.getByRole('button', { name: 'Aves', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.main-content > section')).toHaveCount(1);
    await expect(page.locator('.main-content .bird-list-row')).toHaveCount(7);
    await expect(page.getByRole('button', { name: /^ANDROID-CANCELADO-/ })).toHaveCount(0);
    await page.getByLabel('Buscar registros', { exact: true }).fill('Ave do atalho');
    const photo = page.locator('.main-content .bird-list-photo img');
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`android-${width}-${theme}-aves.png`) });
    await page.getByLabel('Buscar registros', { exact: true }).fill('');

    await shortcuts.getByRole('button', { name: 'Casais', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Casais');
    await expect(page.getByRole('button', { name: 'Formar casal', exact: true })).toBeVisible();
    await expect(shortcuts.getByRole('button', { name: 'Casais', exact: true })).toHaveAttribute('aria-current', 'page');
    await shortcuts.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await expect(page.locator('.page-title h1')).toHaveText('Financeiro');
    await expect(page.getByRole('button', { name: 'Contas a receber', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contas a pagar', exact: true })).toBeVisible();
    await expect(page.locator('.main-content > section')).toHaveCount(1);
    await expect(shortcuts.getByRole('button', { name: 'Financeiro', exact: true })).toHaveAttribute('aria-current', 'page');

    const openMenus = shortcuts.getByRole('button', { name: 'Abrir todos os menus', exact: true });
    const primary = page.getByRole('navigation', { name: 'Navegação principal', exact: true, includeHidden: true });
    await openMenus.click();
    await expect(openMenus).toHaveAttribute('aria-expanded', 'true');
    await expect(primary).toBeVisible();
    await expect(primary.locator('button.nav-item')).toHaveCount(20);
    await expect(page.locator('#main-navigation')).toHaveCount(1);
    expect(await page.locator('.sidebar.open').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await primary.getByRole('button', { name: 'Reportar problema', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`android-${width}-${theme}-menus.png`) });
    await page.keyboard.press('Escape');
    await expect(openMenus).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.drawer-backdrop')).toHaveCount(0);
    await expect(page.locator('.page-title h1')).toHaveText('Financeiro');
    for (const destination of ['Saúde e manejo', 'Reportar problema'] as const) {
      await openMenus.click();
      await primary.getByRole('button', { name: destination, exact: true }).and(primary.locator('button.nav-item')).click();
      await expect(page.locator('.page-title h1')).toHaveText(destination);
      await expect(openMenus).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#main-navigation')).toHaveCount(1);
    }

    await page.reload();
    await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword);
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Painel Criatório', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'android');
    await shortcuts.getByRole('button', { name: 'Aves', exact: true }).click();
    await expect(page.locator('.main-content .bird-list-row')).toHaveCount(7);
    await page.getByLabel('Buscar registros', { exact: true }).fill('Ave do atalho');
    await expect(page.getByRole('button', { name: `Ave do atalho · ${identification}`, exact: true })).toBeVisible();
    await page.getByLabel('Buscar registros', { exact: true }).fill('');
    await page.evaluate(() => scrollTo(0, 0));
    const before = await shortcuts.boundingBox();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const after = await shortcuts.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after!.y).toBeCloseTo(before!.y, 0);
    expect(after!.y + after!.height).toBeCloseTo(height, 0);
    const last = page.locator('.main-content .bird-list-open').last();
    const position = await last.boundingBox();
    expect(position).not.toBeNull();
    expect(position!.y + position!.height).toBeLessThanOrEqual(after!.y - 8);
    expect(await last.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('.bird-list-open') === element;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`android-${width}-${theme}-aves-rolada.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Windows presentation hides web-only shortcuts without changing the native layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createVisualVault(page, 'light', false);
  // A browser cannot launch app://recanto. Inspect only the documented CSS scope.
  await page.evaluate(() => { document.documentElement.dataset.platform = 'desktop'; });
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'desktop');
  await expect(page.getByRole('navigation', { name: 'Atalhos rápidos', exact: true, includeHidden: true })).not.toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true }).locator('button.nav-item')).toHaveCount(20);
});
