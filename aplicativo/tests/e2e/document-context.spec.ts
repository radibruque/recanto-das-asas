import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { applyCommand } from '../../src/domain/engine';
import { emptyState } from '../../src/domain/types';
import { today } from '../../src/domain/shared';
import { bytesToBase64, sha256 } from '../../src/domain/documents';
import { issuedPayload } from '../../src/lib/exports';
import { encryptObject } from '../../src/lib/storage';
import { navigateVisual, readVisualState, visualPassword } from './visual-helpers';

async function openTemplate(page: Page) {
  const editor = page.locator('.document-template');
  if (await editor.getAttribute('open') === null) await editor.locator(':scope > summary').click();
}

/** Only fictitious data in this test's isolated encrypted browser vault. */
async function seedDocuments(page: Page) {
  const state = emptyState();
  state.settings.lastBackupAt = new Date().toISOString();
  const run = (action: string, data: unknown) => applyCommand(state, 'real', action, data)!;
  const bird = (identification: string, name: string) => run('saveBird', { identification, name, species: 'Calopsita', sex: 'indeterminado', mutation: 'Não informada', certainty: 'informada', origin: 'Cadastro fictício QA', status: 'disponível' });
  const birdA = bird('QA-DOC-A', 'Ave QA A'), birdB = bird('QA-DOC-B', 'Ave QA B');
  const contactId = run('contact.save', { name: 'Cliente QA B', kind: 'cliente' });
  const saleId = run('sale.save', { contactId, date: today(), status: 'vendida', items: [{ kind: 'ave', refId: birdB, description: 'Ave QA B', quantity: 1, unitCents: 10000 }] });
  const file = (title: string, links: { birdId: string | null; saleId: string | null }) => {
    const bytes = new TextEncoder().encode(`Original fictício ${title}`);
    return run('attachment.add', { ...links, contactId: null, title, category: 'Documentos QA', date: '2026-10-01', fileName: `${title}.txt`, mime: 'text/plain', size: bytes.length, base64: bytesToBase64(bytes), sha256: sha256(bytes) });
  };
  file('Arquivo QA A', { birdId: birdA, saleId: null });
  file('Arquivo QA B', { birdId: null, saleId });
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Original QA B');
  const originalBytes = await pdf.save();
  run('document.issue', { ...issuedPayload(originalBytes, 'original-QA-B.pdf', 'application/pdf'), kind: 'Recibo de pagamento', title: 'Original QA B', birdId: null, saleId });
  const record = { key: 'vault', revision: state.revision, envelope: await encryptObject(state, visualPassword), metadata: await encryptObject({ sync: null, queue: [] }, visualPassword) };
  await page.goto('/');
  await page.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('recanto-das-asas-private', 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('vault')) request.result.createObjectStore('vault', { keyPath: 'key' });
        if (!request.result.objectStoreNames.contains('backups')) request.result.createObjectStore('backups', { keyPath: 'at' });
      };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('vault', 'readwrite');
        tx.objectStore('vault').put(record);
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, record);
  await page.reload();
  await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.locator('.app-layout')).toBeVisible();
  return { birdA, saleId, originalBytes };
}

