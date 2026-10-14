import { test, expect, type Page } from '@playwright/test';
import { createVisualVault, navigateVisual, readVisualState, revealFormField, visualPassword, visualGeometry } from './visual-helpers';
import { dateLabel, today } from '../../src/domain/shared';

test.use({ actionTimeout: 15000 });
const active = (page: Page) => page.locator('.cached-view:not([hidden])');
function daysBefore(days: number) { const date = new Date(today() + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); }
async function register(page: Page, identification: string, name: string, sex = 'indeterminado') {
  await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
  for (const field of ['Identificação ou anilha *', 'Origem *', 'Nome']) await expect(form.getByRole('textbox', { name: field, exact: true })).toBeVisible();
  for (const field of ['Espécie *', 'Sexo *', 'Situação']) await expect(form.getByRole('combobox', { name: field, exact: true })).toBeVisible();
  await expect(form.getByLabel('Nome científico', { exact: true })).not.toBeVisible();
  await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(identification); await form.getByLabel('Nome', { exact: true }).fill(name);
  await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita'); await form.getByRole('combobox', { name: 'Sexo *', exact: true }).selectOption(sex);
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}
async function unlockAfterReload(page: Page) {
  await page.reload(); await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`stage 2 ${width}px ${theme}: one-click weights share health records, graph real dates and direct attachments persist`, async ({ page }, info) => {
    test.setTimeout(120000); await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    if (width === 390) await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
    await createVisualVault(page, theme, false); await register(page, 'QA-PESO-01', 'QA pesos');
    await page.getByRole('button', { name: 'QA pesos · QA-PESO-01', exact: true }).click();
    await expect(active(page).getByRole('button', { name: 'Pesar', exact: true })).toBeVisible();
    for (const [days, grams] of [[10, '90.4'], [7, '92'], [0, '91.5']] as const) {
      // Exactly one user action from the bird sheet, without a menu change or another bird selection.
      await active(page).getByRole('button', { name: 'Pesar', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Registrar peso', exact: true }); await expect(form).toBeVisible();
      await expect(form.getByText('QA pesos · QA-PESO-01', { exact: true })).toBeVisible();
      await expect(form.getByRole('combobox')).toHaveCount(0);
      await form.getByLabel('Peso (gramas) *', { exact: true }).fill(grams); await form.getByLabel('Data da pesagem *', { exact: true }).fill(daysBefore(days));
      await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
    }
    await expect(active(page).locator('.bird-profile-weight')).toContainText('91,5 g'); await expect(active(page).locator('.bird-profile-weight')).toContainText(dateLabel(today()));
    await page.getByRole('tab', { name: 'Saúde e peso', exact: true }).click();
    const graph = page.getByRole('img', { name: /^Evolução do peso: 3 pesagens registradas/ }); await expect(graph).toBeVisible(); await expect(graph.locator('circle')).toHaveCount(3);
    const coordinates = await graph.locator('circle').evaluateAll(points => points.map(point => Number(point.getAttribute('cx'))));
    expect(coordinates).toHaveLength(3); expect(coordinates[2]).toBeGreaterThan(coordinates[0]); expect((coordinates[1] - coordinates[0]) / (coordinates[2] - coordinates[0])).toBeCloseTo(0.3, 4);
    const weights = page.getByRole('list', { name: 'Lista de pesagens', exact: true }); await expect(weights.locator('li')).toHaveCount(3);
    for (const value of ['90,4 g', '92 g', '91,5 g']) await expect(weights).toContainText(value);
    await page.screenshot({ path: info.outputPath(`stage2-${width}-${theme}-pesos.png`), fullPage: true });
    await navigateVisual(page, 'Saúde e manejo'); await page.getByRole('button', { name: 'Ver histórico de QA pesos · QA-PESO-01', exact: true }).click();
    await expect(active(page).locator('.health-timeline li')).toHaveCount(3); await expect(active(page).locator('.health-timeline')).toContainText('91,5 g');
    await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'QA pesos · QA-PESO-01', exact: true }).click();
    await active(page).getByRole('button', { name: 'Anexar', exact: true }).click(); const form = page.getByRole('dialog', { name: 'Anexar à ave', exact: true });
    const original = Buffer.from('Arquivo fictício direto, vinculado à ave e preservado ao reabrir.');
    await (await revealFormField(form, 'Arquivos para anexar')).setInputFiles({ name: 'qa-ficha-direto.txt', mimeType: 'text/plain', buffer: original });
    await expect(form.getByText('qa-ficha-direto.txt', { exact: true })).toBeVisible(); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
    await unlockAfterReload(page); await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'QA pesos · QA-PESO-01', exact: true }).click();
    await expect(active(page).locator('.bird-profile-weight')).toContainText('91,5 g'); await page.getByRole('tab', { name: 'Arquivos / entrega', exact: true }).click();
    await expect(active(page)).toContainText('qa-ficha-direto.txt');
    const state = await readVisualState(page), bird = state.birds.find(bird => bird.identification === 'QA-PESO-01')!;
    expect(state.health.filter(record => record.birdId === bird.id).map(record => record.weightGrams).sort()).toEqual([90.4, 91.5, 92]);
    const file = state.attachments.find(file => file.fileName === 'qa-ficha-direto.txt')!; expect(file.birdId).toBe(bird.id); expect(Buffer.from(file.base64, 'base64')).toEqual(original);
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
  });
}

