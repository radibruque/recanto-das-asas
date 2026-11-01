import { z } from 'zod';
import type { Account, Bill, Bird, Contact, DeliveryFileSnapshot, Handler, Payment, Product, Sale, SaleItem, Scope, State, StockMovement } from './types';
import { cents, date, ensure, id, required, text } from './shared';

const signedCents = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().positive().refine(v => Number.isSafeInteger(Math.round(v * 1000)) && Math.abs(v * 1000 - Math.round(v * 1000)) < 0.00001, 'Use até três casas decimais para a quantidade.');
const maybeId = z.string().nullable().optional();
const active = (sale: Sale) => ['reservada', 'vendida', 'entregue'].includes(sale.status);
const scoped = <T extends {id:string;scope:Scope}>(rows:T[], scope:Scope, recordId:string, description:string):T => {const row=rows.find(v=>v.id===recordId&&v.scope===scope);ensure(row, `${description} não encontrado neste ambiente.`);return row;};
const safeSum = (values:number[]) => {const sum=values.reduce((a,b)=>a+BigInt(b),0n);ensure(sum>=BigInt(-Number.MAX_SAFE_INTEGER)&&sum<=BigInt(Number.MAX_SAFE_INTEGER),'O total excede o limite financeiro.');return Number(sum);};
const scaled = (value:number) => Math.round(value*1000);
export function itemTotal(item:Pick<SaleItem,'quantity'|'unitCents'>):number {const amount=(BigInt(scaled(item.quantity))*BigInt(item.unitCents)+500n)/1000n;ensure(amount<=BigInt(Number.MAX_SAFE_INTEGER),'O valor do item é muito alto.');return Number(amount);}
export const stockBalance = (state:State,scope:Scope,productId:string) => safeSum(state.stock.filter(m=>m.scope===scope&&m.productId===productId).map(m=>scaled(m.quantity)))/1000;
export const billPaid = (state:State,scope:Scope,billId:string) => safeSum(state.payments.filter(p=>p.scope===scope&&p.billId===billId&&!p.reversed).map(p=>p.amountCents));
export const billOutstanding = (state:State,scope:Scope,bill:Bill) => {ensure(bill.scope===scope,'Conta a pagar/receber não encontrada neste ambiente.');return bill.cancelled?0:bill.amountCents-billPaid(state,scope,bill.id);};
export const billBalance = (state:State,scope:Scope,billId:string) => billOutstanding(state,scope,scoped(state.bills,scope,billId,'Conta a pagar/receber'));
export function accountBalance(state:State,scope:Scope,accountId:string,throughDate='9999-12-31'):number {
  const account=scoped(state.accounts,scope,accountId,'Conta');
  return safeSum([account.openingCents,...state.payments.filter(p=>p.scope===scope&&p.accountId===accountId&&p.date<=throughDate&&(!p.reversed || ('reversalDate' in p && typeof p.reversalDate==='string' && p.reversalDate>throughDate))).map(p=>{const bill=scoped(state.bills,scope,p.billId,'Conta a pagar/receber');return bill.direction==='receber'?p.amountCents:-p.amountCents;}),...state.transfers.filter(t=>t.scope===scope&&t.date<=throughDate&&(t.fromAccountId===accountId||t.toAccountId===accountId)).map(t=>t.toAccountId===accountId?t.amountCents:-t.amountCents)]);
}
export function salePaid(state:State,scope:Scope,saleId:string):number {return safeSum(state.bills.filter(b=>b.scope===scope&&b.saleId===saleId).map(b=>(b.direction==='receber'?1:-1)*billPaid(state,scope,b.id)));}

