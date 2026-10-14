import {describe,expect,it} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {applyCommand} from '../src/domain/engine';
import {deliveryCandidates,salePaid,billOutstanding} from '../src/domain/commercial';
import {bytesToBase64,sha256} from '../src/domain/documents';
import {emptyState,type State} from '../src/domain/types';
import {validateState} from '../src/lib/validation';
function run(state:State,action:string,data:unknown,scope:'real'|'demo'='real'){
 const draft=structuredClone(state),id=applyCommand(draft,scope,action,data);validateState(draft);Object.assign(state,draft);return id!;
}
function fixture(){
 const state=emptyState();const clientId=run(state,'contact.save',{kind:'cliente',name:'Tutor fictício QA'}),otherClientId=run(state,'contact.save',{kind:'cliente',name:'Outro tutor QA'}),accountId=run(state,'account.save',{name:'Caixa QA'});
 const birds=Array.from({length:2},(_,n)=>run(state,'saveBird',{identification:`AVE-QA-${n}`,species:'Calopsita',sex:'indeterminado',mutation:'Não informada',certainty:'informada',origin:'Origem informada',status:'disponível',statusDate:'2024-01-01',sexDate:'2024-01-01',mutationDate:'2024-01-01',custodyDate:'2024-01-01'}));
 const saleId=run(state,'sale.save',{contactId:clientId,date:'2024-01-02',status:'vendida',items:birds.map(refId=>({kind:'ave',refId,description:'Ave fictícia',quantity:1,unitCents:50000})),installments:[{dueDate:'2024-02-01',amountCents:100000}]});
 const file=(overrides:Record<string,unknown>={})=>{const bytes=new TextEncoder().encode('Arquivo de teste isolado');return run(state,'attachment.add',{title:'Exame QA',category:'Exame',date:'2024-01-01',fileName:'exame-qa.txt',mime:'text/plain',size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes),shareWithCustomer:true,birdId:birds[0],...overrides});};
 const doc=async(kind='Caderneta digital',overrides:Record<string,unknown>={})=>{const pdf=await PDFDocument.create();pdf.addPage([100,100]);const bytes=await pdf.save();return run(state,'document.issue',{title:'Documento QA',fileName:'documento-qa.pdf',mime:'application/pdf',base64:bytesToBase64(bytes),sha256:sha256(bytes),size:bytes.length,birdId:birds[0],saleId,kind,...overrides});};
 return {state,clientId,otherClientId,accountId,birds,saleId,file,doc};
}
describe('revisão de entrega e documentos preservados',()=>{
 it('uses metadata without reading attachment or document bodies',async()=>{
  const f=fixture();f.file();await f.doc();for(const record of [...f.state.attachments,...f.state.documents])Object.defineProperty(record,'base64',{get(){throw new Error('A revisão leu o corpo do arquivo');}});
  expect(deliveryCandidates(f.state,'real',f.saleId)).toHaveLength(2);
 });
 it('keeps only approved linked tutor files and excludes private files, foreign clients/scopes and managerial reports',async()=>{
  const f=fixture(),safe=f.file();f.file({title:'Custo interno',shareWithCustomer:false});f.file({title:'Outro cliente',contactId:f.otherClientId});f.file({title:'Sem vínculo',birdId:null});
  const doc=await f.doc();await f.doc('Relatório financeiro');await f.doc('Recibo de pagamento',{birdId:null});await f.doc('Termo de entrega',{birdId:null,saleId:null});
  const candidates=deliveryCandidates(f.state,'real',f.saleId);expect(candidates.map(c=>c.id)).toContain(safe);expect(candidates.map(c=>c.id)).toContain(doc);expect(candidates).toHaveLength(3);
  expect(candidates.map(c=>c.title)).not.toContain('Custo interno');expect(deliveryCandidates(f.state,'real',f.saleId).every(c=>c.type==='attachment'||c.type==='document')).toBe(true);
  const foreign=structuredClone(f.state);foreign.attachments[0].scope='demo';expect(deliveryCandidates(foreign,'real',f.saleId).some(c=>c.id===safe)).toBe(false);
 });
 it('excludes internal purchase, expense and closing files despite a shared historical supplier/client contact and sharing flag',()=>{
  const f=fixture();run(f.state,'contact.save',{id:f.clientId,kind:'fornecedor',name:'Tutor e fornecedor legado QA'});
  const uploaded={title:'Comprovante de custo interno',category:'Financeiro',date:'2024-01-02',fileName:'custo-interno.txt',mime:'text/plain',base64:bytesToBase64(new TextEncoder().encode('Custo interno sintético')),size:25,sha256:sha256(new TextEncoder().encode('Custo interno sintético')),shareWithCustomer:true};
  uploaded.size=new TextEncoder().encode('Custo interno sintético').length;
  const expense=run(f.state,'save.withAttachments',{action:'bill.save',data:{direction:'pagar',contactId:f.clientId,category:'Custo interno',description:'Despesa interna QA',dueDate:'2024-01-02',amountCents:1000},attachments:[uploaded]});
  run(f.state,'save.withAttachments',{action:'payment.record',data:{billId:expense,accountId:f.accountId,date:'2024-01-02',amountCents:1000,method:'Pagamento QA',idempotencyKey:'expense-private-QA'},attachments:[uploaded]});
  const purchase=run(f.state,'save.withAttachments',{action:'purchase.save',data:{idempotencyKey:'purchase-private-QA',supplierId:f.clientId,product:{name:'Material interno QA',unit:'un',lot:'QA'},date:'2024-01-02',dueDate:'2024-01-02',quantity:1,totalCents:1000,payment:{accountId:f.accountId,date:'2024-01-02',method:'Pagamento QA'}},attachments:[uploaded]});
  run(f.state,'purchase.cancel',{id:purchase,revision:1,idempotencyKey:'cancel-private-QA',date:'2024-01-03',reason:'Devolução registrada QA'});
  const restitution=f.state.purchases[0].refundBillId!;f.file({sourceType:'bill',sourceId:restitution,contactId:f.clientId,birdId:null,title:'Restituição de custo interno'});
  const closing=run(f.state,'closing.create',{accountId:f.accountId,date:'2024-01-03',countedCents:0,notes:'Diferença sintética explicada'});
  f.file({sourceType:'closing',sourceId:closing,contactId:f.clientId,birdId:null,title:'Conferência interna'});
  const incoming=run(f.state,'save.withAttachments',{action:'payment.record',data:{billId:f.state.bills.find(b=>b.saleId===f.saleId)!.id,accountId:f.accountId,date:'2024-01-03',amountCents:500,method:'Recebimento da venda QA',idempotencyKey:'sale-receipt-QA'},attachments:[{...uploaded,title:'Comprovante recebido do tutor'}]});
  const before=structuredClone(f.state.attachments),candidates=deliveryCandidates(f.state,'real',f.saleId);
  expect(candidates).toHaveLength(1);expect(candidates[0].id).toBe(f.state.attachments.find(file=>file.sourceType==='payment'&&file.sourceId===incoming)!.id);
  expect(f.state.attachments).toEqual(before);expect(f.state.attachments.every(file=>file.base64)).toBe(true);
  const internal=f.state.attachments.find(file=>file.sourceType==='purchase')!;
  expect(()=>run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-04',reason:'Entrega QA',deliveryFiles:[{type:'attachment',id:internal.id}]})).toThrow(/não está autorizado/);
 });
 it('records an immutable version snapshot and does not rewrite files or previous delivery on a repeated action',async()=>{
  const f=fixture(),attachmentId=f.file(),documentId=await f.doc();const originals=structuredClone({attachments:f.state.attachments,documents:f.state.documents});
  const selected=[{type:'attachment',id:attachmentId},{type:'document',id:documentId}];run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-03',reason:'Entrega confirmada QA',deliveryFiles:selected});
  const sale=f.state.sales[0],manifest=structuredClone(sale.deliveryManifest);expect(manifest).toEqual(selected.map(reference=>{const file=reference.type==='attachment'?f.state.attachments[0]:f.state.documents[0];return {...reference,sha256:file.sha256,fileName:file.fileName};}));
  expect(sale.deliveryManifestDate).toBe('2024-01-03');expect(f.state.attachments).toEqual(originals.attachments);expect(f.state.documents).toEqual(originals.documents);
  run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-04',reason:'Repetição QA',deliveryFiles:[]});expect(f.state.sales[0].deliveryManifest).toEqual(manifest);expect(f.state.sales[0].deliveryManifestDate).toBe('2024-01-03');
  expect(validateState(JSON.parse(JSON.stringify(f.state))).sales[0].deliveryManifest).toEqual(manifest);
 });
 it('rejects unrelated or private files, duplicates and oversized packages before changing custody or delivery',async()=>{
  const f=fixture(),safe=f.file(),privateId=f.file({shareWithCustomer:false});const before=structuredClone(f.state);
  for(const references of [[{type:'attachment',id:privateId}],[{type:'document',id:'missing'}],[{type:'attachment',id:safe},{type:'attachment',id:safe}]])expect(()=>run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-03',reason:'QA',deliveryFiles:references})).toThrow(/arquivo|Arquivo/);
  expect(f.state).toEqual(before);
  f.state.attachments[0].size=41*1024*1024;expect(()=>run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-03',reason:'QA',deliveryFiles:[{type:'attachment',id:safe}]})).toThrow(/40 MB/);expect(f.state.sales[0].status).toBe('vendida');
 });
 it('preserves the financial separation for a two-bird sale, partial payments and delivery',()=>{
  const f=fixture(),bill=f.state.bills[0];run(f.state,'payment.record',{billId:bill.id,accountId:f.accountId,date:'2024-01-02',amountCents:20000,method:'Sinal confirmado',idempotencyKey:'signal-QA'});
  expect(f.state.sales).toHaveLength(1);expect(f.state.sales[0].items).toHaveLength(2);expect(f.state.sales[0].totalCents).toBe(100000);expect(salePaid(f.state,'real',f.saleId)).toBe(20000);expect(billOutstanding(f.state,'real',bill)).toBe(80000);
  run(f.state,'payment.record',{billId:bill.id,accountId:f.accountId,date:'2024-01-03',amountCents:30000,method:'Parcial confirmado',idempotencyKey:'partial-QA'});expect(salePaid(f.state,'real',f.saleId)).toBe(50000);expect(billOutstanding(f.state,'real',bill)).toBe(50000);
  run(f.state,'sale.transition',{id:f.saleId,status:'entregue',date:'2024-01-04',reason:'Entrega QA',deliveryFiles:[]});expect(f.state.sales).toHaveLength(1);expect(f.state.payments).toHaveLength(2);expect(f.state.sales[0].totalCents).toBe(100000);expect(salePaid(f.state,'real',f.saleId)).toBe(50000);expect(billOutstanding(f.state,'real',bill)).toBe(50000);
 });
});
