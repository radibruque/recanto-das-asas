import { z } from 'zod';
import { breedingHandler } from './breeding';
import { commercialHandler } from './commercial';
import { documentsHandler, sha256 } from './documents';
import { speciesHandler } from './species';
import { purchaseHandler } from './purchases';
import { reconcileDerivedTasks } from './derived-tasks';
import { ensure, id, required, text, today } from './shared';
import type { State, Scope } from './types';
import { APP_VERSION } from './types';
import { previewImport } from '../lib/import';
const canonicalMetadata=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonicalMetadata).join(',')+']':value&&typeof value==='object'?'{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonicalMetadata(v)).join(',')+'}':JSON.stringify(value)??'null';
export function applyCommand(state:State,scope:Scope,action:string,data:unknown):string|undefined {
 if(!['real','demo'].includes(scope))throw new Error('Espaço inválido.');
 if(action==='attachment.addBatch'){
  const input=z.object({birdId:required,attachments:z.array(z.record(z.unknown())).min(1).max(20)}).parse(data);
  if(input.attachments.reduce((sum,file)=>sum+(typeof file.size==='number'?file.size:0),0)>40*1024*1024)throw new Error('Envie até 40 MB de anexos por registro.');
  if(input.attachments.filter(file=>file.role==='photo').length>1)throw new Error('Escolha somente uma foto principal da ave.');
  const draft=structuredClone(state),bird=draft.birds.find(b=>b.id===input.birdId&&b.scope===scope);
  if(!bird)throw new Error('Ave não encontrada neste espaço.');
  for(const file of input.attachments){
   if(file.role==='photo'&&!['image/jpeg','image/png'].includes(String(file.mime)))throw new Error('A foto principal deve ser JPG ou PNG.');
   const recordId=applyCommand(draft,scope,'attachment.add',{...file,birdId:bird.id,contactId:null,saleId:null,previousId:null,sourceType:'bird',sourceId:bird.id});
   if(!recordId)throw new Error('Não foi possível vincular o arquivo.');
   if(file.role==='photo')bird.photoId=recordId;
  }
  Object.assign(state,draft);
  return bird.id;
 }
 if(action==='save.withAttachments'){
  const batch=z.object({action:z.enum(['saveBird','bird.booklet','saveHealth','saveTask','saveMutation','contact.save','sale.save','bill.save','payment.record','product.save','purchase.save','closing.create']),data:z.record(z.unknown()),attachments:z.array(z.record(z.unknown())).max(20)}).parse(data);
  const total=batch.attachments.reduce((sum,a)=>sum+(typeof a.size==='number'?a.size:0),0);
  if(total>40*1024*1024)throw new Error('Envie até 40 MB de anexos por cadastro.');
  if(batch.attachments.filter(a=>a.role==='photo').length>1)throw new Error('Escolha somente uma foto principal da ave.');
  // Commit parent, attachments and links together; cancellation/failure creates no orphan files.
  const draft=structuredClone(state);
  const recordId=applyCommand(draft,scope,batch.action,batch.data);
  if(!recordId)throw new Error('O registro não retornou uma identificação para vincular os arquivos.');
  const purchaseOperation=batch.action==='purchase.save'?draft.purchases.find(p=>p.id===recordId&&p.scope===scope)?.operations.find(op=>op.key===batch.data.idempotencyKey):undefined;
  const attachmentFingerprint=sha256(new TextEncoder().encode(canonicalMetadata(batch.attachments.map(({base64:_,...metadata})=>metadata))));
  if(purchaseOperation){
   const oldOperation=state.purchases.find(p=>p.id===recordId&&p.scope===scope)?.operations.find(op=>op.key===purchaseOperation.key);
   if(oldOperation){
    ensure(oldOperation.attachmentFingerprint===attachmentFingerprint||(batch.attachments.length===0&&!oldOperation.attachmentFingerprint),'Esta compra já foi registrada com outro lote de anexos. Abra o registro para anexar arquivos adicionais.');
    const files=oldOperation.attachmentIds??[];
    ensure(files.length===batch.attachments.length&&files.every((fileId,index)=>state.attachments.find(a=>a.id===fileId&&a.scope===scope)?.base64===batch.attachments[index].base64),'O conteúdo dos anexos difere do lote já registrado.');
    Object.assign(state,draft);return recordId;
   }
   purchaseOperation.attachmentFingerprint=attachmentFingerprint;purchaseOperation.attachmentIds=[];
  }
  const sourceType:Record<string,string>={saveBird:'bird','bird.booklet':'booklet',saveHealth:'health',saveTask:'task',saveMutation:'mutation','contact.save':'contact','sale.save':'sale','bill.save':'bill','payment.record':'payment','product.save':'product','purchase.save':'purchase','closing.create':'closing'};
  let birdId:string|null=null,contactId:string|null=null,saleId:string|null=null;
  if(batch.action==='saveBird'||batch.action==='bird.booklet')birdId=recordId;
  if(batch.action==='saveHealth')birdId=draft.health.find(r=>r.id===recordId&&r.scope===scope)?.birdId??null;
  if(batch.action==='saveTask')birdId=draft.tasks.find(r=>r.id===recordId&&r.scope===scope)?.birdId??null;
  if(batch.action==='saveMutation')birdId=draft.mutations.find(r=>r.id===recordId&&r.scope===scope)?.birdId??null;
  if(batch.action==='contact.save')contactId=recordId;
  if(batch.action==='purchase.save')contactId=draft.purchases.find(p=>p.id===recordId&&p.scope===scope)?.supplierId??null;
  if(batch.action==='sale.save')saleId=recordId;
  let billId=batch.action==='bill.save'?recordId:batch.action==='payment.record'?draft.payments.find(r=>r.id===recordId&&r.scope===scope)?.billId:null;
  if(billId){const bill=draft.bills.find(b=>b.id===billId&&b.scope===scope);contactId=bill?.contactId??null;saleId=bill?.saleId??null;}
  if(saleId){const sale=draft.sales.find(s=>s.id===saleId&&s.scope===scope);contactId=sale?.contactId??contactId;const birdItems=sale?.items.filter(i=>i.kind==='ave').map(i=>i.refId).filter((v):v is string=>!!v)??[];if(birdItems.length===1)birdId=birdItems[0];}
  for(const file of batch.attachments){
   if(file.role==='photo'&&(!birdId||!['image/png','image/jpeg'].includes(String(file.mime))))throw new Error('A foto principal deve ser JPG ou PNG e pertencer a uma ave.');
   const added=applyCommand(draft,scope,'attachment.add',{...file,birdId,contactId,saleId,previousId:null,sourceType:sourceType[batch.action],sourceId:recordId});
   if(!added)throw new Error('Não foi possível vincular o arquivo.');
   purchaseOperation?.attachmentIds?.push(added);
   if(batch.action==='saveHealth'){const health=draft.health.find(r=>r.id===recordId&&r.scope===scope)!;health.attachmentIds.push(added);}
   if(file.role==='photo'){const bird=draft.birds.find(b=>b.id===birdId&&b.scope===scope)!;bird.photoId=added;}
   if(batch.action==='saveMutation'){const mutation=draft.mutations.find(m=>m.id===recordId&&m.scope===scope);if(mutation&&!mutation.attachmentId)mutation.attachmentId=added;}
  }
  Object.assign(state,draft);
  return recordId;
 }
 let recordId:string|undefined;
 if(action==='initializeDemo'){
  if(scope!=='demo')throw new Error('Exemplos só podem ser criados na demonstração.');
  if(state.birds.some(b=>b.scope==='demo'))return undefined;
  const first=breedingHandler(state,scope,'saveBird',{identification:'EX-001',name:'Azul',species:'Periquito-australiano (Melopsittacus undulatus)',sex:'macho',mutation:'Azul',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-04-12',status:'reprodutor'});
  const second=breedingHandler(state,scope,'saveBird',{identification:'EX-002',name:'Lua',species:'Periquito-australiano (Melopsittacus undulatus)',sex:'fêmea',mutation:'Verde',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-06-08',status:'reprodutor'});
  const pair=breedingHandler(state,scope,'createPair',{name:'Casal de exemplo',maleId:first?.id,femaleId:second?.id,startDate:'2026-09-01'});
  const clutch=breedingHandler(state,scope,'createClutch',{pairId:pair?.id,startDate:'2026-09-10'});
  breedingHandler(state,scope,'createEgg',{clutchId:clutch?.id,laidDate:'2026-09-11'});
  breedingHandler(state,scope,'saveBird',{identification:'EX-003',name:'Pingo',species:'Calopsita (Nymphicus hollandicus)',sex:'macho',mutation:'Cinza',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-01-20',status:'disponível'});
  commercialHandler(state,scope,'contact.save',{kind:'cliente',name:'Cliente fictício',phone:'',email:'',notes:'Somente demonstração'});
  commercialHandler(state,scope,'account.save',{name:'Caixa fictício',openingCents:0});
  recordId=first?.id;
 }else if(action==='birds.import'){
  const d=z.object({csv:z.string().max(5*1024*1024)}).parse(data);const rows=previewImport(d.csv,state,scope);if(!rows.length||rows.some(r=>r.errors.length))throw new Error('Corrija todas as linhas da prévia antes de importar.');
  const mappings=new Map(state.birds.filter(b=>b.scope===scope).map(b=>[b.identification,b.id]));
  for(const row of rows){const v=row.values;const result=breedingHandler(state,scope,'saveBird',{identification:v.identificacao,name:v.nome,species:v.especie,sex:v.sexo,mutation:v.mutacao,certainty:'informada',mutationSource:'Planilha importada pelo proprietário',origin:v.origem,birthDate:v.nascimento,status:'manejo'});if(result?.id)mappings.set(v.identificacao,result.id);}
  for(const row of rows){const v=row.values;if(!v.pai&&!v.mae)continue;const bird=state.birds.find(b=>b.id===mappings.get(v.identificacao))!;breedingHandler(state,scope,'saveBird',{...bird,fatherId:v.pai?mappings.get(v.pai):null,motherId:v.mae?mappings.get(v.mae):null,mutationSource:'Planilha importada pelo proprietário'});}
  recordId='importacao-'+rows.length;
 }else if(action==='settings.save'){
  const values=z.object({name:required,phone:text,email:text,address:text,backupDays:z.number().int().min(1).max(365),categories:z.array(required).min(1).max(100),speciesEstimates:z.record(z.number().int().min(1).max(365)).optional(),derivedTaskRules:z.object({hatch:z.boolean(),eggCheck:z.boolean(),chickFollowup:z.boolean()}).optional()}).parse(data);
  if(values.speciesEstimates&&(Object.keys(values.speciesEstimates).length!==Object.keys(state.settings.speciesEstimates).length||Object.entries(values.speciesEstimates).some(([name,days])=>state.settings.speciesEstimates[name]!==days)))throw new Error('Edite os parâmetros pelo catálogo de espécies e informe a fonte.');
  Object.assign(state.settings,Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined)));recordId='settings';
 }else if(action==='task.recalculate'){
  recordId='agenda';
 }else if(action==='backup.record'){
  const d=z.object({at:required,sha256:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().positive()}).parse(data);state.settings.lastBackupAt=d.at;state.settings.backupHistory.push({...d,verified:true});state.settings.backupHistory=state.settings.backupHistory.slice(-100);recordId=d.sha256;
 }else if(action==='support.save'){
  const d=z.object({id:z.string().optional(),description:required,steps:text,expected:text,actual:text,errorCode:text,priority:z.enum(['baixa','normal','alta']),status:z.enum(['aberto','em análise','corrigido']).default('aberto'),fixedVersion:text}).parse(data);
  const old=d.id?state.support.find(s=>s.id===d.id):undefined;if(d.id&&!old)throw new Error('Relato não encontrado.');
  const record={...d,id:old?.id??id(),number:old?.number??'RA-'+(state.support.length+1).toString().padStart(5,'0'),createdAt:old?.createdAt??new Date().toISOString(),version:old?.version??APP_VERSION,platform:typeof navigator==='undefined'?'Teste Node.js':navigator.userAgent};
  if(old)state.support[state.support.indexOf(old)]=record;else state.support.push(record);recordId=record.id;
 }else{
  const result=breedingHandler(state,scope,action,data)??purchaseHandler(state,scope,action,data)??commercialHandler(state,scope,action,data)??speciesHandler(state,scope,action,data)??documentsHandler(state,scope,action,data);
  if(!result)throw new Error('Operação não reconhecida.');recordId=result.id;
 }
 if(['settings.save','species.save'].includes(action)){reconcileDerivedTasks(state,'real');reconcileDerivedTasks(state,'demo');}
 else if(['saveBird','createPair','closePair','createClutch','closeClutch','createEgg','saveEgg','eggOutcome','hatchEgg','task.recalculate','saveTask','toggleTask'].includes(action))reconcileDerivedTasks(state,scope);
 const reason=data&&typeof data==='object'&&'reason' in data&&typeof data.reason==='string'?data.reason:'';
 state.audit.push({id:id(),scope,at:new Date().toISOString(),author:'Proprietário',action,recordId:recordId??'',reason});
 return recordId;
}