export type DeliveryCandidate = DeliveryFileSnapshot & {title:string;size:number};
const customerDocumentKinds=new Set(['Caderneta digital','Recibo de pagamento','Termo de entrega']);
/** Metadata only: opening the delivery review never decodes or loads file bodies. */
export function deliveryCandidates(state:State,scope:Scope,saleId:string):DeliveryCandidate[] {
 const sale=scoped(state.sales,scope,saleId,'Operação');
 const birds=new Set(sale.items.filter(item=>item.kind==='ave'&&item.refId).map(item=>item.refId!));
 const bills=new Map(state.bills.filter(bill=>bill.scope===scope).map(bill=>[bill.id,bill]));
 const payments=new Map(state.payments.filter(payment=>payment.scope===scope).map(payment=>[payment.id,payment]));
 const candidates:DeliveryCandidate[]=[];
 for(const file of state.attachments){
  if(file.scope!==scope||!file.shareWithCustomer)continue;
  // A contact may historically be both supplier and client. Sharing a file
  // does not make internal purchases, expense evidence or cash checks a tutor document.
  if(file.sourceType==='purchase'||file.sourceType==='closing')continue;
  if(file.sourceType==='bill'||file.sourceType==='payment'){
   const billId=file.sourceType==='bill'?file.sourceId:file.sourceId?payments.get(file.sourceId)?.billId:undefined;
   const bill=billId?bills.get(billId):undefined;
   if(!bill||bill.direction==='pagar'||bill.purchaseId)continue;
  }
  if(file.saleId&&file.saleId!==sale.id)continue;
  if(file.contactId&&file.contactId!==sale.contactId)continue;
  if(file.saleId===sale.id||(file.birdId&&birds.has(file.birdId))||file.contactId===sale.contactId)candidates.push({type:'attachment',id:file.id,title:file.title,fileName:file.fileName,sha256:file.sha256,size:file.size});
 }
 for(const file of state.documents){
  if(file.scope!==scope||!customerDocumentKinds.has(file.kind))continue;
  if(file.saleId&&file.saleId!==sale.id)continue;
  if(file.saleId===sale.id||(file.birdId&&birds.has(file.birdId)))candidates.push({type:'document',id:file.id,title:file.title,fileName:file.fileName,sha256:file.sha256,size:file.size});
 }
 return candidates;
}
function deliveryManifest(state:State,scope:Scope,saleId:string,selected:{type:'attachment'|'document';id:string}[]):DeliveryFileSnapshot[] {
 const candidates=new Map(deliveryCandidates(state,scope,saleId).map(file=>[file.type+':'+file.id,file]));
 const seen=new Set<string>();let size=0;
 return selected.map(reference=>{
  const key=reference.type+':'+reference.id;
  ensure(!seen.has(key),'O mesmo arquivo não pode aparecer duas vezes na entrega.');seen.add(key);
  const file=candidates.get(key);ensure(file,'O arquivo selecionado não pertence à operação ou não está autorizado para o tutor.');
  size+=file.size;ensure(Number.isSafeInteger(size)&&size<=40*1024*1024,'Selecione até 40 MB de arquivos por entrega. Os originais continuam disponíveis individualmente.');
  const {type,id,sha256,fileName}=file;return {type,id,sha256,fileName};
 });
}

/** A closing keeps this snapshot, so later backdated entries cannot rewrite its evidence. */
export function cashClosingSummary(state:State,scope:Scope,accountId:string,throughDate:string) {
 const account=scoped(state.accounts,scope,accountId,'Conta');
 const payments=state.payments.filter(p=>p.scope===scope&&p.accountId===accountId&&p.date<=throughDate);
 const incoming=(payment:Payment)=>scoped(state.bills,scope,payment.billId,'Conta a pagar/receber').direction==='receber';
 const transfers=state.transfers.filter(t=>t.scope===scope&&t.date<=throughDate&&(t.fromAccountId===accountId||t.toAccountId===accountId));
 const summary={openingCents:account.openingCents,incomeCents:safeSum(payments.filter(incoming).map(p=>p.amountCents)),expenseCents:safeSum(payments.filter(p=>!incoming(p)).map(p=>p.amountCents)),transferInCents:safeSum(transfers.filter(t=>t.toAccountId===accountId).map(t=>t.amountCents)),transferOutCents:safeSum(transfers.filter(t=>t.fromAccountId===accountId).map(t=>t.amountCents)),reversalCents:safeSum(payments.filter(p=>p.reversed&&(!p.reversalDate||p.reversalDate<=throughDate)).map(p=>incoming(p)?-p.amountCents:p.amountCents)),paymentIds:payments.map(p=>p.id),transferIds:transfers.map(t=>t.id)};
 return {...summary,expectedCents:safeSum([summary.openingCents,summary.incomeCents,-summary.expenseCents,summary.transferInCents,-summary.transferOutCents,summary.reversalCents])};
}