test('stage 2 pair, clutch, each egg and one unique hatchling retain parental links and history after reopening', async ({ page }) => {
  test.setTimeout(120000); await createVisualVault(page, 'light', false); await register(page, 'QA-PAI', 'QA pai', 'macho'); await register(page, 'QA-MAE', 'QA mãe', 'fêmea');
  await navigateVisual(page, 'Reprodução'); await active(page).getByRole('button', { name: 'Casais', exact: true }).click(); await page.getByRole('button', { name: 'Formar casal', exact: true }).click();
  let form = page.getByRole('dialog', { name: 'Formar casal', exact: true }); await form.getByLabel('Nome do casal *', { exact: true }).fill('QA casal');
  await form.getByRole('combobox', { name: 'Macho *', exact: true }).selectOption({ label: 'QA pai · QA-PAI · manejo' }); await form.getByRole('combobox', { name: 'Fêmea *', exact: true }).selectOption({ label: 'QA mãe · QA-MAE · manejo' });
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await active(page).getByRole('button', { name: 'Nova postura', exact: true }).click(); form = page.getByRole('dialog', { name: 'Registrar postura', exact: true });
  await expect(form.getByRole('combobox', { name: 'Casal *', exact: true })).not.toHaveValue(''); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await active(page).getByRole('button', { name: 'Posturas e ovos', exact: true }).click();
  for (let number = 1; number <= 2; number++) { await active(page).getByRole('button', { name: 'Registrar ovo', exact: true }).click(); form = page.getByRole('dialog', { name: 'Registrar ovo', exact: true }); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible(); }
  const eggs = active(page).locator('.egg-board'); await expect(eggs.locator('.egg-card')).toHaveCount(2); await expect(eggs).toContainText('Ainda não avaliada');
  await eggs.locator('.egg-card').first().getByRole('button', { name: 'Confirmar eclosão', exact: true }).click(); form = page.getByRole('dialog', { name: 'Confirmar eclosão do ovo 1', exact: true });
  await form.getByLabel('Identificação provisória ou anilha *', { exact: true }).fill('QA-FILHOTE'); await form.getByLabel('Nome', { exact: true }).fill('QA filhote'); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await expect(eggs.locator('.egg-card').first().getByRole('button', { name: 'Confirmar eclosão', exact: true })).toHaveCount(0);
  await eggs.locator('.egg-card').nth(1).getByRole('button', { name: 'Avaliar ovo', exact: true }).click(); form = page.getByRole('dialog', { name: 'Avaliar ovo 2', exact: true });
  await form.getByRole('combobox', { name: 'Resultado', exact: true }).selectOption('perdido'); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await active(page).getByRole('button', { name: 'Encerrar postura', exact: true }).click(); form = page.getByRole('dialog', { name: 'Encerrar postura', exact: true }); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await active(page).getByRole('button', { name: 'Filhotes', exact: true }).click(); await expect(active(page)).toContainText('QA filhote · QA-FILHOTE');
  await unlockAfterReload(page); const state = await readVisualState(page), chick = state.birds.find(bird => bird.identification === 'QA-FILHOTE')!, father = state.birds.find(bird => bird.identification === 'QA-PAI')!, mother = state.birds.find(bird => bird.identification === 'QA-MAE')!;
  expect(state.birds.filter(bird => bird.identification === 'QA-FILHOTE')).toHaveLength(1); expect(chick.fatherId).toBe(father.id); expect(chick.motherId).toBe(mother.id); expect(state.eggs.filter(egg => egg.chickId === chick.id)).toHaveLength(1); expect(state.eggs[0].clutchId).toBe(state.clutches[0].id); expect(state.eggs[0].chickId).toBe(chick.id); expect(state.clutches[0].endDate).toBe(today());
  await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'QA filhote · QA-FILHOTE', exact: true }).click(); await page.getByRole('tab', { name: 'Reprodução / parentesco', exact: true }).click(); await expect(active(page)).toContainText('QA pai · QA-PAI'); await expect(active(page)).toContainText('QA mãe · QA-MAE');
});
