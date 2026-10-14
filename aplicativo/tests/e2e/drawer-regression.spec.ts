import { test, expect, type Page } from '@playwright/test';
import { createVisualVault, visualMenus } from './visual-helpers';

async function drawerGeometry(page: Page) {
  return page.locator('.sidebar').evaluate(sidebar => {
    const rect = (element: Element) => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const navigation = sidebar.querySelector('#main-navigation')!;
    return {
      panel: rect(sidebar),
      clientWidth: sidebar.clientWidth,
      scrollWidth: sidebar.scrollWidth,
      scrollTop: sidebar.scrollTop,
      brand: rect(sidebar.querySelector('.brand')!),
      navigation: rect(navigation),
      footer: rect(sidebar.querySelector('.sidebar-footer')!),
      destinations: Array.from(navigation.querySelectorAll('.nav-item'), item => ({
        name: item.textContent?.trim(), ...rect(item),
      })),
    };
  });
}

for (const layout of [
  { platform: 'android', width: 390, height: 844 },
  { platform: 'android', width: 360, height: 640 },
  { platform: 'web', width: 390, height: 844 },
] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${layout.platform} ${layout.width}px ${theme}: drawer stays in one column while scrolling and reopening`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (layout.platform === 'android') {
      await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
    }
    await createVisualVault(page, theme, false);
    await expect(page.locator('html')).toHaveAttribute('data-platform', layout.platform);
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'android');
    const opener = page.getByRole('button', { name: 'Abrir menu', exact: true });
    const sidebar = page.locator('.sidebar');
    await opener.click();
    await expect(sidebar).toHaveClass(/\bopen\b/);
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    const initial = await drawerGeometry(page);
    // All destinations must occupy the same visible panel, not columns to its right.
    expect(initial.scrollWidth).toBeLessThanOrEqual(initial.clientWidth + 1);
    expect(initial.navigation.x).toBeGreaterThanOrEqual(initial.panel.x);
    expect(initial.navigation.right).toBeLessThanOrEqual(initial.panel.right + 1);
    expect(initial.navigation.y).toBeGreaterThanOrEqual(initial.brand.bottom);
    expect(initial.footer.y).toBeGreaterThanOrEqual(initial.navigation.bottom);
    expect(initial.destinations.map(item => item.name).sort()).toEqual([...visualMenus].sort());
    for (const item of initial.destinations) {
      expect(item.x, item.name).toBeGreaterThanOrEqual(initial.panel.x);
      expect(item.right, item.name).toBeLessThanOrEqual(initial.panel.right + 1);
    }
    await sidebar.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const bottom = await drawerGeometry(page);
    expect(bottom.scrollTop).toBeGreaterThan(initial.scrollTop);
    expect(Math.abs(bottom.navigation.x - initial.navigation.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(bottom.footer.x - initial.footer.x)).toBeLessThanOrEqual(1);
    expect(bottom.scrollWidth).toBeLessThanOrEqual(bottom.clientWidth + 1);
    const lock = sidebar.getByRole('button', { name: 'Bloquear', exact: true });
    await expect(lock).toBeInViewport({ ratio: 1 });
    const footerCapture = testInfo.outputPath('menu-rodape-acessivel.png');
    await page.screenshot({ path: footerCapture });
    await testInfo.attach('Menu com rodapé acessível', { path: footerCapture, contentType: 'image/png' });
    await sidebar.evaluate(element => { element.scrollTop = 0; });
    await expect(sidebar.getByRole('button', { name: 'Hoje', exact: true })).toBeInViewport({ ratio: 1 });

    // Exercise the existing close action using the keyboard, then open afresh.
    const close = page.getByRole('button', { name: 'Fechar menu', exact: true });
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(sidebar).not.toHaveClass(/\bopen\b/);
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await opener.click();
    const reopened = await drawerGeometry(page);
    expect(reopened.scrollWidth).toBeLessThanOrEqual(reopened.clientWidth + 1);
    expect(reopened.navigation.x).toBeCloseTo(initial.navigation.x, 0);
    await sidebar.getByRole('button', { name: 'Aves', exact: true }).click();
    await expect(sidebar).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('.page-title h1')).toHaveText('Aves');
  });
}
