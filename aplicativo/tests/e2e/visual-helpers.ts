import { expect, type Page } from '@playwright/test';

export const visualMenus = [
  'Início', 'Aves', 'Casais', 'Reprodução', 'Parentesco', 'Saúde e manejo', 'Agenda',
  'Clientes e fornecedores', 'Vendas e reservas', 'Financeiro', 'Estoque', 'Relatórios',
  'Documentos', 'Caderneta do pet', 'Identidade visual', 'Backup e recuperação',
  'Sincronização', 'Configurações', 'Atualizações', 'Reportar problema',
] as const;
export const visualPassword = 'senha-ficticia-qa-visual';

/** Each Playwright context owns an isolated, fictitious vault. */
export async function createVisualVault(page: Page, theme: 'light' | 'dark' = 'light', demo = true) {
  await page.addInitScript(value => localStorage.setItem('recanto.ui.theme', value), theme);
  await page.goto('/');
  await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(visualPassword);
  await page.getByRole('button', { name: 'Criar base privada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Painel Criatório', exact: true })).toBeVisible();
  if (demo) {
    await page.getByRole('button', { name: 'Demonstração', exact: true }).click();
    await page.getByRole('button', { name: 'Criar exemplos fictícios', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Criar exemplos fictícios', exact: true })).toHaveCount(0);
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

export async function navigateVisual(page: Page, name: typeof visualMenus[number]) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  const navigation = page.getByRole('navigation', { name: 'Navegação principal', includeHidden: true });
  await navigation.getByRole('button', { name, exact: true }).click();
  await expect(navigation.locator('button[aria-current="page"]')).toHaveText(name);
  await expect(page.locator('.page-title h1')).toHaveText(name);
}

export async function visualGeometry(page: Page) {
  return page.evaluate(() => {
    const overlaps: string[] = [];
    for (const group of document.querySelectorAll('.toolbar,.row,.tabs,.theme-options')) {
      const controls = Array.from(group.querySelectorAll<HTMLElement>(':scope > button,:scope > label'))
        .filter(element => element.offsetWidth > 0 && element.offsetHeight > 0);
      for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
        const first = controls[a].getBoundingClientRect(), second = controls[b].getBoundingClientRect();
        if (Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
            Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1) {
          overlaps.push(`${controls[a].textContent?.trim()} / ${controls[b].textContent?.trim()}`);
        }
      }
    }
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, overlaps };
  });
}
