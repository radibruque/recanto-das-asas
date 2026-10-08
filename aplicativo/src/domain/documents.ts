import { z } from 'zod';
import type { Attachment, Handler, IssuedDocument, Scope, State } from './types';
import { date, ensure, id, required, text } from './shared';
import { itemTotal, salePaid, stockBalance } from './commercial';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const attachmentMimes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'] as const;
export function bytesToBase64(bytes: Uint8Array): string {
  let result = ''; for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(result);
}
export function base64ToBytes(value: string): Uint8Array {
  ensure(value.length <= Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4, 'O arquivo excede 10 MB.');
  ensure(value.length > 0 && value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value), 'Conteúdo do arquivo inválido.');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
// SHA-256 works synchronously in the command reducer, so payload integrity is verified before writing.
export function sha256(bytes: Uint8Array): string {
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64); padded.set(bytes); padded[bytes.length] = 128;
  const view = new DataView(padded.buffer); view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000)); view.setUint32(padded.length - 4, bytes.length * 8 >>> 0);
  const rotr = (v: number, n: number) => (v >>> n) | (v << (32 - n)); const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(offset + j * 4);
    for (let j = 16; j < 64; j++) { const a = w[j - 15], b = w[j - 2]; w[j] = ((rotr(a,7)^rotr(a,18)^(a>>>3)) + w[j - 16] + (rotr(b,17)^rotr(b,19)^(b>>>10)) + w[j - 7]) >>> 0; }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let j = 0; j < 64; j++) { const t1 = (hh + (rotr(e,6)^rotr(e,11)^rotr(e,25)) + ((e&f)^(~e&g)) + constants[j] + w[j]) >>> 0; const t2 = ((rotr(a,2)^rotr(a,13)^rotr(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0; hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
    [a,b,c,d,e,f,g,hh].forEach((v, j) => { h[j] = (h[j] + v) >>> 0; });
  }
  return h.map(v => v.toString(16).padStart(8, '0')).join('');
}
export function verifyFile(bytes: Uint8Array, mime: string, fileName: string, issued = false): void {
  ensure(bytes.length > 0 && bytes.length <= MAX_ATTACHMENT_BYTES, 'O arquivo deve ter entre 1 byte e 10 MB.');
  ensure(fileName.length <= 180 && !/[\u0000-\u001f/\\]/.test(fileName), 'Nome de arquivo inválido.');
  const ext = fileName.split('.').pop()?.toLowerCase();
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v);
  if (mime === 'image/png') ensure(ext === 'png' && starts(137,80,78,71,13,10,26,10) && bytes.length >= 45 && bytes.slice(-12,-8).every(v => v === 0) && new TextDecoder().decode(bytes.slice(-8,-4)) === 'IEND', 'PNG inválido: assinatura ou extensão incompatível.');
  else if (mime === 'image/jpeg') ensure(['jpg','jpeg'].includes(ext || '') && bytes.length > 4 && starts(255,216,255) && bytes.at(-2) === 255 && bytes.at(-1) === 217, 'JPEG inválido: assinatura ou extensão incompatível.');
  else if (mime === 'application/pdf') { ensure(ext === 'pdf' && new TextDecoder().decode(bytes.slice(0,8)).startsWith('%PDF-') && new TextDecoder().decode(bytes.slice(-2048)).includes('%%EOF'), 'PDF inválido: assinatura ou extensão incompatível.'); ensure(!/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/.test(new TextDecoder('latin1').decode(bytes)), 'PDF contém ações ativas ou arquivos incorporados não permitidos.'); }
  else if (mime === 'text/plain') { ensure(ext === 'txt', 'Use a extensão .txt.'); let value = ''; try { value = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { throw new Error('O texto deve estar em UTF-8.'); } ensure(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) && !/^\s*(?:MZ|#!|<\?php)/.test(value), 'Texto contém dados binários ou executáveis.'); }
  else if (issued && mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { const content=new TextDecoder('latin1').decode(bytes);ensure(ext === 'docx' && starts(80,75,3,4) && content.includes('[Content_Types].xml') && content.includes('word/document.xml') && !/(?:vbaProject\.bin|\.exe\b)/i.test(content), 'DOCX inválido ou com conteúdo executável.'); }
  else throw new Error('Formato não permitido. Use PDF, PNG, JPG ou texto UTF-8 (.txt).');
}
const nullableId = z.string().uuid().nullable().default(null);
const payload = {fileName: required, mime: required, size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES), base64: z.string().min(1).max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4), sha256: z.string().regex(/^[a-f0-9]{64}$/)};
const attachmentSchema = z.object({...payload, birdId: nullableId, contactId: nullableId, saleId: nullableId, title: required, category: required, date, issuer:text, reference:text, validUntil: date.or(z.literal('')).default(''), notes:text, shareWithCustomer:z.boolean().default(false), previousId: nullableId});
const issuedSchema = z.object({...payload, birdId:nullableId, saleId:nullableId, kind:required, title:required});
function checkLinks(state: State, scope: Scope, links: {birdId?: string|null;contactId?:string|null;saleId?:string|null}) {
  for (const [key, collection] of [['birdId','birds'],['contactId','contacts'],['saleId','sales']] as const) { const recordId = links[key]; if (recordId) ensure(state[collection].some(v => v.id === recordId && v.scope === scope), 'Vínculo inexistente ou de outra base.'); }
}
function checkPayload(data: {base64:string;mime:string;fileName:string;size:number;sha256:string}, issued = false) {
  const bytes = base64ToBytes(data.base64); verifyFile(bytes, data.mime, data.fileName, issued); ensure(bytes.length === data.size && sha256(bytes) === data.sha256, 'Falha de integridade: tamanho ou SHA-256 incorreto.');
}
export const documentsHandler: Handler = (state, scope, action, input) => {
  if (action === 'attachment.add') {
    const data = attachmentSchema.parse(input); checkLinks(state, scope, data); checkPayload(data);
    const previous = data.previousId ? state.attachments.find(v => v.id === data.previousId && v.scope === scope) : null;
    ensure(!data.previousId || previous, 'Versão anterior inexistente.');
    if (previous) { ensure(!state.attachments.some(v => v.previousId === previous.id), 'Este arquivo já tem uma nova versão.'); ensure(previous.birdId === data.birdId && previous.contactId === data.contactId && previous.saleId === data.saleId, 'A substituição deve preservar os vínculos do arquivo.'); }
    const record:Attachment = {...data, id:id(), scope, version:(previous?.version || 0) + 1}; state.attachments.push(record); return {id:record.id};
  }
  if (action === 'document.issue') {
    const data = issuedSchema.parse(input); checkLinks(state, scope, data); checkPayload(data, true);
    ensure(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(data.mime), 'Formato de emissão inválido.');
    const record:IssuedDocument = {...data, id:id(), scope, createdAt:new Date().toISOString()}; state.documents.push(record); return {id:record.id};
  }
  if (action === 'report.schedule') { const data=z.object({name:required,module:required,days:z.number().int().min(1).max(365)}).parse(input); const record={...data,id:id(),scope,lastRun:''}; state.settings.reportSchedules.push(record); return {id:record.id}; }
  if (action === 'report.scheduleRun') { const data=z.object({id:z.string().uuid()}).parse(input); const record=state.settings.reportSchedules.find(v=>v.id===data.id&&v.scope===scope); ensure(record,'Agendamento não encontrado.'); record.lastRun=new Date().toISOString(); return {id:record.id}; }
  return null;
};
export const attachmentStatus = (a: Attachment, currentDate: string): string => a.validUntil && a.validUntil < currentDate ? 'Vencido' : 'Arquivado';

export type ReportColumn = {key:string;label:string;kind?:'cents'|'quantity'};
export type ReportRow = Record<string,string|number|null>;
export type ReportData = {title:string;columns:ReportColumn[];rows:ReportRow[];notes:string[];totals:Record<string,number>};
export const reportNames:Record<string,string> = {birds:'Plantel e histórico',pairs:'Casais',clutches:'Posturas',eggs:'Ovos e indicadores reprodutivos',health:'Saúde e pesagens',tasks:'Tarefas e agenda',attachments:'Documentos e validades',contacts:'Clientes e fornecedores',sales:'Vendas e reservas',items:'Itens vendidos',bills:'Contas a pagar e receber',payments:'Pagamentos e recebimentos',accounts:'Extrato e saldo de contas',stock:'Estoque e inventário',movements:'Movimentos de estoque',audit:'Auditoria'};
export function reportData(state:State, scope:Scope, module:string, from='', to='',filters:Record<string,string>={}):ReportData {
  const birds=state.birds.filter(v=>v.scope===scope); const bird=(v:string|null)=>birds.find(b=>b.id===v)?.identification||''; const contact=(v:string|null)=>state.contacts.find(b=>b.id===v&&b.scope===scope)?.name||'';
  const inPeriod=(value:string)=> (!from || value.slice(0,10)>=from)&&(!to || value.slice(0,10)<=to);
  const scoped=<T extends {scope:Scope}>(items:T[])=>items.filter(v=>v.scope===scope);
  const defs = (fields: string[], centsFields:string[] = []):ReportColumn[]=>fields.map(v=>{const [key,label]=v.split('|');return{key,label:label||key,...(centsFields.includes(key)?{kind:'cents' as const}:{})};});
  let rows:Record<string,unknown>[]=[],columns:ReportColumn[]=[],notes:string[]=[],totals:Record<string,number>={};
  switch(module){
    case 'birds': columns=defs(['identification|Identificação','name|Nome','species|Espécie','sex|Sexo','mutation|Mutação','status|Situação','enclosure|Recinto','origin|Origem','birthDate|Nascimento','date|Cadastro']);rows=birds.map(v=>({...v,date:v.createdAt.slice(0,10)})) as unknown as ReportRow[]; break;
    case 'pairs': columns=defs(['name|Casal','male|Ave 1','female|Ave 2','enclosure|Recinto','date|Início','endDate|Encerramento']);rows=scoped(state.pairs).map(v=>({...v,male:bird(v.maleId),female:bird(v.femaleId),date:v.startDate}));break;
    case 'clutches': columns=defs(['pair|Casal','date|Início','endDate|Encerramento','eggs|Ovos','hatched|Eclodidos']);rows=scoped(state.clutches).map(v=>({...v,pair:state.pairs.find(p=>p.id===v.pairId)?.name||'',date:v.startDate,eggs:scoped(state.eggs).filter(e=>e.clutchId===v.id).length,hatched:scoped(state.eggs).filter(e=>e.clutchId===v.id&&e.chickId).length}));break;
    case 'eggs': columns=defs(['pair|Casal','clutchId|Postura','number|Ovo','date|Postura','fertility|Fertilidade','status|Resultado','hatchDate|Eclosão','chick|Filhote']);rows=scoped(state.eggs).map(v=>({...v,date:v.laidDate,chick:bird(v.chickId),pair:state.pairs.find(p=>p.id===state.clutches.find(c=>c.id===v.clutchId)?.pairId)?.name||''}));break;
    case 'health':columns=defs(['bird|Ave','date|Data','kind|Tipo','title|Registro','weightGrams|Peso (g)','professional|Profissional','author|Autor']);rows=scoped(state.health).map(v=>({...v,bird:bird(v.birdId)}));break;
    case 'tasks':columns=defs(['title|Tarefa','bird|Ave','date|Prazo','status|Situação','notes|Observações']);rows=scoped(state.tasks).map(v=>({...v,bird:bird(v.birdId),date:v.dueDate,status:v.done?'Concluída':'Pendente'}));break;
    case 'attachments':columns=defs(['title|Título','bird|Ave','category|Categoria','date|Data','validUntil|Validade','status|Situação','version|Versão','fileName|Arquivo']);rows=scoped(state.attachments).map(v=>({...v,bird:bird(v.birdId),status:attachmentStatus(v,new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}))}));break;
    case 'contacts':columns=defs(['name|Nome','kind|Tipo','phone|Telefone','email|E-mail','interest|Interesse']);rows=scoped(state.contacts) as unknown as ReportRow[];notes.push('Contatos não têm data de criação; o filtro por período não se aplica.');break;
    case 'sales':columns=defs(['number|Número','date|Data','client|Cliente','status|Situação','totalCents|Valor','receivedCents|Recebido','dueCents|Devido','deliveryDate|Entrega'],['totalCents','receivedCents','dueCents']);rows=scoped(state.sales).map(v=>{const bills=scoped(state.bills).filter(b=>b.saleId===v.id&&!b.cancelled);const receivedCents=salePaid(state,scope,v.id);return{...v,client:contact(v.contactId),receivedCents,dueCents:Math.max(0,bills.reduce((n,b)=>n+b.amountCents,0)-receivedCents)};});notes.push('Vendas realizadas e recebimentos são métricas diferentes. Orçamentos e cancelamentos não compõem o total de vendas realizadas.');break;
    case 'items': columns=defs(['number|Venda','date|Data','client|Cliente','status|Situação','description|Item','quantity|Quantidade','unitCents|Unitário','lineCents|Subtotal'],['unitCents','lineCents']);rows=scoped(state.sales).flatMap(v=>v.items.map(i=>({...i,number:v.number,date:v.date,client:contact(v.contactId),status:v.status,lineCents:itemTotal(i)})));notes.push('Subtotal dos itens antes de descontos e taxas da venda.');break;
    case 'bills':columns=defs(['description|Descrição','date|Vencimento','direction|Direção','client|Contato','category|Categoria','costCenter|Centro de custo','amountCents|Valor','paidCents|Liquidado','dueCents|Aberto','status|Situação'],['amountCents','paidCents','dueCents']);rows=scoped(state.bills).map(v=>{const paidCents=scoped(state.payments).filter(p=>p.billId===v.id&&!p.reversed).reduce((n,p)=>n+p.amountCents,0);return{...v,date:v.dueDate,client:contact(v.contactId),paidCents,dueCents:v.cancelled?0:Math.max(0,v.amountCents-paidCents),status:v.cancelled?'Cancelada':paidCents>=v.amountCents?'Liquidada':'Aberta'};});break;
    case 'payments':columns=defs(['date|Data','description|Conta','direction|Direção','client|Contato','account|Conta financeira','method|Meio','amountCents|Valor','status|Situação'],['amountCents']);rows=scoped(state.payments).map(v=>{const b=state.bills.find(b=>b.id===v.billId&&b.scope===scope);return{...v,description:b?.description||'',direction:b?.direction||'',client:contact(b?.contactId||null),account:state.accounts.find(a=>a.id===v.accountId)?.name||'',status:v.reversed?'Estornado':'Confirmado manualmente'};});notes.push('Transferências entre contas próprias não são receita nem despesa. Estornos não entram nos totais.');break;
    case 'accounts':columns=defs(['name|Conta','openingCents|Saldo inicial','receivedCents|Recebimentos','paidCents|Pagamentos','transferCents|Transferências líquidas','balanceCents|Saldo'],['openingCents','receivedCents','paidCents','transferCents','balanceCents']);rows=scoped(state.accounts).map(v=>{let receivedCents=0,paidCents=0,transferCents=0;scoped(state.payments).filter(p=>p.accountId===v.id&&!p.reversed&&inPeriod(p.date)).forEach(p=>{if(state.bills.find(b=>b.id===p.billId)?.direction==='receber')receivedCents+=p.amountCents;else paidCents+=p.amountCents;});scoped(state.transfers).filter(t=>inPeriod(t.date)).forEach(t=>{if(t.toAccountId===v.id)transferCents+=t.amountCents;if(t.fromAccountId===v.id)transferCents-=t.amountCents;});return{...v,receivedCents,paidCents,transferCents,balanceCents:v.openingCents+receivedCents-paidCents+transferCents};});notes.push('Saldo = inicial + recebimentos − pagamentos + transferências líquidas do período. Com filtro, não equivale ao saldo final histórico: use sem período para saldo completo.');break;
    case 'stock':columns=defs(['name|Produto','unit|Unidade','lot|Lote','expiryDate|Validade','minimum|Mínimo','quantity|Quantidade','supplier|Fornecedor','status|Situação']);rows=scoped(state.products).map(v=>{const quantity=stockBalance(state,scope,v.id);return{...v,quantity,supplier:contact(v.supplierId),status:quantity<v.minimum?'Abaixo do mínimo':'Dentro do mínimo'};});notes.push('Inventário é saldo acumulado atual; o filtro por período não se aplica. Quantidades de unidades distintas não são somadas.');break;
    case 'movements':columns=defs(['date|Data','product|Produto','unit|Unidade','kind|Tipo','quantity|Quantidade','unitCostCents|Custo unitário','costCents|Custo registrado','reason|Motivo'],['unitCostCents','costCents']);rows=scoped(state.stock).map(v=>{const p=state.products.find(p=>p.id===v.productId);return{...v,product:p?.name||'',unit:p?.unit||'',costCents:itemTotal({quantity:Math.abs(v.quantity),unitCents:v.unitCostCents})};});notes.push('Custos registrados não são lucro. Rateios, custos indiretos e margens exigem dados completos. Quantidades são totalizadas por unidade.');break;
    case 'audit':columns=defs(['date|Data','author|Autor','action|Operação','recordId|Registro','reason|Motivo']);rows=scoped(state.audit).map(v=>({...v,date:v.at.slice(0,10)}));break;
    default:throw new Error('Relatório desconhecido.');
  }
  rows=rows.filter(r=>(!r.date || inPeriod(String(r.date)))&&Object.entries(filters).every(([key,value])=>!value||String(r[key]??'').toLocaleLowerCase('pt-BR').includes(value.toLocaleLowerCase('pt-BR'))));
  totals.registros=rows.length;
  if(module==='eggs'){const evaluated=rows.filter(r=>r.fertility!=='desconhecida').length;const fertile=rows.filter(r=>r.fertility==='fértil').length;const hatched=rows.filter(r=>r.chickId).length;totals.avaliados=evaluated;totals.férteis=fertile;totals.desconhecidos=rows.length-evaluated;totals.eclodidos=hatched;notes.push(`Fertilidade: ${fertile}/${evaluated} ovos avaliados (${evaluated? (100*fertile/evaluated).toFixed(1)+'%':'sem denominador'}). Eclosão sobre acompanhados: ${hatched}/${rows.length}. Eclosão sobre férteis: ${rows.filter(r=>r.chickId&&r.fertility==='fértil').length}/${fertile}. Ovos desconhecidos ficam fora da fertilidade.`);}
  if(module==='sales')totals.vendasCents=rows.filter(r=>['vendida','entregue'].includes(String(r.status))).reduce((n,r)=>n+Number(r.totalCents),0);
  if(module==='payments'){totals.recebimentosCents=rows.filter(r=>r.status!=='Estornado'&&r.direction==='receber').reduce((n,r)=>n+Number(r.amountCents),0);totals.pagamentosCents=rows.filter(r=>r.status!=='Estornado'&&r.direction==='pagar').reduce((n,r)=>n+Number(r.amountCents),0);}
  if(module==='movements')for(const row of rows)totals[`quantidade (${row.unit})`]=(totals[`quantidade (${row.unit})`]||0)+Number(row.quantity);
  const visibleRows:ReportRow[]=rows.map(row=>Object.fromEntries([...new Set([...columns.map(c=>c.key),'id'])].map(key=>[key,typeof row[key]==='number'||typeof row[key]==='string'?row[key]:null])));
  return{title:reportNames[module],columns,rows:visibleRows,notes,totals};
}
