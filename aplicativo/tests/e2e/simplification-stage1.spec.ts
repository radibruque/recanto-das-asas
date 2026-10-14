import { test, expect, type Page } from '@playwright/test';
import { createVisualVault, navigateVisual, visualMenus, visualPassword, visualGeometry } from './visual-helpers';

test.use({ actionTimeout: 15000 });

const activeView = (page: Page) => page.locator('.cached-view:not([hidden])');
const statistic = (page: Page, label: string) => activeView(page).locator('button.stat-card').filter({ has: page.getByText(label, { exact: true }) });
const money = (amount: string) => new RegExp(`R\\$\\s*${amount.replace('.', '\\.').replace(',', ',')}`);
async function addBird(page: Page, id: string, name: string, file = false) {
  await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
  await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(id);
  await form.getByLabel('Nome', { exact: true }).fill(name);
  await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita');
  await form.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('disponível');
  if (file) {
    const input = form.getByLabel('Arquivos para anexar', { exact: true });
    const details = input.locator('xpath=ancestor::details[not(@open)][1]'); if (await details.count()) await details.locator(':scope > summary').click();
    await input.setInputFiles({ name: 'qa-documento.txt', mimeType: 'text/plain', buffer: Buffer.from('CONTEUDO-NAO-INDEXAVEL de documento fictício e isolado.') });
    await expect(form.getByText('qa-documento.txt', { exact: true })).toBeVisible();
    await form.getByLabel('Título do arquivo', { exact: true }).fill('QA documento inicial');
  }
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}
async function openSale(page: Page) {
  await navigateVisual(page, 'Vendas e reservas');
  await activeView(page).getByRole('button', { name: 'Ver operação e pagamentos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Operação / }); await expect(dialog).toBeVisible(); return dialog;
}
async function receive(page: Page, amount: string) {
  const sale = await openSale(page); await sale.getByRole('button', { name: 'Registrar pagamento parcial', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Confirmar recebimento', exact: true });
  await form.getByRole('combobox', { name: 'Conta financeira', exact: true }).selectOption({ label: 'QA caixa' });
  await form.getByLabel('Valor confirmado (R$)', { exact: true }).fill(amount);
  await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}
async function commercialFixture(page: Page) {
  await addBird(page, 'QA-ANEL-01', 'QA Azul', true); await addBird(page, 'QA-ANEL-02', 'QA Lua');
  await navigateVisual(page, 'Pessoas'); await page.getByRole('button', { name: 'Novo contato', exact: true }).click();
  let form = page.getByRole('dialog', { name: 'Cadastro de contato' }); await form.getByLabel('Nome', { exact: true }).fill('QA cliente');
  await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await navigateVisual(page, 'Financeiro'); await page.getByRole('button', { name: 'Nova conta financeira', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Conta financeira' }); await form.getByLabel('Nome da conta', { exact: true }).fill('QA caixa');
  await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  await navigateVisual(page, 'Vendas e reservas'); await page.getByRole('button', { name: 'VENDA', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Registrar venda' });
  await form.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption({ label: 'QA cliente' });
  await form.getByRole('combobox', { name: 'Ave', exact: true }).selectOption({ label: 'QA Azul · QA-ANEL-01 · disponível' });
  await form.getByLabel('Valor unitário (R$)', { exact: true }).fill('400,00');
  await form.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  const second = form.locator('fieldset.sale-item-form').nth(1);
  await second.getByRole('combobox', { name: 'Tipo do item', exact: true }).selectOption('ave');
  await second.getByRole('combobox', { name: 'Ave', exact: true }).selectOption({ label: 'QA Lua · QA-ANEL-02 · disponível' });
  await second.getByLabel('Valor unitário (R$)', { exact: true }).fill('600,00');
  await form.getByLabel('Número de parcelas', { exact: true }).fill('2');
  await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`stage 1 ${width}px ${theme}: integrated sectors retain all destinations and contextual creation`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await createVisualVault(page, theme, true);
    const primary = page.getByRole('navigation', { name: 'Navegação principal', includeHidden: true });
    await expect(primary.locator('button.nav-item')).toHaveCount(20);
    if (width === 1440) {
      await expect(primary.locator(':scope > button.nav-item')).toHaveText(['Hoje', 'Aves', 'Reprodução', 'Saúde e manejo', 'Agenda']);
      await page.getByRole('group', { name: 'Setor de trabalho', exact: true }).getByRole('button', { name: 'Comercial', exact: true }).click();
    } else {
      const bottom = page.getByRole('navigation', { name: 'Navegação inferior', exact: true });
      await expect(bottom.getByRole('button')).toHaveCount(5); expect(await bottom.getByRole('button').allTextContents()).toEqual(['Hoje', 'Aves', 'Reprodução', 'Comercial', 'Mais']);
      await expect(bottom.getByRole('button', { name: /Novo/ })).toHaveCount(0); await bottom.getByRole('button', { name: 'Comercial', exact: true }).click();
    }
    await expect(page.locator('.page-title h1')).toHaveText('Resumo'); await expect(page.getByLabel('Buscar vendas', { exact: true })).toBeVisible();
    await expect(activeView(page).getByRole('button', { name: /Vendas realizadas|Recebido em vendas|Em aberto de vendas|Entregas pendentes/ })).toHaveCount(4);
    if (width === 1440) await expect(primary.locator(':scope > button.nav-item')).toHaveText(['Resumo', 'Vendas e reservas', 'Pessoas', 'Financeiro', 'Materiais']);
    await navigateVisual(page, 'Aves'); await expect(page.getByRole('button', { name: 'Pingo · EX-003', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Setor de trabalho', exact: true, includeHidden: true }).getByRole('button', { name: 'Criatório', includeHidden: true, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Novo', exact: true }).click(); const form = page.getByRole('dialog', { name: 'Cadastrar ave' }); await expect(form).toBeVisible(); await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
    for (const name of visualMenus) await navigateVisual(page, name);
    await navigateVisual(page, 'Hoje'); await expect(page.getByRole('heading', { name: 'Hoje no criatório', exact: true })).toBeVisible();
    await expect(activeView(page).getByRole('button', { name: /Vendas realizadas|Recebido em vendas|Em aberto de vendas/ })).toHaveCount(0);
    await expect(page.getByLabel('Buscar aves', { exact: true })).toBeVisible(); expect(await visualGeometry(page)).toEqual({ overflow: false, overlaps: [] });
    await page.screenshot({ path: info.outputPath(`stage1-${width}-${theme}-hoje.png`), fullPage: true });
  });
}

test('stage 1 global local search groups metadata, opens real records and excludes attachment contents', async ({ page, context }) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1440, height: 950 }); await createVisualVault(page, 'light', false); await commercialFixture(page);
  const externalRequests: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5175') && !request.url().startsWith('http://127.0.0.1:5174') && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });
  await context.setOffline(true);
  const openSearch = async (query: string) => {
    await page.getByRole('button', { name: 'Buscar em tudo', exact: true }).click(); const search = page.getByRole('dialog', { name: 'Busca global local', exact: true });
    await search.getByLabel('Buscar aves, anilhas, pessoas, vendas e documentos', { exact: true }).fill(query); return search;
  };
  let search = await openSearch('QA');
  await expect(search.getByRole('heading', { level: 3 })).toHaveText(['Aves', 'Pessoas', 'Vendas e reservas', 'Documentos']);
  await search.getByLabel('Buscar aves, anilhas, pessoas, vendas e documentos', { exact: true }).fill('CONTEUDO-NAO-INDEXAVEL'); await expect(search.getByText('Nenhum registro corresponde à busca.', { exact: true })).toBeVisible();
  await search.getByLabel('Buscar aves, anilhas, pessoas, vendas e documentos', { exact: true }).fill('QA-ANEL-01');
  await search.getByRole('button', { name: /^QA Azul · QA-ANEL-01/ }).click(); await expect(activeView(page).locator('.bird-profile-identification')).toHaveText('QA-ANEL-01');
  search = await openSearch('QA cliente'); await search.locator('section').filter({ has: page.getByRole('heading', { name: 'Pessoas', exact: true }) }).getByRole('button').click();
  let details = page.getByRole('dialog', { name: 'Histórico de QA cliente', exact: true }); await expect(details).toBeVisible(); await details.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  search = await openSearch('QA'); await search.locator('section').filter({ has: page.getByRole('heading', { name: 'Vendas e reservas', exact: true }) }).getByRole('button').click();
  details = page.getByRole('dialog', { name: /^Operação / }); await expect(details).toContainText('QA-ANEL-01'); await expect(details).toContainText('QA-ANEL-02'); await details.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  search = await openSearch('QA documento'); await search.locator('section').filter({ has: page.getByRole('heading', { name: 'Documentos', exact: true }) }).getByRole('button').click();
  details = page.getByRole('dialog', { name: 'Detalhes do documento', exact: true }); await expect(details).toContainText('qa-documento.txt'); await expect(details).toContainText('QA Azul · QA-ANEL-01');
  expect(externalRequests).toEqual([]);
});

test('stage 1 two-bird sale and each payment appear once and commercial totals keep their separate meanings', async ({ page }) => {
  test.setTimeout(180000); await createVisualVault(page, 'dark', false); await commercialFixture(page);
  await expect(activeView(page).locator('[data-sale-id]')).toHaveCount(1); await expect(activeView(page).locator('[data-sale-id]')).toContainText('QA-ANEL-01'); await expect(activeView(page).locator('[data-sale-id]')).toContainText('QA-ANEL-02');
  await receive(page, '200,00');
  await navigateVisual(page, 'Resumo'); let overview = activeView(page);
  await expect(statistic(page, 'Vendas realizadas')).toContainText(money('1.000,00'));
  await expect(statistic(page, 'Recebido em vendas')).toContainText(money('200,00'));
  await expect(statistic(page, 'Em aberto de vendas')).toContainText(money('800,00'));
  await statistic(page, 'Vendas realizadas').click(); await expect(activeView(page).locator('[data-sale-id]')).toHaveCount(1); await expect(activeView(page).getByRole('button', { name: 'Vendas realizadas', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await receive(page, '300,00'); const sale = await openSale(page); await sale.getByRole('button', { name: 'Registrar entrega', exact: true }).click();
  const delivery = page.getByRole('dialog', { name: 'Registrar entregue', exact: true }); await delivery.getByLabel('Motivo / justificativa', { exact: true }).fill('Entrega fictícia QA, dívida preservada'); await delivery.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(delivery).not.toBeVisible();
  await navigateVisual(page, 'Resumo'); overview = activeView(page); await expect(statistic(page, 'Recebido em vendas')).toContainText(money('500,00')); await expect(statistic(page, 'Em aberto de vendas')).toContainText(money('500,00')); await expect(statistic(page, 'Vendas realizadas')).toContainText(money('1.000,00'));
  await statistic(page, 'Recebido em vendas').click(); const receipts = page.getByRole('dialog', { name: 'Recebimentos de vendas', exact: true }); await expect(receipts.locator('[data-payment-id]')).toHaveCount(2); await expect(receipts).toContainText(/2 recebimentos · total R\$\s*500,00/); await receipts.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await navigateVisual(page, 'Financeiro'); await expect(activeView(page).locator('.commercial-payment-row')).toHaveCount(2);
  await page.reload(); await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click(); await navigateVisual(page, 'Vendas e reservas'); await expect(activeView(page).locator('[data-sale-id]')).toHaveCount(1); await expect(activeView(page).locator('[data-sale-id]')).toContainText(money('500,00'));
  await navigateVisual(page, 'Hoje'); await expect(activeView(page).getByRole('button', { name: /Aves presentes/ })).toContainText('0');
  await activeView(page).getByRole('button', { name: 'Consultar histórico (2)', exact: true }).click(); await expect(activeView(page).locator('.bird-list-row')).toHaveCount(2);
});

for (const native of [false, true]) test(`stage 1 ${native ? 'Android back event' : 'visible Back'} restores advanced filters, query and bird-list position`, async ({ page }) => {
  test.setTimeout(120000); await page.setViewportSize({ width: 390, height: 760 });
  if (native) await page.addInitScript(() => { Object.assign(window, { androidBridge: {} }); });
  await createVisualVault(page, 'light', false);
  for (let index = 0; index < 8; index++) await addBird(page, `QA-VOLTA-${index}`, `QA Ave ${index}`);
  await page.getByLabel('Buscar aves', { exact: true }).fill('QA');
  await activeView(page).locator('details.filter-panel > summary').click(); await page.getByRole('combobox', { name: 'Sexo', exact: true }).selectOption('indeterminado');
  await activeView(page).getByRole('button', { name: 'QA Ave 7 · QA-VOLTA-7', exact: true }).scrollIntoViewIfNeeded(); const scroll = await page.evaluate(() => scrollY); expect(scroll).toBeGreaterThan(0);
  await activeView(page).getByRole('button', { name: 'QA Ave 7 · QA-VOLTA-7', exact: true }).click(); await expect(activeView(page).locator('.bird-profile-name')).toHaveText('QA Ave 7');
  if (native) await page.evaluate(() => window.dispatchEvent(new CustomEvent('recanto:native-back'))); else await page.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
  await expect(activeView(page).locator('.bird-list-row')).toHaveCount(8); await expect(page.getByLabel('Buscar aves', { exact: true })).toHaveValue('QA'); await expect(page.getByRole('combobox', { name: 'Sexo', exact: true })).toHaveValue('indeterminado');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll - 5); expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(scroll + 5);
});

test('stage 1 overdue indicator opens exactly overdue payables and receivables, independent of stale list filters', async ({ page }) => {
  await createVisualVault(page, 'light', false); await navigateVisual(page, 'Financeiro');
  const yesterday = await page.evaluate(() => new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
  const future = await page.evaluate(() => new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
  for (const bill of [
    { title: 'QA vencida a pagar', direction: 'pagar', due: yesterday },
    { title: 'QA vencida a receber', direction: 'receber', due: yesterday },
    { title: 'QA futura a pagar', direction: 'pagar', due: future },
  ]) {
    await page.getByRole('button', { name: 'Nova conta a pagar/receber', exact: true }).click(); const form = page.getByRole('dialog', { name: 'Conta a pagar/receber', exact: true });
    await form.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption(bill.direction);
    await form.getByLabel('Descrição', { exact: true }).fill(bill.title); await form.getByLabel('Vencimento', { exact: true }).fill(bill.due);
    await form.getByLabel('Valor (R$)', { exact: true }).fill('100,00'); await form.locator('input[name=category]').fill('Manutenção');
    await form.getByRole('button', { name: 'Confirmar e salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  }
  await page.getByLabel('Buscar movimentações', { exact: true }).fill('nenhuma correspondência');
  await page.getByLabel('Período inicial', { exact: true }).fill(future);
  await navigateVisual(page, 'Resumo'); await activeView(page).getByRole('button', { name: /2 contas vencidas/ }).click();
  const debts = page.getByRole('dialog', { name: 'Contas a pagar e receber', exact: true });
  await expect(debts.getByRole('combobox', { name: 'Situação', exact: true })).toHaveValue('atrasadas'); await expect(debts.getByLabel('Buscar contas', { exact: true })).toHaveValue('');
  await expect(debts.locator('[data-bill-id]')).toHaveCount(2); await expect(debts).toContainText('QA vencida a pagar'); await expect(debts).toContainText('QA vencida a receber'); await expect(debts.getByText('QA futura a pagar', { exact: true })).toHaveCount(0);
});
