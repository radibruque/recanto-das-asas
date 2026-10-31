import { bookletDataSchema } from '../domain/booklet-data';
import { z } from 'zod';
import type { State } from '../domain/types';
import { date } from '../domain/shared';
import { migrateState } from '../domain/migrations';
const s=z.string().max(10000),ref=z.string().min(1).max(150),nullable=ref.nullable(),d=z.union([date,z.literal('')]),n=z.number().finite(),c=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),scope=z.enum(['real','demo']);
const base={id:ref,scope};
const status=z.enum(['filhote','manejo','reprodutor','disponível','reservado','vendido','doado','transferido','falecido']);
const b64=z.string().max(14000000);
const parameter=z.number().int().min(1).max(365).nullable();
const taskHistory=z.object({at:s,action:z.enum(['gerada','reprogramada','concluída','reaberta','resolvida','reativada','editada']),dueDate:date,reason:s});
const purchaseHistory=z.object({at:s,action:z.enum(['criada','corrigida','cancelada']),revision:z.number().int().positive(),reason:s,date:date,productId:ref,stockMovementId:ref,billId:ref,supplierId:nullable,quantity:n.positive(),totalCents:c,dueDate:date,notes:s,compensationId:ref.optional(),status:z.enum(['ativa','cancelada']).optional(),paymentId:nullable.optional(),refundBillId:nullable.optional()});
const deliveryFile=z.object({type:z.enum(['attachment','document']),id:ref,sha256:z.string().regex(/^[a-f0-9]{64}$/),fileName:ref});
const schema=z.object({
 schemaVersion:z.literal(3),revision:c,
 birds:z.array(z.object({...base,booklet:bookletDataSchema.optional(),identification:ref,name:s,species:ref,speciesId:ref.optional(),sex:z.enum(['macho','fêmea','indeterminado']),mutation:ref,certainty:z.enum(['observada','informada','confirmada']),carriers:s,origin:ref,notes:s,birthDate:d,fatherId:nullable,motherId:nullable,createdAt:s,status,scientificName:s,microchip:s,sexMethod:s,sexSource:s,visualDescription:s,birthEstimated:z.boolean(),breeder:s,supplierId:nullable,acquiredDate:d,acquisitionCents:c,priceCents:c.optional(),enclosure:s,responsible:s,photoId:nullable,acquisitionMethod:s.optional(),custodyHistory:z.array(z.object({date:date,responsible:s,enclosure:s,reason:s})).optional(),sexHistory:z.array(z.object({date:s,sex:s,method:s,source:s,notes:s,attachmentId:nullable})).optional(),statusHistory:z.array(z.object({date:s,status,reason:s}))})),
 pairs:z.array(z.object({...base,name:ref,maleId:ref,femaleId:ref,startDate:date,endDate:date.nullable(),notes:s,enclosure:s,relatedAcknowledged:z.boolean()})),
 clutches:z.array(z.object({...base,pairId:ref,startDate:date,endDate:date.nullable(),notes:s})),
 eggs:z.array(z.object({...base,clutchId:ref,number:z.number().int().positive(),laidDate:date,status:z.enum(['incubando','infértil','perdido','eclodido']),hatchDate:date.nullable(),chickId:nullable,notes:s,fertility:z.enum(['desconhecida','fértil','infértil']),incubationDate:d,expectedHatchDate:d,expectedHatchSource:z.enum(['manual','species','legacy']).optional(),outcomeDate:date.nullable().optional(),events:z.array(z.object({date:date,kind:s,notes:s})).optional()})),
 mutations:z.array(z.object({...base,birdId:ref,mutation:ref,certainty:s,carriers:s,recordedAt:s,source:s.optional(),notes:s.optional(),date:s.optional(),attachmentId:nullable.optional()})),
 health:z.array(z.object({...base,birdId:ref,date:date,kind:ref,title:ref,notes:s,weightGrams:n.nonnegative().nullable(),professional:s,author:s,attachmentIds:z.array(ref)})),
 tasks:z.array(z.object({...base,birdId:nullable,title:ref,dueDate:date,done:z.boolean(),notes:s,origin:z.enum(['manual','derived']).optional(),sourceType:z.enum(['bird','clutch','egg','pair']).optional(),sourceId:ref.optional(),derivationKey:ref.optional(),resolvedAt:s.optional(),resolutionReason:s.optional(),derivationNotes:s.optional(),history:z.array(taskHistory).optional(),reminderTime:z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),z.literal('')]).optional(),reminderMinutes:z.union([z.literal(0),z.literal(5),z.literal(15),z.literal(30),z.literal(60),z.literal(1440)]).optional()})),
 contacts:z.array(z.object({...base,kind:z.enum(['cliente','fornecedor','interessado']),name:ref,phone:s,email:s,address:s,taxId:s,notes:s,interest:s})),
 sales:z.array(z.object({...base,number:ref,contactId:ref,date:date,status:z.enum(['orçamento','reservada','vendida','entregue','cancelada','devolvida']),items:z.array(z.object({id:ref,kind:z.enum(['ave','produto','serviço']),refId:nullable,description:ref,quantity:n.positive(),unitCents:c})),discountCents:c,feeCents:c,totalCents:c,notes:s,deliveryDate:d,deliveryManifest:z.array(deliveryFile).max(20).optional(),deliveryManifestDate:date.optional(),statusHistory:z.array(z.object({date:s,status:s,reason:s}))})),
 accounts:z.array(z.object({...base,name:ref,openingCents:z.number().int().safe()})),
 bills:z.array(z.object({...base,direction:z.enum(['pagar','receber']),contactId:nullable,saleId:nullable,category:ref,costCenter:s,description:ref,dueDate:date,amountCents:c,cancelled:z.boolean(),purchaseId:ref.optional()})),
 payments:z.array(z.object({...base,billId:ref,accountId:ref,date:date,amountCents:c,method:ref,idempotencyKey:ref,reversed:z.boolean(),reversalReason:s,manual:z.boolean(),reconciledAt:s.optional(),reversalDate:s.optional()})),
 transfers:z.array(z.object({...base,fromAccountId:ref,toAccountId:ref,date:date,amountCents:c,reason:s})),
 products:z.array(z.object({...base,name:ref,unit:ref,minimum:n.nonnegative(),lot:s,expiryDate:d,supplierId:nullable,quantityPrecision:z.number().int().min(0).max(6).optional()})),
 stock:z.array(z.object({...base,productId:ref,date:date,quantity:n,unitCostCents:c,kind:z.enum(['compra','consumo','venda','perda','ajuste','devolução']),reason:s,saleId:nullable,purchaseId:ref.optional(),reversalOfId:ref.optional()})),
 purchases:z.array(z.object({...base,revision:z.number().int().positive(),status:z.enum(['ativa','cancelada']),productId:ref,stockMovementId:ref,billId:ref,paymentId:nullable,supplierId:nullable,refundBillId:nullable,date:date,dueDate:date,quantity:n.positive(),totalCents:c,notes:s,createdAt:s,cancelledDate:date.optional(),history:z.array(purchaseHistory),operations:z.array(z.object({key:ref,fingerprint:z.string().max(100000),revision:z.number().int().positive(),attachmentFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),attachmentIds:z.array(ref).max(20).optional()}))})),
 closings:z.array(z.object({...base,accountId:ref,date:date,expectedCents:z.number().int().safe(),countedCents:z.number().int().safe(),notes:s,recordedAt:s.optional(),previousClosingId:nullable.optional(),snapshot:z.object({openingCents:z.number().int().safe(),incomeCents:c,expenseCents:c,transferInCents:c,transferOutCents:c,reversalCents:z.number().int().safe(),paymentIds:z.array(ref),transferIds:z.array(ref)}).optional()})),
 attachments:z.array(z.object({...base,sourceType:z.string().max(60).optional(),sourceId:nullable.optional(),birdId:nullable,contactId:nullable,saleId:nullable,title:ref,category:ref,date:date,issuer:s,reference:s,validUntil:d,notes:s,shareWithCustomer:z.boolean(),fileName:ref,mime:ref,size:c,base64:b64,version:z.number().int().positive(),previousId:nullable,sha256:z.string().regex(/^[a-f0-9]{64}$/)})),
 documents:z.array(z.object({...base,birdId:nullable,saleId:nullable,kind:ref,title:ref,createdAt:s,fileName:ref,mime:ref,base64:b64,size:c,sha256:z.string().regex(/^[a-f0-9]{64}$/)})),
 support:z.array(z.object({id:ref,number:ref,createdAt:s,version:ref,platform:s,description:s,steps:s,expected:s,actual:s,errorCode:s,priority:z.enum(['baixa','normal','alta']),status:z.enum(['aberto','em análise','corrigido']),fixedVersion:s})),
 audit:z.array(z.object({...base,at:s,author:s,action:ref,recordId:s,reason:s})),
 settings:z.object({name:ref,phone:s,email:s,address:s,version:ref,backupDays:z.number().int().min(1).max(365),lastBackupAt:s,backupHistory:z.array(z.object({at:s,sha256:ref,size:c,verified:z.boolean()})),categories:z.array(ref),speciesEstimates:z.record(z.number().int().min(1).max(365)),speciesCatalog:z.array(z.object({id:ref,name:ref,aliases:z.array(ref),incubationDays:parameter,eggCheckDays:parameter,chickFollowupDays:parameter,parameterSource:s,active:z.boolean()})),derivedTaskRules:z.object({hatch:z.boolean(),eggCheck:z.boolean(),chickFollowup:z.boolean()}),reportSchedules:z.array(z.object({id:ref,scope,name:ref,module:ref,days:z.number().int().min(1).max(365),lastRun:s})),devices:z.array(z.object({id:ref,name:ref,platform:s,lastSeen:s})).max(30).optional()})
});
export function validateState(value:unknown):State {
 const parsed=schema.safeParse(migrateState(value));
 if(!parsed.success)throw new Error('Base incompatível ou inválida: '+parsed.error.issues[0].path.join('.')+' — '+parsed.error.issues[0].message);
 // Envelope and ZIP formats stay compatible. Older clients reject schema 3;
 // the server also gates writers before exchanging an encrypted state.
 const state=parsed.data as State;
 for(const key of Object.keys(state) as (keyof State)[]){const list=state[key];if(Array.isArray(list)){const ids=new Set<string>();for(const item of list){if('id' in item){if(ids.has(item.id))throw new Error('Identificador duplicado em '+key);ids.add(item.id);}}}}
 const belongs=(list:{id:string;scope:'real'|'demo'}[],id:string|null,scope:'real'|'demo')=>!id||list.some(v=>v.id===id&&v.scope===scope);
 const check=(ok:boolean)=>{if(!ok)throw new Error('A base contém vínculos ausentes ou entre demonstração e produção.');};
 const speciesIds=new Set<string>(),speciesNames=new Set<string>();
 for(const species of state.settings.speciesCatalog){
  if(speciesIds.has(species.id))throw new Error('Identificador duplicado no catálogo de espécies.');
  speciesIds.add(species.id);
  for(const name of [species.name,...species.aliases]){if(speciesNames.has(name))throw new Error('Nome ou grafia duplicada no catálogo de espécies.');speciesNames.add(name);}
 }
 for(const bird of state.birds)if(bird.speciesId){
  const species=state.settings.speciesCatalog.find(s=>s.id===bird.speciesId);
  check(!!species&&(species.name===bird.species||species.aliases.includes(bird.species)));
 }
 const identifiers=new Set<string>();
 for(const b of state.birds){const normalized=b.scope+':'+b.identification.trim().toLocaleLowerCase('pt-BR');check(!identifiers.has(normalized));identifiers.add(normalized);check(belongs(state.birds,b.fatherId,b.scope)&&belongs(state.birds,b.motherId,b.scope)&&belongs(state.attachments,b.photoId,b.scope)&&belongs(state.contacts,b.supplierId,b.scope));const walk=(id:string,seen:Set<string>):void=>{if(seen.has(id))throw new Error('Genealogia circular na base.');const bird=state.birds.find(v=>v.id===id);if(!bird)return;const next=new Set(seen).add(id);for(const pid of [bird.fatherId,bird.motherId])if(pid)walk(pid,next);};walk(b.id,new Set());}
 for(const p of state.pairs)check(belongs(state.birds,p.maleId,p.scope)&&belongs(state.birds,p.femaleId,p.scope));
 for(const c of state.clutches)check(belongs(state.pairs,c.pairId,c.scope));
 for(const e of state.eggs)check(belongs(state.clutches,e.clutchId,e.scope)&&belongs(state.birds,e.chickId,e.scope));
 for(const e of [...state.mutations,...state.health])check(belongs(state.birds,e.birdId,e.scope));
 const derivedKeys=new Set<string>();
 for(const t of state.tasks){
  check(belongs(state.birds,t.birdId,t.scope));
  if(t.origin==='derived'){
   check(!!t.derivationKey&&!!t.sourceType&&!!t.sourceId);
   const key=t.scope+':'+t.derivationKey;
   if(derivedKeys.has(key))throw new Error('Tarefa derivada duplicada na base.');derivedKeys.add(key);
  }
  if(t.sourceId)check(t.sourceType==='bird'?belongs(state.birds,t.sourceId,t.scope):t.sourceType==='egg'?belongs(state.eggs,t.sourceId,t.scope):t.sourceType==='clutch'?belongs(state.clutches,t.sourceId,t.scope):t.sourceType==='pair'?belongs(state.pairs,t.sourceId,t.scope):false);
  if(t.resolvedAt)check(t.done);
 }
 for(const a of state.attachments)check(belongs(state.birds,a.birdId,a.scope)&&belongs(state.contacts,a.contactId,a.scope)&&belongs(state.sales,a.saleId,a.scope)&&belongs(state.attachments,a.previousId,a.scope));
 for(const a of state.documents)check(belongs(state.birds,a.birdId,a.scope)&&belongs(state.sales,a.saleId,a.scope));
 for(const sale of state.sales){
  check(belongs(state.contacts,sale.contactId,sale.scope));for(const item of sale.items)check(item.kind==='ave'?belongs(state.birds,item.refId,sale.scope):item.kind==='produto'?belongs(state.products,item.refId,sale.scope):true);
  const delivered=new Set<string>();
  for(const saved of sale.deliveryManifest??[]){
   const file=(saved.type==='attachment'?state.attachments:state.documents).find(f=>f.id===saved.id&&f.scope===sale.scope);
   check(!!file&&file.sha256===saved.sha256&&file.fileName===saved.fileName);
   const key=saved.type+':'+saved.id;check(!delivered.has(key));delivered.add(key);
  }
 }
 for(const b of state.bills)check(belongs(state.contacts,b.contactId,b.scope)&&belongs(state.sales,b.saleId,b.scope)&&(!b.purchaseId||belongs(state.purchases,b.purchaseId,b.scope)));
 for(const p of state.payments)check(belongs(state.bills,p.billId,p.scope)&&belongs(state.accounts,p.accountId,p.scope));
 for(const t of state.transfers)check(belongs(state.accounts,t.fromAccountId,t.scope)&&belongs(state.accounts,t.toAccountId,t.scope));
 for(const s of state.stock){
  check(belongs(state.products,s.productId,s.scope)&&belongs(state.sales,s.saleId,s.scope)&&(!s.purchaseId||belongs(state.purchases,s.purchaseId,s.scope)));
  if(s.reversalOfId){const original=state.stock.find(m=>m.id===s.reversalOfId&&m.scope===s.scope);check(!!original&&original.productId===s.productId&&original.purchaseId===s.purchaseId&&s.quantity===-original.quantity);}
 }
 const operationKeys=new Set<string>();
 for(const purchase of state.purchases){
  check(belongs(state.products,purchase.productId,purchase.scope)&&belongs(state.contacts,purchase.supplierId,purchase.scope)&&belongs(state.bills,purchase.billId,purchase.scope)&&belongs(state.bills,purchase.refundBillId,purchase.scope)&&belongs(state.payments,purchase.paymentId,purchase.scope)&&belongs(state.stock,purchase.stockMovementId,purchase.scope));
  const movement=state.stock.find(m=>m.id===purchase.stockMovementId),bill=state.bills.find(b=>b.id===purchase.billId),payment=purchase.paymentId?state.payments.find(p=>p.id===purchase.paymentId):undefined;
  check(!!movement&&movement.purchaseId===purchase.id&&movement.productId===purchase.productId&&movement.kind==='compra'&&movement.quantity===purchase.quantity);
  check(!!bill&&bill.purchaseId===purchase.id&&bill.direction==='pagar'&&bill.amountCents===purchase.totalCents&&bill.contactId===purchase.supplierId&&bill.dueDate===purchase.dueDate&&bill.cancelled===(purchase.status==='cancelada'));
  if(payment)check(payment.billId===purchase.billId);
  if(purchase.refundBillId){const refund=state.bills.find(b=>b.id===purchase.refundBillId);check(purchase.status==='cancelada'&&!!refund&&refund.purchaseId===purchase.id&&refund.direction==='receber');}
  for(const saved of purchase.history){
   check(belongs(state.products,saved.productId,purchase.scope)&&belongs(state.stock,saved.stockMovementId,purchase.scope)&&belongs(state.bills,saved.billId,purchase.scope)&&belongs(state.contacts,saved.supplierId,purchase.scope)&&(!saved.compensationId||belongs(state.stock,saved.compensationId,purchase.scope))&&saved.revision<=purchase.revision);
  }
  for(const operation of purchase.operations){
   const key=purchase.scope+':'+operation.key;check(!operationKeys.has(key)&&operation.revision<=purchase.revision);operationKeys.add(key);
   for(const attachmentId of operation.attachmentIds??[]){const file=state.attachments.find(a=>a.id===attachmentId&&a.scope===purchase.scope);check(!!file&&file.sourceType==='purchase'&&file.sourceId===purchase.id);}
  }
 }
 for(const closing of state.closings){
  check(belongs(state.accounts,closing.accountId,closing.scope));
  if(closing.previousClosingId){
   const previous=state.closings.find(c=>c.id===closing.previousClosingId);
   check(!!previous&&previous.scope===closing.scope&&previous.accountId===closing.accountId&&previous.date<closing.date);
  }
  if(closing.snapshot){
   const snapshot=closing.snapshot;
   check(new Set(snapshot.paymentIds).size===snapshot.paymentIds.length&&new Set(snapshot.transferIds).size===snapshot.transferIds.length);
   for(const paymentId of snapshot.paymentIds){
    const payment=state.payments.find(p=>p.id===paymentId);
    check(!!payment&&payment.scope===closing.scope&&payment.accountId===closing.accountId);
   }
   for(const transferId of snapshot.transferIds){
    const transfer=state.transfers.find(t=>t.id===transferId);
    check(!!transfer&&transfer.scope===closing.scope&&(transfer.fromAccountId===closing.accountId||transfer.toAccountId===closing.accountId));
   }
   // Validate the saved evidence itself, rather than recomputing past balances from
   // today's records: legitimate backdated entries and reversals must not rewrite it.
   const expected=BigInt(snapshot.openingCents)+BigInt(snapshot.incomeCents)-BigInt(snapshot.expenseCents)+BigInt(snapshot.transferInCents)-BigInt(snapshot.transferOutCents)+BigInt(snapshot.reversalCents);
   if(expected!==BigInt(closing.expectedCents))throw new Error('O resumo do fechamento não corresponde ao saldo previsto registrado.');
  }
 }
 return state;
}
