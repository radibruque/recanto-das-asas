import { test, expect, type Page } from '@playwright/test';
import { createVisualVault, navigateVisual, revealVisualContextControl } from './visual-helpers';

/** Inspect rendered text against solid ancestor backgrounds, not image artwork. */
async function textContrastFailures(page: Page) {
  return page.evaluate(() => {
    type Color = [number, number, number, number];
    const parse = (css: string): Color | null => {
      const match = css.match(/^rgba?\(([^)]+)\)$/);
      if (!match) return null;
      const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const blend = (front: Color, back: Color): Color => [
      front[0] * front[3] + back[0] * (1 - front[3]),
      front[1] * front[3] + back[1] * (1 - front[3]),
      front[2] * front[3] + back[2] * (1 - front[3]), 1,
    ];
    const luminance = (color: Color) => color.slice(0, 3).map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    function background(element: Element): Color | null {
      const layers: Color[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.backgroundImage !== 'none' || Number(style.opacity) < 1) return null;
        const color = parse(style.backgroundColor);
        if (color) layers.push(color);
        if (color && color[3] === 1) break;
      }
      let result: Color = [255, 255, 255, 1];
      for (const layer of layers.reverse()) result = blend(layer, result);
      return result;
    }
    const failures: Array<{ text: string; foreground: string; background: number[]; ratio: number; required: number }> = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, text = node.textContent?.trim(), element = node.parentElement;
      if (!text || !element || ['SCRIPT', 'STYLE', 'OPTION'].includes(element.tagName) || element.closest('[aria-hidden="true"],button:disabled,input:disabled,select:disabled,textarea:disabled')) continue;
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top >= innerHeight || rect.right < 0 || rect.left >= innerWidth || style.visibility !== 'visible') continue;
      const foreground = parse(style.color), back = background(element);
      if (!foreground || !back) continue;
      const size = Number.parseFloat(style.fontSize), weight = Number.parseInt(style.fontWeight, 10);
      const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      const lightA = luminance(blend(foreground, back)), lightB = luminance(back);
      const ratio = (Math.max(lightA, lightB) + 0.05) / (Math.min(lightA, lightB) + 0.05);
      const signature = `${style.color}|${back.join(',')}|${required}`;
      if (ratio + 0.001 < required && !seen.has(signature)) {
        seen.add(signature);
        failures.push({ text: text.slice(0, 80), foreground: style.color, background: back.slice(0, 3), ratio: Number(ratio.toFixed(3)), required });
      }
    }
    return failures;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`rendered text uses AA contrast on shared surfaces and sample records in ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createVisualVault(page, theme);
    for (const screen of ['Início', 'Aves', 'Saúde e manejo', 'Agenda', 'Clientes e fornecedores', 'Vendas e reservas', 'Financeiro', 'Documentos', 'Configurações', 'Sincronização'] as const) {
      await navigateVisual(page, screen);
      expect(await textContrastFailures(page), screen).toEqual([]);
    }
    await navigateVisual(page, 'Aves');
    await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await textContrastFailures(page), 'Bird form').toEqual([]);
  });

  test(`keyboard focus is visible and reduced motion is respected in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(value => localStorage.setItem('recanto.ui.theme', value), theme);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Crie sua base privada', exact: true })).toBeVisible();
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement, style = getComputedStyle(element);
        return { tag: element.tagName, visible: element.matches(':focus-visible'), outline: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2 };
      });
      expect(focus.tag).not.toBe('BODY');
      expect(focus.visible).toBe(true);
      expect(focus.outline).toBe(true);
    }
    const motion = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button,input,.gate-card'));
      return elements.every(element => {
        const style = getComputedStyle(element);
        return [...style.animationDuration.split(','), ...style.transitionDuration.split(',')].every(value => Number.parseFloat(value) <= 0.01);
      });
    });
    expect(motion).toBe(true);
  });
}

test('mobile menu and form controls keep accessible names and comfortable targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createVisualVault(page, 'light');
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  const target = await menu.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(40);
  expect(target?.height).toBeGreaterThanOrEqual(40);
  await navigateVisual(page, 'Aves');
  await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Identificação ou anilha *', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Espécie *', { exact: true })).toBeVisible();
  for (const name of ['Salvar', 'Cancelar'] as const) {
    const button = dialog.getByRole('button', { name, exact: true });
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(40);
    expect(bounds?.width).toBeGreaterThanOrEqual(40);
  }
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('closed mobile navigation stays outside keyboard focus and exposes its open state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createVisualVault(page, 'light');
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.session-menu').getByRole('button', { name: 'Bloquear', exact: true, includeHidden: true })).toHaveCount(1);
  await page.keyboard.press('Tab');
  const closedFocus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement, rect = active.getBoundingClientRect();
    return { inClosedSidebar: !!active.closest('.sidebar:not(.open)'), insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight };
  });
  expect(closedFocus).toEqual({ inClosedSidebar: false, insideViewport: true });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).locator('.nav-item')).toHaveCount(20);
  await expect(await revealVisualContextControl(page, 'Bloquear')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).click({ position: { x: 380, y: 100 } });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
});
