import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createVisualVault, navigateVisual, revealVisualContextControl, visualGeometry } from './visual-helpers';

const birdName = 'Ave de teste visual';
const birdIdentification = 'VISUAL-BC-FOTO';
const birdLabel = `${birdName} · ${birdIdentification}`;
const healthTitle = 'Pesagem de acompanhamento visual';
const healthNotes = 'Observação fictícia preservada nos detalhes do registro.';
const documentBytes = Buffer.from('Laudo fictício para validação visual. Sem informações pessoais.');

/** Registration goes through the app; every test uses its own empty browser vault. */
async function registerVisualBirds(page: Page) {
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 110;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#054973';
    context.fillRect(0, 0, 160, 110);
    context.fillStyle = '#67994b';
    context.fillRect(15, 15, 130, 80);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await navigateVisual(page, 'Aves');
  for (const withPhoto of [true, false]) {
    await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Cadastrar ave' });
    await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(withPhoto ? birdIdentification : 'VISUAL-BC-SEM-FOTO');
    await form.getByLabel('Nome', { exact: true }).fill(withPhoto ? birdName : 'Ave sem fotografia');
    await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
    await form.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('disponível');
    if (withPhoto) {
      await form.getByLabel('Foto principal da ave', { exact: true }).setInputFiles({ name: 'foto-qa.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
      await expect(form.getByText('foto-qa.png', { exact: true })).toBeVisible();
    }
    await form.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(form).not.toBeVisible();
  }
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

for (const layout of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'android', width: 390, height: 844 },
] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${layout.name} ${theme}: home photos, horizontal bird rows and profile history retain real actions`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createVisualVault(page, theme, false);
    await registerVisualBirds(page);
    await navigateVisual(page, 'Início');
    await expect(page.locator('html')).toHaveAttribute('data-layout', layout.name);
    const overview = page.locator('.overview-birds');
    await expect(overview.locator('.bird-list-row')).toHaveCount(2);
    const homeBird = overview.locator('.bird-list-row').filter({ has: page.getByRole('button', { name: birdLabel, exact: true }) });
    await expect(homeBird.getByRole('button', { name: birdLabel, exact: true })).toBeVisible();
    const homePhoto = homeBird.locator('.bird-list-photo img');
    await expect(homePhoto).toHaveCount(1);
    await expect.poll(() => homePhoto.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const missingPhoto = overview.locator('.bird-list-row').filter({ hasText: 'VISUAL-BC-SEM-FOTO' });
    await expect(missingPhoto.locator('.bird-list-photo img')).toHaveCount(0);
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await capture(page, testInfo, 'inicio');
    await homeBird.getByRole('button', { name: birdLabel, exact: true }).click();
    await expect(page.locator('.bird-profile-name')).toContainText(birdName);
    await page.getByRole('button', { name: 'Voltar à lista', exact: true }).click();

    await navigateVisual(page, 'Aves');
    const collection = page.locator('.breeding .bird-list-items');
    await expect(collection).toHaveJSProperty('tagName', 'UL');
    await expect(collection.locator(':scope > .bird-list-row')).toHaveCount(2);
    const row = collection.locator('.bird-list-row').filter({ hasText: birdIdentification });
    await expect(row).toHaveJSProperty('tagName', 'LI');
    const picture = await row.locator('.bird-list-photo').boundingBox();
    const identity = await row.locator('.bird-list-identity').boundingBox();
    expect(picture && identity).toBeTruthy();
    expect(picture!.x + picture!.width).toBeLessThanOrEqual(identity!.x + 1);
    expect(Math.min(picture!.y + picture!.height, identity!.y + identity!.height) - Math.max(picture!.y, identity!.y)).toBeGreaterThan(0);
    const nameWeight = await row.locator('.bird-list-name').evaluate(element => Number.parseInt(getComputedStyle(element).fontWeight, 10));
    expect(nameWeight).toBeGreaterThanOrEqual(700);
    await capture(page, testInfo, 'aves-lista-horizontal');
    await page.getByLabel('Buscar aves', { exact: true }).fill(birdIdentification);
    await expect(collection.locator('.bird-list-row')).toHaveCount(1);
    await page.getByRole('button', { name: birdLabel, exact: true }).click();
    await expect(page.locator('.bird-profile-name')).toContainText(birdName);
    await expect(page.locator('.bird-profile-photo img')).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Ficha da ave' })).toBeVisible();

    await page.getByRole('button', { name: 'Novo manejo', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Registrar saúde ou manejo' });
    await form.getByLabel('Título *', { exact: true }).fill(healthTitle);
    await form.getByLabel('Peso (gramas)', { exact: true }).fill('91.5');
    await form.getByLabel('Observações', { exact: true }).fill(healthNotes);
    await form.getByLabel('Arquivos para anexar', { exact: true }).setInputFiles({ name: 'laudo-qa.txt', mimeType: 'text/plain', buffer: documentBytes });
    await expect(form.getByText('laudo-qa.txt', { exact: true })).toBeVisible();
    await form.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(form).not.toBeVisible();
    await expect(page.locator('.bird-profile-weight')).toContainText('91,5');
    const history = page.locator('.bird-recent-health .health-timeline');
    await expect(history.locator('li')).toHaveCount(1);
    await expect(history).toContainText(healthTitle);
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await capture(page, testInfo, 'ficha-com-historico');
    await history.getByRole('button', { name: `Ver registro: ${healthTitle}`, exact: true }).click();
    const details = page.getByRole('dialog', { name: healthTitle });
    await expect(details).toContainText(healthNotes);
    await expect(details).toContainText('91,5 g');
    await expect(details).toContainText('laudo-qa.txt');
    const download = page.waitForEvent('download');
    await details.getByRole('button', { name: 'Baixar original', exact: true }).click();
    expect(await readFile((await (await download).path())!)).toEqual(documentBytes);
    await details.getByRole('button', { name: 'Voltar ao histórico', exact: true }).click();
    await page.getByRole('tab', { name: 'Saúde e peso', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Evolução do peso', exact: true })).toBeVisible();
    await expect(page.locator('.health-timeline')).toContainText(healthTitle);
    expect(errors).toEqual([]);
  });
}

test('native Android keeps the concept C layout even on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Simulate Capacitor's documented Android bridge only in this test context.
  await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
  await createVisualVault(page, 'dark', false);
  await expect(page.locator('html')).toHaveAttribute('data-platform', 'android');
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'android');
  await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeVisible();
  await navigateVisual(page, 'Aves');
  await expect(page.locator('.page-title h1')).toHaveText('Aves');
  expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
});

for (const width of [390, 1440]) test(`system preference changes palette while keeping the chosen layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await createVisualVault(page, 'dark', false);
  await revealVisualContextControl(page, 'Sistema');
  const chooser = page.getByRole('group', { name: 'Tema da interface' });
  await chooser.getByRole('button', { name: 'Sistema', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-layout', width > 900 ? 'desktop' : 'android');
  expect(await page.evaluate(() => localStorage.getItem('recanto.ui.theme'))).toBe('system');
});
