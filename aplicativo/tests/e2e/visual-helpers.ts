import { expect, type Page, type Locator } from '@playwright/test';

export const visualMenus = [
  'Hoje', 'Aves', 'Casais', 'Reprodução', 'Parentesco', 'Saúde e manejo', 'Agenda',
  'Pessoas', 'Vendas e reservas', 'Financeiro', 'Materiais', 'Relatórios',
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
  await expect(page.getByRole('heading', { name: 'Hoje no criatório', exact: true })).toBeVisible();
  if (demo) {
    await clickVisualContextControl(page, 'Demonstração');
    await page.getByRole('button', { name: 'Criar exemplos fictícios', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Criar exemplos fictícios', exact: true })).toHaveCount(0);
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Reveal the existing context/theme control using its actual drawer/disclosure. */
export async function revealVisualContextControl(page: Page, name: string) {
  const control = page.getByRole('button', { name, exact: true, includeHidden: true });
  if (await control.isVisible()) return control;
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  const disclosure = control.locator('xpath=ancestor::details[not(@open)][1]');
  if (await disclosure.count()) await disclosure.locator(':scope > summary').click();
  await expect(control).toBeVisible();
  return control;
}

export async function clickVisualContextControl(page: Page, name: string) {
  await (await revealVisualContextControl(page, name)).click();
}

export async function navigateVisual(page: Page, name: string) {
  await expect(page.locator('.app-layout')).toBeVisible();
  const aliases: Record<string, string> = { 'Início': 'Hoje', 'Clientes e fornecedores': 'Pessoas', 'Estoque': 'Materiais' };
  const destinationName = aliases[name] ?? name;
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  // Sector selection is a real interaction, never a replacement data context.
  if (destinationName === 'Hoje' || destinationName === 'Resumo') {
    const sector = page.getByRole('group', { name: 'Setor de trabalho', exact: true });
    await sector.getByRole('button', { name: destinationName === 'Hoje' ? 'Criatório' : 'Comercial', exact: true }).click();
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  }
  const navigation = page.getByRole('navigation', { name: 'Navegação principal', includeHidden: true });
  const destination = navigation.getByRole('button', { name: destinationName, exact: true, includeHidden: true }).and(navigation.locator('button.nav-item'));
  const disclosure = destination.locator('xpath=ancestor::details[not(@open)][1]');
  if (await disclosure.count()) await disclosure.locator(':scope > summary').click();
  await destination.click();
  await expect(navigation.locator('button[aria-current="page"]')).toHaveText(destinationName);
  await expect(page.locator('.page-title h1')).toHaveText(destinationName);
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

/** Expand complementary form sections through their actual disclosure controls. */
export async function revealFormField(form: Locator, label: string) {
  await expect(form).toBeVisible();
  const field = form.getByLabel(label, { exact: true });
  let closed = field.locator('xpath=ancestor::details[not(@open)][last()]');
  for (let index = 0; index < 8 && await closed.count(); index++) {
    await closed.locator(':scope > summary').click();
    closed = field.locator('xpath=ancestor::details[not(@open)][last()]');
  }
  await expect(closed).toHaveCount(0);
  return field;
}

/** Independently decrypt only the isolated QA vault, to verify persisted relationships. */
export async function readVisualState(page: Page, password = visualPassword): Promise<import('../../src/domain/types').State> {
  return page.evaluate(async password => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('recanto-das-asas-private');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<any>((resolve, reject) => {
        const request = database.transaction('vault', 'readonly').objectStore('vault').get('vault');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const envelope = record.envelope;
      const bytes = (value: string) => Uint8Array.from(atob(value), letter => letter.charCodeAt(0));
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(envelope.salt), iterations: envelope.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(envelope.iv) }, key, bytes(envelope.ciphertext));
      return JSON.parse(new TextDecoder().decode(plain));
    } finally { database.close(); }
  }, password);
}
