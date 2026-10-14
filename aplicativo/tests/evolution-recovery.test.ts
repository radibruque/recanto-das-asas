import { beforeEach,describe,expect,it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createBackup,inspectBackup } from '../src/lib/backup';
import { Vault } from '../src/lib/storage';
import { applyCommand } from '../src/domain/engine';
import { emptyState,type State } from '../src/domain/types';
import { bytesToBase64,sha256 } from '../src/domain/documents';
import { validateState } from '../src/lib/validation';
import { billPaid,billOutstanding,stockBalance } from '../src/domain/commercial';
const password='senha-fictícia-isolada-QA';
const file=(name='nota-compra.txt',content='Documento sintético sem dados pessoais')=>{
 const bytes=new TextEncoder().encode(content);return {fileName:name,mime:'text/plain',size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes),title:'Nota da compra',category:'Compra',date:'2024-01-02',issuer:'',reference:'',validUntil:'',notes:'Documento fictício isolado',shareWithCustomer:false};
};
function fixture(){
 const state=emptyState(),supplierId=applyCommand(state,'real','contact.save',{kind:'fornecedor',name:'Fornecedor QA'})!,accountId=applyCommand(state,'real','account.save',{name:'Conta QA',openingCents:100000})!;
 const data={idempotencyKey:'purchase-file-qa',product:{name:'Material QA',unit:'kg',lot:'L-QA'},supplierId,date:'2024-01-02',dueDate:'2024-01-10',quantity:2,totalCents:5000,payment:{accountId,date:'2024-01-02',method:'Pagamento confirmado'}};
 return {state,data,supplierId,accountId};
}
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true}));
describe('integridade, retomada e backup da evolução',()=>{
 it('keeps purchase, payment and files unique after repeating a lost-success attachment transaction',()=>{
  const f=fixture(),batch={action:'purchase.save',data:f.data,attachments:[file()]};
  const id=applyCommand(f.state,'real','save.withAttachments',batch)!;applyCommand(f.state,'real','save.withAttachments',batch);
  expect(f.state.purchases).toHaveLength(1);expect(f.state.stock).toHaveLength(1);expect(f.state.bills).toHaveLength(1);expect(f.state.payments).toHaveLength(1);expect(f.state.attachments).toHaveLength(1);
  expect(f.state.attachments[0]).toMatchObject({sourceType:'purchase',sourceId:id,contactId:f.supplierId,birdId:null});
  expect(f.state.purchases[0].operations[0].attachmentIds).toEqual([f.state.attachments[0].id]);expect(validateState(f.state).attachments).toEqual(f.state.attachments);
 });
 it('rejects a repeated operation with changed file metadata or content, keeping the accepted purchase intact',()=>{
  const f=fixture(),batch={action:'purchase.save',data:f.data,attachments:[file()]};applyCommand(f.state,'real','save.withAttachments',batch);const before=structuredClone(f.state);
  expect(()=>applyCommand(f.state,'real','save.withAttachments',{...batch,attachments:[{...file(),title:'Outro título'}]})).toThrow(/lote de anexos/);
  expect(()=>applyCommand(f.state,'real','save.withAttachments',{...batch,attachments:[{...file(),base64:file('nota-compra.txt','Conteúdo modificado').base64}]})).toThrow(/conteúdo|Conteúdo/);
  expect(f.state).toEqual(before);
 });
 it('rolls back the paid purchase and its first valid file when the next attachment fails',()=>{
  const f=fixture(),before=structuredClone(f.state);
  expect(()=>applyCommand(f.state,'real','save.withAttachments',{action:'purchase.save',data:f.data,attachments:[file(),{...file('inválido.txt'),sha256:'0'.repeat(64)}]})).toThrow(/integridade/);expect(f.state).toEqual(before);
 });
 it('round-trips the species parameters, task source/completion, purchase links, audit and attachment bytes in a verified backup',async()=>{
  const f=fixture();applyCommand(f.state,'real','save.withAttachments',{action:'purchase.save',data:f.data,attachments:[file()]});
  const birdId=applyCommand(f.state,'real','saveBird',{identification:'QA-REAL',species:'Espécie QA',sex:'indeterminado',mutation:'Não informada',certainty:'informada',origin:'Origem informada'})!;
  applyCommand(f.state,'real','species.save',{id:f.state.birds[0].speciesId,name:'Espécie QA',incubationDays:null,eggCheckDays:7,chickFollowupDays:null,parameterSource:'Referência sintética QA',active:true});
  const taskId=applyCommand(f.state,'real','saveTask',{birdId,title:'Histórico QA',dueDate:'2024-02-01'})!;applyCommand(f.state,'real','toggleTask',{id:taskId,done:true});
  const backup=await createBackup(f.state,[],async()=>new Uint8Array());const inspected=await inspectBackup(backup);
  expect(inspected.state).toEqual(validateState(f.state));expect(inspected.state.attachments[0].base64).toBe(file().base64);expect(inspected.state.purchases[0].billId).toBe(f.state.bills[0].id);
 });
 it('reopens the encrypted vault offline without losing a purchase or direct attachment and retries without duplicate records',async()=>{
  const vault=new Vault();await vault.create(password);const f=fixture();await vault.restore(f.state);
  const batch={action:'purchase.save',data:f.data,attachments:[file()]};await vault.mutate(state=>applyCommand(state,'real','save.withAttachments',batch));vault.lock();
  const reloaded=new Vault();const state=await reloaded.unlock(password);expect(state.purchases).toHaveLength(1);expect(state.attachments[0].base64).toBe(file().base64);await reloaded.mutate(current=>applyCommand(current,'real','save.withAttachments',batch));
  const restored=await reloaded.load();expect(restored.purchases).toHaveLength(1);expect(restored.stock).toHaveLength(1);expect(restored.payments).toHaveLength(1);expect(stockBalance(restored,'real',restored.purchases[0].productId)).toBe(2);expect(billPaid(restored,'real',restored.purchases[0].billId)).toBe(5000);expect(billOutstanding(restored,'real',restored.bills[0])).toBe(0);
 });
 it('rejects lost purchase links rather than silently stripping the new collection during recovery',()=>{
  const f=fixture();applyCommand(f.state,'real','purchase.save',f.data);const invalid=structuredClone(f.state);invalid.stock[0].purchaseId='other';expect(()=>validateState(invalid)).toThrow(/vínculos/);
  const invalidSchema={...f.state,schemaVersion:4};expect(()=>validateState(invalidSchema)).toThrow(/incompatível/);
 });
});