function validateBirds(state:State,scope:Scope,sale:Sale):Bird[] {
 const birds=sale.items.filter(i=>i.kind==='ave').map(item=>scoped(state.birds,scope,item.refId!,'Ave'));
 ensure(new Set(birds.map(b=>b.id)).size===birds.length,'A mesma ave não pode aparecer duas vezes na operação.');
 for(const bird of birds){
  ensure(!state.sales.some(s=>s.scope===scope&&s.id!==sale.id&&active(s)&&s.items.some(i=>i.kind==='ave'&&i.refId===bird.id)),'Esta ave já está reservada ou vendida em outra operação.');
  const own=state.sales.find(s=>s.scope===scope&&s.id===sale.id);
  ensure(bird.status==='disponível'||!!(own&&active(own)&&['reservado','vendido'].includes(bird.status)),'A ave precisa estar disponível para a operação.');
  ensure(!state.pairs.some(p=>p.scope===scope&&!p.endDate&&(p.maleId===bird.id||p.femaleId===bird.id)),'Encerre o casal ativo antes de reservar ou vender esta ave.');
 }
 return birds;
}
function changeBird(bird:Bird,status:Bird['status'],on:string,reason:string){ensure(!bird.birthDate||on>=bird.birthDate,'A movimentação não pode anteceder o nascimento da ave.');ensure(on>=(bird.statusHistory.at(-1)?.date??''),'A movimentação não pode anteceder o último evento da ave.');if(bird.status!==status){bird.status=status;bird.statusHistory.push({date:on,status,reason});}}
function changeCustody(bird:Bird,responsible:string,on:string,reason:string){ensure(on>=(bird.custodyHistory?.at(-1)?.date??''),'A responsabilidade não pode anteceder a última movimentação da ave.');if(bird.responsible!==responsible){bird.responsible=responsible;bird.custodyHistory=[...(bird.custodyHistory??[]),{date:on,responsible,enclosure:bird.enclosure,reason}];}}
function consumeProducts(state:State,scope:Scope,sale:Sale,on:string){
 const grouped=new Map<string,number>();
 for(const item of sale.items.filter(i=>i.kind==='produto')) grouped.set(item.refId!,safeSum([grouped.get(item.refId!)??0,scaled(item.quantity)]));
 for(const [productId,amount] of grouped){const product=scoped(state.products,scope,productId,'Produto');ensure(!product.expiryDate||product.expiryDate>=on,`O lote de ${product.name} está vencido na data da venda.`);ensure(scaled(stockBalance(state,scope,productId))>=amount,`Estoque insuficiente de ${product.name}.`);}
 for(const [productId,amount] of grouped)state.stock.push({id:id(),scope,productId,date:on,quantity:-amount/1000,unitCostCents:0,kind:'venda',reason:`Venda ${sale.number}`,saleId:sale.id});
}
function activate(state:State,scope:Scope,sale:Sale,status:'reservada'|'vendida',on:string){
 const birds=validateBirds(state,scope,sale);
 if(status==='vendida'&&!state.stock.some(m=>m.scope===scope&&m.saleId===sale.id&&m.kind==='venda'))consumeProducts(state,scope,sale,on);
 for(const bird of birds)changeBird(bird,status==='reservada'?'reservado':'vendido',on,`${status==='reservada'?'Reserva':'Venda'} ${sale.number}`);
}
function createBills(state:State,scope:Scope,sale:Sale,installments:{dueDate:string;amountCents:number}[]){
 const plan=installments.length?installments:[{dueDate:sale.date,amountCents:sale.totalCents}];
 ensure(plan.every(v=>v.amountCents>0)||sale.totalCents===0,'Cada parcela deve ter valor positivo.');
 ensure(safeSum(plan.map(v=>v.amountCents))===sale.totalCents,'A soma das parcelas precisa ser igual ao total da operação.');
 plan.forEach((part,index)=>state.bills.push({id:id(),scope,direction:'receber',contactId:sale.contactId,saleId:sale.id,category:'Venda',costCenter:'Comercial',description:`${sale.number} · parcela ${index+1}/${plan.length}`,dueDate:part.dueDate,amountCents:part.amountCents,cancelled:false}));
}
const contactInput=z.object({id:z.string().optional(),kind:z.enum(['cliente','fornecedor','interessado']),name:required,phone:text,email:z.union([z.literal(''),z.string().trim().email('E-mail inválido.')]).default(''),address:text,taxId:z.string().trim().max(30).default(''),notes:text,interest:text,website:text.optional(),socialLinks:text.optional()});
const itemInput=z.object({kind:z.enum(['ave','produto','serviço']),refId:maybeId,description:required,quantity,unitCents:cents});
const installmentInput=z.object({dueDate:date,amountCents:cents});
const saleInput=z.object({id:z.string().optional(),contactId:required,date,status:z.enum(['orçamento','reservada','vendida']),items:z.array(itemInput).min(1,'Inclua pelo menos um item.').max(300),discountCents:cents.default(0),feeCents:cents.default(0),interestCents:cents.default(0),notes:text,installments:z.array(installmentInput).max(120).default([]),receipt:z.object({amountCents:cents,method:required}).optional(),paymentMethod:text.optional(),paymentPlan:text.optional()});

