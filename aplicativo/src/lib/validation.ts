import { z } from 'zod';
import type { State } from '../domain/types';
import { date } from '../domain/shared';
const s=z.string().max(10000),ref=z.string().min(1).max(150),nullable=ref.nullable(),d=z.union([date,z.literal('')]),n=z.number().finite(),c=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),scope=z.enum(['real','demo']);
const base={id:ref,scope};
const status=z.enum(['filhote','manejo','reprodutor','disponível','reservado','vendido','doado','transferido','falecido']);
const b64=z.string().max(14000000);
const schema=z.object({
 schemaVersion:z.literal(1),revision:c,
 birds:z.array(z.object({...base,identification:ref,name:s,species:ref,sex:z.enum(['macho','fêmea','indeterminado']),mutation:ref,certainty:z.enum(['observada','informada','confirmada']),carriers:s,origin:ref,notes:s,birthDate:d,fatherId:nullable,motherId:nullable,createdAt:s,status,scientificName:s,microchip:s,sexMethod:s,sexSource:s,visualDescription:s,birthEstimated:z.boolean(),breeder:s,supplierId:nullable,acquiredDate:d,acquisitionCents:c,enclosure:s,responsible:s,photoId:nullable,acquisitionMethod:s.optional(),custodyHistory:z.array(z.object({date:date,responsible:s,enclosure:s,reason:s})).optional(),sexHistory:z.array(z.object({date:s,sex:s,method:s,source:s,notes:s,attachmentId:nullable})).optional(),statusHistory:z.array(z.object({date:s,status,reason:s}))})),
 pairs:z.array(z.object({...base,name:ref,maleId:ref,femaleId:ref,startDate:date,endDate:date.nullable(),notes:s,enclosure:s,relatedAcknowledged:z.boolean()})),
 clutches:z.array(z.object({...base,pairId:ref,startDate:date,endDate:date.nullable(),notes:s})),
 eggs:z.array(z.object({...base,clutchId:ref,number:z.number().int().positive(),laidDate:date,status:z.enum(['incubando','infértil','perdido','eclodido']),hatchDate:date.nullable(),chickId:nullable,notes:s,fertility:z.enum(['desconhecida','fértil','infértil']),incubationDate:d,expectedHatchDate:d,outcomeDate:date.nullable().optional(),events:z.array(z.object({date:date,kind:s,notes:s})).optional()})),
 mutations:z.array(z.object({...base,birdId:ref,mutation:ref,certainty:s,carriers:s,recordedAt:s,source:s.optional(),notes:s.optional(),date:s.optional(),attachmentId:nullable.optional()})),
 health:z.array(z.object({...base,birdId:ref,date:date,kind:ref,title:ref,notes:s,weightGrams:n.nonnegative().nullable(),professional:s,author:s,attachmentIds:z.array(ref)})),
 tasks:z.array(z.object({...base,birdId:nullable,title:ref,dueDate:date,done:z.boolean(),notes:s})),
 contacts:z.array(z.object({...base,kind:z.enum(['cliente','fornecedor','interessado']),name:ref,phone:s,email:s,address:s,taxId:s,notes:s,interest:s})),
 sales:z.array(z.object({...base,number:ref,contactId:ref,date:date,status:z.enum(['orçamento','reservada','vendida','entregue','cancelada','devolvida']),items:z.array(z.object({id:ref,kind:z.enum(['ave','produto','serviço']),refId:nullable,description:ref,quantity:n.positive(),unitCents:c})),discountCents:c,feeCents:c,totalCents:c,notes:s,deliveryDate:d,statusHistory:z.array(z.object({date:s,status:s,reason:s}))})),
 accounts:z.array(z.object({...base,name:ref,openingCents:z.number().int().safe()})),
 bills:z.array(z.object({...base,direction:z.enum(['pagar','receber']),contactId:nullable,saleId:nullable,category:ref,costCenter:s,description:ref,dueDate:date,amountCents:c,cancelled:z.boolean()})),
 payments:z.array(z.object({...base,billId:ref,accountId:ref,date:date,amountCents:c,method:ref,idempotencyKey:ref,reversed:z.boolean(),reversalReason:s,manual:z.boolean(),reconciledAt:s.optional(),reversalDate:s.optional()})),
 transfers:z.array(z.object({...base,fromAccountId:ref,toAccountId:ref,date:date,amountCents:c,reason:s})),
 products:z.array(z.object({...base,name:ref,unit:ref,minimum:n.nonnegative(),lot:s,expiryDate:d,supplierId:nullable,quantityPrecision:z.number().int().min(0).max(6).optional()})),
 stock:z.array(z.object({...base,productId:ref,date:date,quantity:n,unitCostCents:c,kind:z.enum(['compra','consumo','venda','perda','ajuste','devolução']),reason:s,saleId:nullable})),
 closings:z.array(z.object({...base,accountId:ref,date:date,expectedCents:z.number().int().safe(),countedCents:z.number().int().safe(),notes:s})),
 attachments:z.array(z.object({...base,birdId:nullable,contactId:nullable,saleId:nullable,title:ref,category:ref,date:date,issuer:s,reference:s,validUntil:d,notes:s,shareWithCustomer:z.boolean(),fileName:ref,mime:ref,size:c,base64:b64,version:z.number().int().positive(),previousId:nullable,sha256:z.string().regex(/^[a-f0-9]{64}$/)})),
 documents:z.array(z.object({...base,birdId:nullable,saleId:nullable,kind:ref,title:ref,createdAt:s,fileName:ref,mime:ref,base64:b64,size:c,sha256:z.string().regex(/^[a-f0-9]{64}$/)})),
 support:z.array(z.object({id:ref,number:ref,createdAt:s,version:ref,platform:s,description:s,steps:s,expected:s,actual:s,errorCode:s,priority:z.enum(['baixa','normal','alta']),status:z.enum(['aberto','em análise','corrigido']),fixedVersion:s})),
 audit:z.array(z.object({...base,at:s,author:s,action:ref,recordId:s,reason:s})),
 settings:z.object({name:ref,phone:s,email:s,address:s,version:ref,backupDays:z.number().int().min(1).max(365),lastBackupAt:s,backupHistory:z.array(z.object({at:s,sha256:ref,size:c,verified:z.boolean()})),categories:z.array(ref),speciesEstimates:z.record(z.number().int().min(1).max(365)),reportSchedules:z.array(z.object({id:ref,scope,name:ref,module:ref,days:z.number().int().min(1).max(365),lastRun:s}))})
});
export function validateState(value:unknown):State {
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new Error('Base incompatível ou inválida: '+parsed.error.issues[0].path.join('.')+' — '+parsed.error.issues[0].message);
 const state=parsed.data as State;
 for(const key of Object.keys(state) as (keyof State)[]){const list=state[key];if(Array.isArray(list)){const ids=new Set<string>();for(const item of list){if('id' in item){if(ids.has(item.id))throw new Error('Identificador duplicado em '+key);ids.add(item.id);}}}}
 const belongs=(list:{id:string;scope:'real'|'demo'}[],id:string|null,scope:'real'|'demo')=>!id||list.some(v=>v.id===id&&v.scope===scope);
 const check=(ok:boolean)=>{if(!ok)throw new Error('A base contém vínculos ausentes ou entre demonstração e produção.');};
 const identifiers=new Set<string>();
 for(const b of state.birds){const normalized=b.scope+':'+b.identification.trim().toLocaleLowerCase('pt-BR');check(!identifiers.has(normalized));identifiers.add(normalized);check(belongs(state.birds,b.fatherId,b.scope)&&belongs(state.birds,b.motherId,b.scope)&&belongs(state.attachments,b.photoId,b.scope)&&belongs(state.contacts,b.supplierId,b.scope));const walk=(id:string,seen:Set<string>):void=>{if(seen.has(id))throw new Error('Genealogia circular na base.');const bird=state.birds.find(v=>v.id===id);if(!bird)return;const next=new Set(seen).add(id);for(const pid of [bird.fatherId,bird.motherId])if(pid)walk(pid,next);};walk(b.id,new Set());}
 for(const p of state.pairs)check(belongs(state.birds,p.maleId,p.scope)&&belongs(state.birds,p.femaleId,p.scope));
 for(const c of state.clutches)check(belongs(state.pairs,c.pairId,c.scope));
 for(const e of state.eggs)check(belongs(state.clutches,e.clutchId,e.scope)&&belongs(state.birds,e.chickId,e.scope));
 for(const e of [...state.mutations,...state.health])check(belongs(state.birds,e.birdId,e.scope));
 for(const t of state.tasks)check(belongs(state.birds,t.birdId,t.scope));
 for(const a of state.attachments)check(belongs(state.birds,a.birdId,a.scope)&&belongs(state.contacts,a.contactId,a.scope)&&belongs(state.sales,a.saleId,a.scope)&&belongs(state.attachments,a.previousId,a.scope));
 for(const a of state.documents)check(belongs(state.birds,a.birdId,a.scope)&&belongs(state.sales,a.saleId,a.scope));
 for(const sale of state.sales){check(belongs(state.contacts,sale.contactId,sale.scope));for(const item of sale.items)check(item.kind==='ave'?belongs(state.birds,item.refId,sale.scope):item.kind==='produto'?belongs(state.products,item.refId,sale.scope):true);}
 for(const b of state.bills)check(belongs(state.contacts,b.contactId,b.scope)&&belongs(state.sales,b.saleId,b.scope));
 for(const p of state.payments)check(belongs(state.bills,p.billId,p.scope)&&belongs(state.accounts,p.accountId,p.scope));
 for(const t of state.transfers)check(belongs(state.accounts,t.fromAccountId,t.scope)&&belongs(state.accounts,t.toAccountId,t.scope));
 for(const s of state.stock)check(belongs(state.products,s.productId,s.scope)&&belongs(state.sales,s.saleId,s.scope));
 for(const s of state.closings)check(belongs(state.accounts,s.accountId,s.scope));
 return state;
}
