import { test, expect } from '@playwright/test';
import { createVisualVault, navigateVisual, visualGeometry, visualMenus } from './visual-helpers';

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 1000 }]) {
    test(`all 20 screens remain navigable and fit ${viewport.width}px in ${theme} theme`, async ({ page }) => {
      test.setTimeout(180000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await createVisualVault(page, theme);
      await expect(page.getByRole('navigation', { name: 'Navegação principal', includeHidden: true }).locator('.nav-item')).toHaveCount(20);
      for (const name of visualMenus) {
        await test.step(name, async () => {
          await navigateVisual(page, name);
          expect(await visualGeometry(page), `${name}, ${theme}, ${viewport.width}px`).toEqual({ overflow: false, overlaps: [] });
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        });
      }
      expect(errors).toEqual([]);
    });
  }

  test(`bird forms, health history and finance dialogs fit mobile in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createVisualVault(page, theme);
    await navigateVisual(page, 'Aves');
    await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Identificação ou anilha *', { exact: true })).toBeVisible();
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Azul · EX-001', exact: true }).click();
    await expect(page.getByRole('tablist', { name: 'Ficha da ave' })).toBeVisible();
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await page.getByRole('button', { name: 'Novo manejo', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Título *', { exact: true })).toBeVisible();
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await navigateVisual(page, 'Financeiro');
    await page.getByRole('button', { name: 'Contas a receber', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Contas a receber' });
    await expect(dialog).toBeVisible();
    expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  });

  test(`empty bird, health, agenda and documents states remain usable in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await createVisualVault(page, theme, false);
    for (const name of ['Aves', 'Saúde e manejo', 'Agenda', 'Documentos'] as const) {
      await navigateVisual(page, name);
      expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
      await expect(page.locator('.main-content')).toBeVisible();
    }
  });

  test(`long records wrap and existing search still filters a populated plantel in ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await createVisualVault(page, theme, false);
    await navigateVisual(page, 'Aves');
    const longName = 'Ave de acompanhamento com identificação e histórico detalhados '.repeat(2).trim();
    for (let index = 0; index < 8; index++) {
      await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
      const form = page.getByRole('dialog');
      await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(`VISUAL-LONGO-${index}-${'A'.repeat(100)}`);
      await form.getByLabel('Nome', { exact: true }).fill(longName);
      await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
      await form.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(form).not.toBeVisible();
    }
    await expect(page.getByRole('button', { name: /VISUAL-LONGO-/ })).toHaveCount(8);
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await visualGeometry(page), `${width}px populated plantel`).toEqual({ overflow: false, overlaps: [] });
    }
    await page.getByLabel('Buscar aves', { exact: true }).fill('VISUAL-LONGO-7');
    await expect(page.getByRole('button', { name: /VISUAL-LONGO-/ })).toHaveCount(1);
    await page.getByRole('button', { name: /VISUAL-LONGO-7/ }).click();
    expect(await visualGeometry(page), 'Long bird sheet').toEqual({ overflow: false, overlaps: [] });
  });
}