test('new document links replace unrelated bird/sale filters and Back restores the previous acervo', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { birdA, saleId, originalBytes } = await seedDocuments(page);
  await navigateVisual(page, 'Aves');
  await page.getByRole('button', { name: 'Ave QA A · QA-DOC-A', exact: true }).click();
  await page.getByRole('tab', { name: 'Arquivos / entrega', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir documentos da ave', exact: true }).click();
  const library = page.locator('.documents-library');
  await library.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('text/plain');
  await library.getByRole('combobox', { name: 'Organizar por', exact: true }).selectOption('category');
  await library.getByRole('button', { name: 'Ver arquivos', exact: true }).click();
  await page.getByLabel('Buscar documentos', { exact: true }).fill('Arquivo QA A');
  await expect(library).toContainText('Arquivo QA A');
  await expect(library).not.toContainText('Arquivo QA B');

  await navigateVisual(page, 'Vendas e reservas');
  await page.locator('.commercial-sale-row').getByRole('button', { name: 'Ver operação e pagamentos', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar entrega', exact: true }).click();
  let delivery = page.getByRole('dialog', { name: 'Registrar entregue', exact: true });
  await delivery.getByRole('button', { name: 'Revisar recibo', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Ave do documento', exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Operação do documento', exact: true })).toHaveValue(saleId);
  await expect(library.locator('.document-group-grid')).toContainText('Documentos QA');
  await expect(library.locator('.document-library-filters')).toContainText('1 arquivo encontrado');
  await expect(page.getByLabel('Buscar documentos', { exact: true })).toHaveValue('');
  await library.getByRole('button', { name: 'Ver arquivos', exact: true }).click();
  await expect(library).toContainText('Arquivo QA B');
  await expect(library).not.toContainText('Arquivo QA A');
  await page.getByLabel('Título do documento', { exact: true }).fill('Recibo QA B emitido');
  const emitted = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Emitir PDF', exact: true }).click();
  await emitted;
  const saved = (await readVisualState(page)).documents.find(document => document.title === 'Recibo QA B emitido')!;
  expect(saved.birdId).toBeNull(); expect(saved.saleId).toBe(saleId);

  await page.getByRole('button', { name: 'Voltar ao contexto anterior', exact: true }).click();
  delivery = page.getByRole('dialog', { name: 'Registrar entregue', exact: true });
  await expect(delivery).toBeVisible();
  await delivery.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar ao contexto anterior', exact: true }).click();
  await expect(page.locator('.page-title h1')).toHaveText('Documentos');
  await expect(page.getByLabel('Buscar documentos', { exact: true })).toHaveValue('Arquivo QA A');
  await expect(library.getByRole('combobox', { name: 'Formato', exact: true })).toHaveValue('text/plain');
  await expect(library.locator('.document-group')).toContainText('Arquivo QA A');
  await expect(library).not.toContainText('Arquivo QA B');
  await openTemplate(page);
  await expect(page.getByRole('combobox', { name: 'Ave do documento', exact: true })).toHaveValue(birdA);
  await expect(page.getByRole('combobox', { name: 'Operação do documento', exact: true })).toHaveValue('');

  await page.getByRole('button', { name: 'Buscar em tudo', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Busca global local', exact: true });
  await search.getByLabel('Buscar aves, anilhas, pessoas, vendas e documentos', { exact: true }).fill('Original QA B');
  await search.getByRole('button', { name: /^Original QA B/ }).click();
  const original = page.getByRole('dialog', { name: 'Original QA B', exact: true });
  await expect(original).toBeVisible();
  const recovered = page.waitForEvent('download');
  await original.getByRole('button', { name: 'Baixar original', exact: true }).click();
  expect(await readFile((await (await recovered).path())!)).toEqual(Buffer.from(originalBytes));
  await original.getByRole('button', { name: 'Fechar', exact: true }).click();
  await openTemplate(page);
  await expect(page.getByRole('combobox', { name: 'Ave do documento', exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Operação do documento', exact: true })).toHaveValue(saleId);
  await library.getByRole('button', { name: 'Ver arquivos', exact: true }).click();
  await expect(library).toContainText('Arquivo QA B');
  await expect(library).not.toContainText('Arquivo QA A');
  await navigateVisual(page, 'Financeiro');
  await page.getByRole('button', { name: 'Voltar ao contexto anterior', exact: true }).click();
  await expect(page.locator('.page-title h1')).toHaveText('Documentos');
  await expect(page.getByRole('dialog', { name: 'Original QA B', exact: true })).not.toBeVisible();
  await expect(library.locator('.document-group')).toContainText('Arquivo QA B');
});