export const commercialHandler:Handler=(state,scope,action,data)=>{
 if(action==='contact.delete'){
  const input=z.object({id:required}).parse(data),contact=scoped(state.contacts,scope,input.id,'Cliente');
  ensure(contact.kind==='cliente','Esta exclusão está disponível para clientes.');
  const linked=state.sales.some(s=>s.scope===scope&&s.contactId===contact.id)||state.bills.some(b=>b.scope===scope&&b.contactId===contact.id)||state.attachments.some(a=>a.scope===scope&&a.contactId===contact.id)||state.birds.some(b=>b.scope===scope&&b.supplierId===contact.id)||state.products.some(p=>p.scope===scope&&p.supplierId===contact.id)||state.purchases.some(p=>p.scope===scope&&(p.supplierId===contact.id||p.history.some(h=>h.supplierId===contact.id)));
  // A hidden anonymous reference keeps existing backups and older clients valid.
  if(linked)Object.assign(contact,{kind:'interessado',name:'Cliente excluído',phone:'',email:'',address:'',taxId:'',notes:'',interest:'',website:'',socialLinks:''});
  else state.contacts=state.contacts.filter(c=>c!==contact);
  return {id:contact.id};
 }
 if(action==='contact.save'){
  const input=contactInput.parse(data);const contact:Contact={...input,id:input.id??id(),scope};
  if(input.id){const old=scoped(state.contacts,scope,input.id,'Contato');Object.assign(old,contact);}else state.contacts.push(contact);
  return {id:contact.id};
 }
 if(action==='sale.save'){
  const input=saleInput.parse(data);scoped(state.contacts,scope,input.contactId,'Cliente');
  const previous=input.id?scoped(state.sales,scope,input.id,'Operação'):undefined;
  ensure(!previous||previous.status==='orçamento','Edite somente orçamentos; use as ações de histórico para operações ativas.');
  const items:SaleItem[]=input.items.map(i=>{if(i.kind==='ave'){ensure(i.refId&&i.quantity===1,'Cada ave deve ser um item individual de quantidade 1.');scoped(state.birds,scope,i.refId,'Ave');}else if(i.kind==='produto'){ensure(i.refId,'Selecione o produto.');scoped(state.products,scope,i.refId,'Produto');}return {...i,id:id(),refId:i.kind==='serviço'?null:i.refId!};});
  ensure(new Set(items.filter(i=>i.kind==='ave').map(i=>i.refId)).size===items.filter(i=>i.kind==='ave').length,'A mesma ave não pode aparecer duas vezes.');
  const subtotal=safeSum(items.map(itemTotal));ensure(input.discountCents<=subtotal,'O desconto não pode exceder os itens.');
  const totalCents=safeSum([subtotal,-input.discountCents,input.feeCents,input.interestCents]);
  const sale:Sale={id:previous?.id??id(),scope,number:previous?.number??`${scope==='demo'?'DEMO-':''}V-${String(state.sales.filter(s=>s.scope===scope).length+1).padStart(6,'0')}`,contactId:input.contactId,date:input.date,status:input.status,items,discountCents:input.discountCents,feeCents:input.feeCents,...(input.interestCents?{interestCents:input.interestCents}:{}),totalCents,notes:input.notes,deliveryDate:'',...(input.paymentMethod?{paymentMethod:input.paymentMethod}:{}),...(input.paymentPlan?{paymentPlan:input.paymentPlan}:{}),statusHistory:[...(previous?.statusHistory??[]),{date:input.date,status:input.status,reason:previous?'Orçamento atualizado':'Operação criada'}]};
  if(input.status!=='orçamento'){
   const plan=input.installments.length?input.installments:[{dueDate:input.date,amountCents:totalCents}];
   ensure(safeSum(plan.map(v=>v.amountCents))===totalCents,'A soma das parcelas precisa ser igual ao total da operação.');
   ensure(plan.every(v=>v.amountCents>0)||totalCents===0,'Cada parcela deve ter valor positivo.');
   activate(state,scope,sale,input.status,input.date);createBills(state,scope,sale,input.installments);
  }
  if(previous)Object.assign(previous,sale);else state.sales.push(sale);
  // Optional payment received at the moment of the sale/reservation (sinal), applied to the oldest installments.
  if(input.receipt&&input.receipt.amountCents>0&&input.status!=='orçamento'){
   ensure(input.receipt.amountCents<=totalCents,'O valor recebido não pode ser maior que o total da operação.');
   let account=state.accounts.find(a=>a.scope===scope);
   if(!account){commercialHandler(state,scope,'account.save',{name:'Caixa',openingCents:0});account=state.accounts.find(a=>a.scope===scope)!;}
   let left=input.receipt.amountCents;
   for(const bill of state.bills.filter(b=>b.scope===scope&&b.saleId===sale.id&&b.direction==='receber'&&!b.cancelled).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))){
    if(left<=0)break;const open=billOutstanding(state,scope,bill);if(open<=0)continue;const pay=Math.min(open,left);
    commercialHandler(state,scope,'payment.record',{billId:bill.id,accountId:account.id,date:input.date,amountCents:pay,method:input.receipt.method,idempotencyKey:id()});left-=pay;
   }
  }
  return {id:sale.id};
 }
 if(action==='sale.transition'){
  const input=z.object({id:required,status:z.enum(['reservada','vendida','entregue','cancelada','devolvida']),date,reason:text,refundAccountId:z.string().optional(),installments:z.array(installmentInput).max(120).default([]),deliveryFiles:z.array(z.object({type:z.enum(['attachment','document']),id:required})).max(20).optional()}).parse(data);
  const sale=scoped(state.sales,scope,input.id,'Operação');
  if(!input.reason){ensure(['reservada','vendida'].includes(input.status),'Informe o motivo desta alteração.');input.reason=input.status==='vendida'?'Venda confirmada':'Reserva confirmada';}
  if(sale.status===input.status)return {id:sale.id};
  ensure(!['cancelada','devolvida'].includes(sale.status),'Esta operação já foi encerrada.');
  ensure(input.date>=sale.date,'A data do evento não pode anteceder a operação.');
  ensure(input.date>=(sale.statusHistory.at(-1)?.date??sale.date),'A data do evento não pode anteceder o último evento comercial.');
  if(input.status==='reservada'||input.status==='vendida'){
   ensure(sale.status==='orçamento'||(sale.status==='reservada'&&input.status==='vendida'),'Transição comercial inválida.');
   if(sale.status==='orçamento'){const plan=input.installments.length?input.installments:[{dueDate:sale.date,amountCents:sale.totalCents}];ensure(safeSum(plan.map(p=>p.amountCents))===sale.totalCents&&plan.every(p=>p.amountCents>0||sale.totalCents===0),'As parcelas devem corresponder ao total.');}
   activate(state,scope,sale,input.status,input.date);
   if(sale.status==='orçamento')createBills(state,scope,sale,input.installments);
   sale.date=input.date;
  }else if(input.status==='entregue'){
   ensure(sale.status==='vendida','Converta em venda antes de registrar a entrega.');
   const files=input.deliveryFiles===undefined?undefined:deliveryManifest(state,scope,sale.id,input.deliveryFiles);
   validateBirds(state,scope,sale);sale.deliveryDate=input.date;
   for(const item of sale.items.filter(i=>i.kind==='ave')){const bird=scoped(state.birds,scope,item.refId!,'Ave');changeCustody(bird,scoped(state.contacts,scope,sale.contactId,'Cliente').name,input.date,`Entrega ${sale.number}`);changeBird(bird,'vendido',input.date,`Entrega ${sale.number}`);bird.statusHistory.push({date:input.date,status:'vendido',reason:`Entregue a ${bird.responsible} · ${sale.number}`});}
   if(files!==undefined){sale.deliveryManifest=files;sale.deliveryManifestDate=input.date;}
  }else{
   ensure(input.status!=='devolvida'||sale.status==='entregue','A devolução exige uma entrega anterior.');
   ensure(input.status!=='cancelada'||sale.status!=='entregue','Use devolução para uma operação já entregue.');
   const receivables=state.bills.filter(b=>b.scope===scope&&b.saleId===sale.id&&b.direction==='receber');
   const paid=safeSum(receivables.map(b=>billPaid(state,scope,b.id)));
   ensure(state.payments.filter(p=>p.scope===scope&&!p.reversed&&receivables.some(b=>b.id===p.billId)).every(p=>p.date<=input.date),'O reembolso não pode anteceder um recebimento da operação.');
   const account=paid>0?scoped(state.accounts,scope,input.refundAccountId??'','Conta do reembolso'):undefined;
   if(paid>0){safeSum([accountBalance(state,scope,account!.id),-paid]);const refund:Bill={id:id(),scope,direction:'pagar',contactId:sale.contactId,saleId:sale.id,category:'Reembolso',costCenter:'Comercial',description:`Reembolso ${sale.number}: ${input.reason}`.slice(0,150),dueDate:input.date,amountCents:paid,cancelled:false};state.bills.push(refund);state.payments.push({id:id(),scope,billId:refund.id,accountId:account!.id,date:input.date,amountCents:paid,method:'Reembolso manual confirmado',idempotencyKey:`refund:${sale.id}`,reversed:false,reversalReason:'',manual:true});}
   receivables.forEach(b=>{b.cancelled=true;});
   const consumed=state.stock.filter(m=>m.scope===scope&&m.saleId===sale.id&&m.kind==='venda');
   if(!state.stock.some(m=>m.scope===scope&&m.saleId===sale.id&&m.kind==='devolução'))consumed.forEach(m=>state.stock.push({...m,id:id(),date:input.date,quantity:-m.quantity,kind:'devolução',reason:`${input.status}: ${input.reason}`}));
   for(const item of sale.items.filter(i=>i.kind==='ave')){const bird=scoped(state.birds,scope,item.refId!,'Ave');if(['reservado','vendido'].includes(bird.status)){changeBird(bird,'disponível',input.date,`${input.status} ${sale.number}: ${input.reason}`);if(input.status==='devolvida')changeCustody(bird,state.settings.name,input.date,`Devolução ${sale.number}: ${input.reason}`);}}
  }
  sale.status=input.status;sale.statusHistory.push({date:input.date,status:input.status,reason:input.reason});return {id:sale.id};
 }
 if(action==='account.save'){
  const input=z.object({id:z.string().optional(),name:required,openingCents:signedCents.default(0)}).parse(data);
  ensure(!state.accounts.some(a=>a.scope===scope&&a.id!==input.id&&a.name.toLocaleLowerCase()===input.name.toLocaleLowerCase()),'Já existe uma conta com este nome.');
  const account:Account={...input,id:input.id??id(),scope};
  if(input.id){const old=scoped(state.accounts,scope,input.id,'Conta');ensure(old.openingCents===input.openingCents||!state.payments.some(p=>p.scope===scope&&p.accountId===input.id)&&!state.transfers.some(t=>t.scope===scope&&(t.fromAccountId===input.id||t.toAccountId===input.id)),'O saldo inicial não pode ser alterado após movimentações.');Object.assign(old,account);}else state.accounts.push(account);
  return {id:account.id};
 }
 if(action==='bill.save'){
  const input=z.object({id:z.string().optional(),direction:z.enum(['pagar','receber']),contactId:maybeId,category:required,costCenter:text,description:required,dueDate:date,amountCents:cents.refine(v=>v>0,'Informe um valor positivo.')}).parse(data);
  if(input.contactId)scoped(state.contacts,scope,input.contactId,'Contato');
  const bill:Bill={...input,id:input.id??id(),scope,contactId:input.contactId??null,saleId:null,cancelled:false};
  if(input.id){const previous=scoped(state.bills,scope,input.id,'Conta a pagar/receber');ensure(!previous.saleId&&!previous.cancelled,'Use o histórico da venda para alterar uma parcela vinculada.');ensure(!previous.purchaseId,'Use a compra em Materiais para corrigir esta obrigação vinculada.');ensure(!state.payments.some(p=>p.scope===scope&&p.billId===input.id),'Contas com pagamentos registrados não podem ser editadas.');Object.assign(previous,bill);}else state.bills.push(bill);
  return {id:bill.id};
 }
 if(action==='payment.record'){
  const input=z.object({billId:required,accountId:required,date,amountCents:cents.refine(v=>v>0,'Informe um valor positivo.'),method:required,idempotencyKey:required}).parse(data);
  const duplicate=state.payments.find(p=>p.scope===scope&&p.idempotencyKey===input.idempotencyKey);
  if(duplicate){ensure(duplicate.billId===input.billId&&duplicate.accountId===input.accountId&&duplicate.amountCents===input.amountCents&&duplicate.date===input.date&&duplicate.method===input.method,'Esta chave já foi usada para outro recebimento ou pagamento.');return {id:duplicate.id};}
  ensure(!input.idempotencyKey.startsWith('refund:'),'A chave de reembolso é reservada para o histórico de cancelamento.');
  const bill=scoped(state.bills,scope,input.billId,'Conta a pagar/receber');scoped(state.accounts,scope,input.accountId,'Conta');
  ensure(!bill.cancelled,'Esta conta foi cancelada.');ensure(input.amountCents<=billOutstanding(state,scope,bill),'O pagamento excede o saldo em aberto.');
  if(bill.saleId){const sale=scoped(state.sales,scope,bill.saleId,'Operação');ensure(input.date>=(sale.statusHistory[0]?.date??sale.date),'O recebimento não pode anteceder a criação da operação.');}if(bill.purchaseId){const purchase=scoped(state.purchases,scope,bill.purchaseId,'Compra');ensure(bill.id===purchase.billId||bill.id===purchase.refundBillId,'A conta não pertence à compra vinculada.');ensure(input.date>=(bill.id===purchase.refundBillId?purchase.cancelledDate??purchase.date:purchase.date),'O pagamento ou a restituição não pode anteceder o registro vinculado.');}
  safeSum([accountBalance(state,scope,input.accountId),bill.direction==='receber'?input.amountCents:-input.amountCents]);
  const payment:Payment={...input,id:id(),scope,reversed:false,reversalReason:'',manual:true};state.payments.push(payment);return {id:payment.id};
 }
 if(action==='payment.reverse'){
  const input=z.object({id:required,date,reason:required}).parse(data);const payment=scoped(state.payments,scope,input.id,'Pagamento');
  ensure(input.date>=payment.date,'A data do estorno não pode anteceder o pagamento.');
  const bill=scoped(state.bills,scope,payment.billId,'Conta a pagar/receber');ensure(!bill.cancelled&&bill.category!=='Reembolso','Este pagamento pertence a uma operação encerrada; mantenha o histórico do reembolso.');
  if(!payment.reversed){safeSum([accountBalance(state,scope,payment.accountId),bill.direction==='receber'?-payment.amountCents:payment.amountCents]);Object.assign(payment,{reversed:true,reversalReason:input.reason,reversalDate:input.date});}return {id:payment.id};
 }
 if(action==='payment.reconcile'){
  const input=z.object({id:required,date}).parse(data);const payment=scoped(state.payments,scope,input.id,'Pagamento');ensure(!payment.reversed,'Não é possível conciliar um pagamento estornado.');ensure(input.date>=payment.date,'A conferência não pode anteceder o pagamento.');Object.assign(payment,{reconciledAt:input.date});return {id:payment.id};
 }
 if(action==='transfer.create'){
  const input=z.object({fromAccountId:required,toAccountId:required,date,amountCents:cents.refine(v=>v>0,'Informe um valor positivo.'),reason:required}).parse(data);ensure(input.fromAccountId!==input.toAccountId,'Selecione contas diferentes.');scoped(state.accounts,scope,input.fromAccountId,'Conta de origem');scoped(state.accounts,scope,input.toAccountId,'Conta de destino');
  safeSum([accountBalance(state,scope,input.fromAccountId),-input.amountCents]);safeSum([accountBalance(state,scope,input.toAccountId),input.amountCents]);
  const transfer={...input,id:id(),scope};state.transfers.push(transfer);return {id:transfer.id};
 }
 if(action==='closing.create'){
  const input=z.object({accountId:required,date,countedCents:signedCents,notes:text}).parse(data);ensure(!state.closings.some(c=>c.scope===scope&&c.accountId===input.accountId&&c.date===input.date),'Já existe uma conferência para esta conta e data.');
  const {expectedCents,...snapshot}=cashClosingSummary(state,scope,input.accountId,input.date);
  ensure(input.countedCents===expectedCents||input.notes.trim().length>0,'Explique a diferença entre o saldo previsto e o saldo contado.');
  const previous=state.closings.filter(c=>c.scope===scope&&c.accountId===input.accountId&&c.date<input.date).slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  const closing={...input,id:id(),scope,expectedCents,snapshot,recordedAt:new Date().toISOString(),previousClosingId:previous?.id??null};state.closings.push(closing);return {id:closing.id};
 }
 if(action==='product.save'){
  const input=z.object({id:z.string().optional(),name:required,unit:required,minimum:z.number().nonnegative().refine(v=>Number.isSafeInteger(scaled(v))&&Math.abs(v*1000-scaled(v))<0.00001,'Use até três casas decimais.'),lot:z.string().trim().max(150).default(''),expiryDate:z.union([z.literal(''),date]).default(''),supplierId:maybeId}).parse(data);
  if(input.supplierId)scoped(state.contacts,scope,input.supplierId,'Fornecedor');
  ensure(!state.products.some(p=>p.scope===scope&&p.id!==input.id&&p.name.toLocaleLowerCase()===input.name.toLocaleLowerCase()&&p.lot===input.lot),'Já existe um produto com este nome e lote.');
  const product:Product={...input,id:input.id??id(),scope,supplierId:input.supplierId??null};
  if(input.id){const old=scoped(state.products,scope,input.id,'Produto');ensure(old.unit===input.unit||!state.stock.some(m=>m.scope===scope&&m.productId===input.id),'A unidade não pode ser alterada após movimentações.');Object.assign(old,product);}else state.products.push(product);
  return {id:product.id};
 }
 if(action==='stock.create'){
  const input=z.object({productId:required,date,quantity:z.number().refine(v=>v!==0&&Number.isFinite(v)&&Number.isSafeInteger(scaled(v))&&Math.abs(v*1000-scaled(v))<0.00001,'Informe quantidade não nula com até três casas decimais.'),unitCostCents:cents.default(0),kind:z.enum(['compra','consumo','perda','ajuste','devolução']),reason:required,allowNegative:z.boolean().default(false)}).parse(data);
  const product=scoped(state.products,scope,input.productId,'Produto');
  ensure(!['compra','devolução'].includes(input.kind)||input.quantity>0,'Compras e devoluções devem aumentar o estoque.');ensure(!['consumo','perda'].includes(input.kind)||input.quantity<0,'Consumos e perdas devem diminuir o estoque.');
  const resulting=scaled(stockBalance(state,scope,product.id))+scaled(input.quantity);ensure(Number.isSafeInteger(resulting),'Quantidade acima do limite.');ensure(resulting>=0||input.allowNegative,'A saída deixaria o estoque negativo. Registre autorização explícita para um ajuste excepcional.');
  const movement:StockMovement={id:id(),scope,productId:input.productId,date:input.date,quantity:input.quantity,unitCostCents:input.unitCostCents,kind:input.kind,reason:resulting<0?`Saída negativa autorizada: ${input.reason}`:input.reason,saleId:null};state.stock.push(movement);return {id:movement.id};
 }
 return null;
};
