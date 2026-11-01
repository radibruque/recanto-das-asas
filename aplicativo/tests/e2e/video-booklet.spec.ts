import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function menu(page: Page, name: string) {
  let button = page.getByRole('button', {name, exact:true}).filter({visible:true});
  if (!await button.count()) {
    await page.getByRole('button', {name:'Mais menus', exact:true}).click();
    button = page.getByRole('button', {name:new RegExp('^'+name+' ')}).filter({visible:true});
  }
  await button.last().click();
}
const photo = {name:'foto-caderneta.png', mimeType:'image/png', buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAMklEQVR4nO3NMQ0AMAgAsLEH+dhAJjJISGugkdVvw19ZxWKxWCwWi8VisVgsFovFR+MBgcEBjhrnxuUAAAAASUVORK5CYII=', 'base64')};
for (const width of [390,1280]) test(`caderneta, foto, histórico e retorno ${width}`, async ({page}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width,height:width<600?844:1800});
  await page.goto('/');
  await page.getByRole('button',{name:'Começar meu criatório',exact:true}).click();
  if(width<600) await page.getByRole('button',{name:'Mais menus',exact:true}).click();
  await page.getByRole('tab',{name:'Demonstração',exact:true}).click();
  await page.getByRole('button',{name:'Criar exemplos fictícios',exact:true}).click();
  await menu(page,'Aves');
  await page.getByRole('button',{name:'Abrir ficha de Azul',exact:true}).click();
  await page.getByRole('button',{name:'Pesar',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Peso (gramas) *',{exact:true}).fill('95');
  await page.getByRole('dialog').getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('tab',{name:'Documentos e fotos',exact:true}).click();
  await page.getByRole('button',{name:'Abrir caderneta',exact:true}).click();
  await expect(page.getByLabel('Último peso registrado (g)',{exact:true})).toHaveValue('95');
  await page.getByLabel('Nome escolhido pelo tutor',{exact:true}).fill('Azul do tutor');
  await page.getByLabel('Foto principal da ave',{exact:true}).setInputFiles(photo);
  await expect(page.getByRole('button',{name:'Remover foto',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remover foto',exact:true}).click();
  await expect(page.getByRole('button',{name:'Remover foto',exact:true})).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'Gerar caderneta para imprimir',exact:true}).click();
  const file = await downloading;
  const path = await file.path();
  if (!path) throw new Error('Download da caderneta ausente');
  const bytes = await readFile(path);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getForm().getFields()).toHaveLength(0);
  expect(pdf.getTitle()).toBe('Caderneta — Azul do tutor');
  await expect(page.locator('.booklet-generated')).toBeVisible();
  await page.screenshot({path:info.outputPath(`caderneta-${width}.png`)});
  await page.getByRole('button',{name:'Voltar à tela anterior',exact:true}).click();
  await expect(page.locator('.bird-profile-identity')).toContainText('Azul');
  await page.getByRole('tab',{name:'Documentos e fotos',exact:true}).click();
  await page.getByRole('button',{name:'Abrir versão emitida',exact:true}).click();
  await expect(page.getByRole('dialog',{name:/Cadernetas/})).toBeVisible();
  const original = page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar original',exact:true}).click();
  const originalPath = await (await original).path();
  if (!originalPath) throw new Error('Original arquivado ausente');
  expect(await readFile(originalPath)).toEqual(bytes);
  await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await menu(page,'Relatórios');
  await expect(page.locator('.documents-history')).not.toContainText('Caderneta do pet');
  expect(errors).toEqual([]);
});