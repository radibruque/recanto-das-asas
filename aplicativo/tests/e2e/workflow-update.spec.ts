import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import type { State } from '../../src/domain/types';
import { navigateVisual } from './visual-helpers';

const password = 'senha-ficticia-da-atualizacao';
const documentBytes = Buffer.from('Exame fictício — documento de teste, sem dados reais.');
const photo = { name: 'foto-ave.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=', 'base64') };

async function create(page:Page) {
  await page.goto('/');
  await page.getByLabel('Senha da base', {exact:true}).fill(password);
  await page.getByLabel('Confirmar senha', {exact:true}).fill(password);
  await page.getByRole('button', {name:'Criar base privada', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Painel Criatório', exact:true})).toBeVisible();
}
async function nav(page:Page, name:string) {
  await navigateVisual(page, name);
}
async function birdForm(page:Page, id:string, name=id) {
  await nav(page, 'Aves');
  await page.getByRole('button', {name:'Cadastrar ave', exact:true}).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Identificação ou anilha *', {exact:true}).fill(id);
  await form.getByLabel('Nome', {exact:true}).fill(name);
  await form.getByLabel('Espécie *', {exact:true}).fill('Calopsita');
  await form.getByRole('combobox', {name:'Situação', exact:true}).selectOption('disponível');
  return form;
}
async function addBird(page:Page, id:string, name=id) {
  const form=await birdForm(page,id,name);
  await form.getByRole('button', {name:'Salvar', exact:true}).click();
  await expect(form).not.toBeVisible();
}
/** Inspect only the fictitious test vault, using WebCrypto independently of app reducers. */
async function storedState(page:Page):Promise<State> {
  return page.evaluate(async password => {
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('recanto-das-asas-private',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try {
      const record=await new Promise<any>((resolve,reject)=>{const request=database.transaction('vault','readonly').objectStore('vault').get('vault');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const envelope=record.envelope;
      const bytes=(value:string)=>Uint8Array.from(atob(value),letter=>letter.charCodeAt(0));
      const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},key,bytes(envelope.ciphertext));
      return JSON.parse(new TextDecoder().decode(plain));
    } finally {database.close();}
  }, password) as Promise<State>;
}

test('direct bird attachments save together and cancelling a new registration creates no orphan files', async ({page}) => {
  await create(page);
  let form=await birdForm(page,'ANEXO-CANCELADO');
  await expect(form.getByLabel('Documento de apoio',{exact:true})).toHaveCount(0);
  await expect(form.getByLabel('Data da movimentação',{exact:true})).toHaveCount(0);
  await expect(form.getByLabel('Motivo da movimentação de recinto ou responsável',{exact:true})).toHaveCount(0);
  await form.getByLabel('Arquivos para anexar',{exact:true}).setInputFiles({name:'cadastro-cancelado.txt',mimeType:'text/plain',buffer:documentBytes});
  await expect(form.getByText('cadastro-cancelado.txt',{exact:true})).toBeVisible();
  await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  let state=await storedState(page);
  expect(state.attachments).toHaveLength(0);
  expect(state.birds).toHaveLength(0);

  form=await birdForm(page,'ANEXO-001','Roxa');
  await form.getByLabel('Arquivos para anexar',{exact:true}).setInputFiles({name:'laudo-inicial.txt',mimeType:'text/plain',buffer:documentBytes});
  await expect(form.getByText('laudo-inicial.txt',{exact:true})).toBeVisible();
  await form.getByLabel('Foto principal da ave',{exact:true}).setInputFiles(photo);
  await expect(form.getByText('foto-ave.png',{exact:true})).toBeVisible();
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  state=await storedState(page);
  expect(state.birds).toHaveLength(1);
  expect(state.attachments).toHaveLength(2);
  expect(state.attachments.every(file=>file.birdId===state.birds[0].id)).toBe(true);
  expect(state.birds[0].photoId).toBe(state.attachments.find(file=>file.fileName==='foto-ave.png')?.id);
  expect(Buffer.from(state.attachments.find(file=>file.fileName==='laudo-inicial.txt')!.base64,'base64')).toEqual(documentBytes);
  await addBird(page,'SEM-ARQUIVOS','Sem arquivo');
  await nav(page,'Documentos');
  await expect(page.getByRole('heading',{name:'Acervo de documentos e fotos',exact:true})).toBeVisible();
  await expect(page.getByText('Sem arquivo · SEM-ARQUIVOS',{exact:true})).toHaveCount(0);
  const group=page.locator('article').filter({hasText:'Roxa · ANEXO-001'}).first();
  await group.getByRole('button',{name:'Ver arquivos',exact:true}).click();
  const row=page.locator('article').filter({hasText:'laudo-inicial'}).last();
  await row.getByRole('button',{name:'Detalhes',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Detalhes do documento'});
  await expect(details).toContainText('Exame fictício');
  await expect(details.getByRole('button',{name:'Visualizar',exact:true})).toBeVisible();
  await details.getByLabel('Categoria',{exact:true}).fill('Exame revisado');
  await details.getByLabel('Observações',{exact:true}).fill('Observação adicionada no acervo');
  await details.getByRole('button',{name:'Salvar observações e informações',exact:true}).click();
  await expect(page.getByText('Observações e informações do documento atualizadas. O arquivo original foi preservado.')).toBeVisible();
  const updated=(await storedState(page)).attachments.find(file=>file.fileName==='laudo-inicial.txt')!;
  const original=state.attachments.find(file=>file.fileName==='laudo-inicial.txt')!;
  expect(updated).toMatchObject({id:original.id,base64:original.base64,sha256:original.sha256,birdId:original.birdId,category:'Exame revisado',notes:'Observação adicionada no acervo'});
  await details.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Exame revisado');
  await expect(page.getByRole('button',{name:'Ver arquivos',exact:true})).toHaveCount(1);
  await page.getByRole('combobox',{name:'Organizar por',exact:true}).selectOption('category');
  await expect(page.getByRole('heading',{name:'Exame revisado',exact:true})).toBeVisible();
});

test('health groups only birds with records, opens complete event details and preserves weight on the bird sheet', async ({page}) => {
  await create(page); await addBird(page,'SAUDE-001','Roxa'); await addBird(page,'SEM-MANEJO','Sem manejo');
  await nav(page,'Saúde e manejo');
  await page.getByRole('button',{name:'Novo registro',exact:true}).click();
  const form=page.getByRole('dialog');
  await form.getByRole('combobox',{name:'Ave *',exact:true}).selectOption({label:'Roxa · SAUDE-001'});
  await form.getByLabel('Título *',{exact:true}).fill('Exame de acompanhamento');
  await form.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('exame');
  await form.getByLabel('Peso (gramas)',{exact:true}).fill('97.5');
  await form.getByLabel('Profissional',{exact:true}).fill('Profissional fictício');
  await form.getByLabel('Observações',{exact:true}).fill('Observação completa para o histórico');
  await form.getByLabel('Arquivos para anexar',{exact:true}).setInputFiles({name:'exame-ave.txt',mimeType:'text/plain',buffer:documentBytes});
  await expect(form.getByText('exame-ave.txt',{exact:true})).toBeVisible();
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  const state=await storedState(page);
  expect(state.health).toHaveLength(1);
  expect(state.health[0].attachmentIds).toEqual([state.attachments[0].id]);
  expect(state.attachments[0].birdId).toBe(state.health[0].birdId);
  await expect(page.getByRole('heading',{name:'Evolução do peso',exact:true})).toHaveCount(0);
  await expect(page.getByText('Sem manejo · SEM-MANEJO',{exact:true})).toHaveCount(0);
  // Group and detail selectors follow their accessible, user-visible names.
  await page.getByRole('button',{name:'Ver histórico de Roxa · SAUDE-001',exact:true}).click();
  await page.getByRole('button',{name:'Ver registro: Exame de acompanhamento',exact:true}).click();
  const details=page.getByRole('dialog').last();
  await expect(details).toContainText('Profissional fictício');
  await expect(details).toContainText('Observação completa para o histórico');
  await expect(details).toContainText('exame-ave');
  await details.getByRole('button',{name:'Voltar ao histórico',exact:true}).click();
  await nav(page,'Aves');
  await page.getByRole('button',{name:'Roxa · SAUDE-001',exact:true}).click();
  await expect(page.locator('.record-details').filter({hasText:'Peso atualizado'})).toContainText('97,5 g');
  await page.getByRole('tab',{name:'Saúde e peso',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Evolução do peso',exact:true})).toBeVisible();
});

test('sale and reservation have separate forms; finance settlement changes actual balances and contact history', async ({page}) => {
  await create(page); await addBird(page,'RES-001','Roxa');
  await nav(page,'Clientes e fornecedores');
  await page.getByRole('button',{name:'Novo contato',exact:true}).click();
  let form=page.getByRole('dialog');
  await form.getByLabel('Nome',{exact:true}).fill('Cliente de teste');
  await form.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await nav(page,'Financeiro');
  await page.getByRole('button',{name:'Nova conta financeira',exact:true}).click();
  form=page.getByRole('dialog');
  await form.getByLabel('Nome da conta',{exact:true}).fill('Caixa teste');
  await form.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await nav(page,'Vendas e reservas');
  await expect(page.getByRole('button',{name:'Nova operação',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'VENDA',exact:true}).click();
  form=page.getByRole('dialog',{name:'Registrar venda'});
  await expect(form).toBeVisible();
  await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'RESERVA',exact:true}).click();
  form=page.getByRole('dialog',{name:'Registrar reserva'});
  await form.getByRole('combobox',{name:'Cliente',exact:true}).selectOption({label:'Cliente de teste'});
  await form.getByRole('combobox',{name:'Ave',exact:true}).selectOption({label:'Roxa · RES-001 · disponível'});
  await form.getByLabel('Valor unitário (R$)',{exact:true}).fill('1000,00');
  await form.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await nav(page,'Financeiro');
  await page.getByRole('button',{name:'Contas a receber',exact:true}).click();
  const list=page.getByRole('dialog',{name:'Contas a receber'});
  await list.getByRole('button',{name:'Registrar recebimento',exact:true}).click();
  form=page.getByRole('dialog',{name:'Confirmar recebimento'});
  await form.getByRole('combobox',{name:'Conta financeira',exact:true}).selectOption({label:'Caixa teste'});
  await form.getByLabel('Valor confirmado (R$)',{exact:true}).fill('200,00');
  await form.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  let state=await storedState(page);
  expect(state.sales[0].status).toBe('reservada');
  expect(state.payments.map(payment=>payment.amountCents)).toEqual([20000]);
  expect(state.bills[0].amountCents).toBe(100000);
  await page.getByRole('dialog',{name:'Contas a receber'}).getByRole('button',{name:'Registrar recebimento',exact:true}).click();
  form=page.getByRole('dialog',{name:'Confirmar recebimento'});
  await form.getByRole('combobox',{name:'Conta financeira',exact:true}).selectOption({label:'Caixa teste'});
  await form.getByRole('button',{name:'Usar saldo total',exact:true}).click();
  await expect(form.getByLabel('Valor confirmado (R$)',{exact:true})).toHaveValue('800,00');
  await form.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  state=await storedState(page);
  expect(state.payments.reduce((sum,payment)=>sum+payment.amountCents,0)).toBe(100000);
  expect(state.payments).toHaveLength(2);
  await expect(page.getByText(/Saldo inicial.*atual R\$\s*1\.000,00/)).toBeVisible();
  await page.getByRole('dialog',{name:'Contas a receber'}).getByRole('button',{name:'Fechar janela',exact:true}).click();
  await nav(page,'Clientes e fornecedores');
  await page.getByRole('button',{name:'Histórico / transações',exact:true}).click();
  const history=page.getByRole('dialog',{name:'Histórico de Cliente de teste'});
  await expect(history).toContainText('Roxa · RES-001');
  await history.getByRole('button',{name:'Ver operação e pagamentos',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Ver detalhes da parcela',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('200,00');
  await expect(page.getByRole('dialog')).toContainText('800,00');
});

test('new digital booklet downloads four complete pages and keeps history grouped by bird', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await create(page); const form=await birdForm(page,'PDF-001','Roxa');
  await form.getByLabel('Foto principal da ave',{exact:true}).setInputFiles(photo);
  await expect(form.getByText('foto-ave.png',{exact:true})).toBeVisible();
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await addBird(page,'SEM-CADERNETA','Sem caderneta');
  await nav(page,'Caderneta do pet');
  await page.getByRole('combobox',{name:'Ave',exact:true}).selectOption({label:'Roxa · PDF-001'});
  await expect(page.getByRole('combobox',{name:'Formato',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/livreto|impressão A4/i})).toHaveCount(0);
  for (let attempt=0;attempt<2;attempt++) {
    const downloading=page.waitForEvent('download');
    await page.getByRole('button',{name:'Emitir caderneta digital',exact:true}).click();
    const file=await downloading;
    expect(await file.failure()).toBeNull();
    const bytes=await readFile((await file.path())!);
    expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10000);
    expect(bytes.length).toBeLessThan(10*1024*1024);
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getPage(0).getSize().height).toBeGreaterThan(pdf.getPage(0).getSize().width);
    await page.getByRole('dialog',{name:'Cadernetas — Roxa · PDF-001'}).getByRole('button',{name:'Fechar',exact:true}).click();
  }
  const state=await storedState(page);
  expect(state.documents).toHaveLength(2);
  expect(state.documents.every(document=>document.birdId===state.birds[0].id&&document.size>10000)).toBe(true);
  await expect(page.getByRole('heading',{name:'Cadernetas emitidas por ave',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ver cadernetas',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Ver cadernetas',exact:true}).click();
  await expect(page.getByRole('button',{name:'Baixar original',exact:true})).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('agenda groups birds with tasks and exports a calendar reminder before completing the task', async ({page}) => {
  await create(page); await addBird(page,'AGENDA-001','Roxa'); await addBird(page,'SEM-TAREFA','Sem tarefa');
  await nav(page,'Agenda');
  await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Nova tarefa'});
  await form.getByLabel('Tarefa *',{exact:true}).fill('Revisar manejo');
  await form.getByLabel('Data prevista *',{exact:true}).fill('2030-01-15');
  await form.getByLabel('Horário do lembrete (Brasília)',{exact:true}).fill('09:30');
  await form.getByRole('combobox',{name:'Avisar antes',exact:true}).selectOption('30');
  await form.getByRole('combobox',{name:'Ave (opcional)',exact:true}).selectOption({label:'Roxa · AGENDA-001'});
  await form.getByLabel('Observações',{exact:true}).fill('Conferir registros fictícios');
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Tarefas por ave',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Ave da tarefa',exact:true}).getByRole('option',{name:'Sem tarefa · SEM-TAREFA',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Ver tarefas',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Ver detalhes',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Revisar manejo'});
  await expect(details).toContainText('Conferir registros fictícios');
  const downloading=page.waitForEvent('download');
  await details.getByRole('button',{name:'Baixar lembrete (.ics)',exact:true}).click();
  const downloaded=await downloading;
  const calendar=await readFile((await downloaded.path())!,'utf8');
  expect(calendar).toContain('BEGIN:VCALENDAR');
  expect(calendar).toContain('BEGIN:VALARM');
  expect(calendar).toContain('TRIGGER:-PT30M');
  expect(calendar).toContain('Revisar manejo');
  expect(calendar).toContain('AGENDA-001');
  expect(calendar).toContain('DTSTART:20300115T123000Z');
  await details.getByRole('button',{name:'Concluir tarefa',exact:true}).click();
  await expect(details).toContainText('Concluída');
  await expect(details.getByRole('button',{name:'Baixar lembrete (.ics)',exact:true})).toHaveCount(0);
  const state=await storedState(page);
  expect(state.tasks).toHaveLength(1);
  expect(state.tasks[0]).toMatchObject({done:true,reminderTime:'09:30',reminderMinutes:30});
});

test('mobile bird sheet, direct attachments and health details fit without overlapping action buttons', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await create(page);
  const form=await birdForm(page,'MOBILE-ATUALIZACAO','Ave com nome comprido para conferir o layout');
  await form.getByLabel('Arquivos para anexar',{exact:true}).setInputFiles({name:'documento-longo-para-conferir-o-cadastro.txt',mimeType:'text/plain',buffer:documentBytes});
  await expect(form.getByText('documento-longo-para-conferir-o-cadastro.txt',{exact:true})).toBeVisible();
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button',{name:'Ave com nome comprido para conferir o layout · MOBILE-ATUALIZACAO',exact:true}).click();
  await expect(page.getByRole('tablist',{name:'Ficha da ave'})).toBeVisible();
  const checkLayout=async()=>{
    const layout=await page.evaluate(()=>{
      const overlaps:string[]=[];
      for(const toolbar of document.querySelectorAll('.toolbar,.row,.tabs')){
        const buttons=Array.from(toolbar.querySelectorAll<HTMLButtonElement>(':scope > button')).filter(button=>button.offsetWidth>0&&button.offsetHeight>0);
        for(let a=0;a<buttons.length;a++)for(let b=a+1;b<buttons.length;b++){
          const first=buttons[a].getBoundingClientRect(),second=buttons[b].getBoundingClientRect();
          if(Math.min(first.right,second.right)-Math.max(first.left,second.left)>1&&Math.min(first.bottom,second.bottom)-Math.max(first.top,second.top)>1)overlaps.push(`${buttons[a].textContent} / ${buttons[b].textContent}`);
        }
      }
      return {overflow:document.documentElement.scrollWidth>window.innerWidth,overlaps};
    });
    expect(layout).toEqual({overflow:false,overlaps:[]});
  };
  await checkLayout();
  await page.getByRole('button',{name:'Novo manejo',exact:true}).click();
  const healthForm=page.getByRole('dialog');
  await healthForm.getByLabel('Título *',{exact:true}).fill('Observação extensa de saúde para testar o layout');
  await healthForm.getByLabel('Observações',{exact:true}).fill('Anotações fictícias que devem permanecer legíveis no telefone.');
  await healthForm.getByLabel('Peso (gramas)',{exact:true}).fill('100');
  await healthForm.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(healthForm).not.toBeVisible();
  await page.getByRole('tab',{name:'Saúde e peso',exact:true}).click();
  await page.getByRole('button',{name:'Ver registro: Observação extensa de saúde para testar o layout',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('100 g');
  await checkLayout();
  await page.screenshot({path:'/tmp/recanto-update-health-mobile.png',fullPage:true});
});
