import { z } from 'zod';
import { billPaid, commercialHandler, stockBalance } from './commercial';
import { cents, date, ensure, id, required, text, today } from './shared';
import type { Bill, Handler, Purchase, PurchaseHistory, Scope, State } from './types';

const quantity = z.number().positive().refine(value => Number.isSafeInteger(Math.round(value * 1000)) && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001, 'Use quantidade positiva com até três casas decimais.');
const actualDate=date.refine(value=>value<=today(),'A data não pode estar no futuro.');
const positiveCents = cents.refine(value => value > 0, 'Informe um valor positivo.');
const productInput = z.object({name:required,unit:required,lot:z.string().trim().max(150).default(''),expiryDate:z.union([z.literal(''),date]).default(''),minimum:z.number().nonnegative().default(0),supplierId:z.string().nullable().optional()});
const paymentInput = z.object({accountId:required,date:actualDate,method:required,amountCents:positiveCents.optional()});
const saveInput = z.object({id:required.optional(),revision:z.number().int().positive().optional(),idempotencyKey:required,reason:text,productId:required.optional(),product:productInput.optional(),supplierId:z.string().nullable().optional(),date:actualDate,dueDate:date,quantity,totalCents:positiveCents,notes:text,payment:paymentInput.optional()});
const cancelInput = z.object({id:required,revision:z.number().int().positive(),idempotencyKey:required,date:actualDate,reason:required});

/** Synchronous canonical payload, stored inside the encrypted local state. */
function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value && typeof value==='object')return `{${Object.entries(value).filter(([,entry])=>entry!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>`${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
 return JSON.stringify(value) ?? 'null';
}
function replay(state:State,scope:Scope,key:string,fingerprint:string):string|undefined {
 for(const purchase of state.purchases.filter(row=>row.scope===scope)){
  const operation=purchase.operations.find(row=>row.key===key);
  if(operation){ensure(operation.fingerprint===fingerprint,'Esta chave já foi usada para outra operação de compra.');return purchase.id;}
 }
 return undefined;
}
function findPurchase(state:State,scope:Scope,purchaseId:string):Purchase {
 const purchase=state.purchases.find(row=>row.id===purchaseId&&row.scope===scope);
 ensure(purchase,'Compra não encontrada neste ambiente.');return purchase;
}
function supplier(state:State,scope:Scope,supplierId:string|null):void {
 if(!supplierId)return;
 const contact=state.contacts.find(row=>row.id===supplierId&&row.scope===scope);
 ensure(contact,'Fornecedor não encontrado neste ambiente.');
 ensure(contact.kind==='fornecedor','Selecione um contato cadastrado como fornecedor.');
}
function linkedBill(state:State,scope:Scope,purchase:Purchase):Bill {
 const bill=state.bills.find(row=>row.id===purchase.billId&&row.scope===scope);
 ensure(bill&&bill.direction==='pagar'&&!bill.saleId&&bill.purchaseId===purchase.id,'A obrigação vinculada à compra está inconsistente.');return bill;
}
function snapshot(purchase:Purchase,action:PurchaseHistory['action'],reason:string,at:string,compensationId?:string):PurchaseHistory {
 const {revision,status,productId,stockMovementId,billId,paymentId,supplierId,refundBillId,date,dueDate,quantity,totalCents,notes}=purchase;
 return {revision,status,at,reason,action,...(compensationId?{compensationId}:{}),productId,stockMovementId,billId,paymentId,supplierId,refundBillId,date,dueDate,quantity,totalCents,notes};
}
/** Only copy the affected collections; attachment files are neither read nor copied. */
function transaction(state:State):State {
 return {...state,products:state.products.map(row=>({...row})),stock:state.stock.map(row=>({...row})),bills:state.bills.map(row=>({...row})),payments:state.payments.map(row=>({...row})),purchases:state.purchases.map(row=>structuredClone(row))};
}
function commit(state:State,draft:State):void {
 Object.assign(state,{products:draft.products,stock:draft.stock,bills:draft.bills,payments:draft.payments,purchases:draft.purchases});
}
function unitCost(totalCents:number,amount:number):number {
 const units=BigInt(Math.round(amount*1000));
 const cost=(BigInt(totalCents)*1000n+units/2n)/units;
 ensure(cost<=BigInt(Number.MAX_SAFE_INTEGER),'O custo unitário excede o limite financeiro.');return Number(cost);
}
function moveStock(state:State,scope:Scope,purchaseId:string,data:{productId:string;date:string;quantity:number;unitCostCents:number;kind:'compra'|'ajuste';reason:string}):string {
 const movementId=commercialHandler(state,scope,'stock.create',data)?.id;
 ensure(movementId,'Não foi possível registrar o movimento de estoque.');
 const movement=state.stock.find(row=>row.id===movementId&&row.scope===scope)!;movement.purchaseId=purchaseId;
 return movementId;
}

/** Purchase, stock, obligation and optional payment are committed together. */
export const purchaseHandler:Handler=(state,scope,action,data)=>{
 if(action==='purchase.save'){
  const input=saveInput.parse(data);
  const fingerprint=canonical({action,...input});
  const existingId=replay(state,scope,input.idempotencyKey,fingerprint);
  if(existingId)return {id:existingId};
  ensure(Boolean(input.productId)!==Boolean(input.product),'Selecione um produto existente ou cadastre um novo produto.');
  ensure(input.dueDate>=input.date,'O vencimento não pode anteceder a compra.');
  const previous=input.id?findPurchase(state,scope,input.id):undefined;
  if(previous){
   ensure(previous.status==='ativa','Uma compra cancelada não pode ser alterada.');
   ensure(input.revision===previous.revision,'A compra foi alterada. Reabra o registro antes de salvar.');
   ensure(input.reason.trim().length>0,'Explique o motivo da correção da compra.');
  }else ensure(input.revision===undefined,'Não informe revisão ao criar uma compra.');
  const supplierId=input.supplierId!==undefined?input.supplierId:input.product?.supplierId??null;
  supplier(state,scope,supplierId);
  const paid=previous?billPaid(state,scope,linkedBill(state,scope,previous).id):0;
  ensure(!previous||!linkedBill(state,scope,previous).cancelled,'A obrigação desta compra foi cancelada.');
  ensure(input.totalCents>=paid,'O total corrigido não pode ser menor que os pagamentos registrados. Cancele a compra para registrar a restituição.');
  if(previous)ensure(state.payments.filter(row=>row.scope===scope&&row.billId===previous.billId&&!row.reversed).every(row=>row.date>=input.date),'A data da compra não pode ser posterior a um pagamento registrado.');
  if(input.payment)ensure(input.payment.date>=input.date,'O pagamento não pode anteceder a compra.');
  const draft=transaction(state);
  const productId=input.productId??commercialHandler(draft,scope,'product.save',{...input.product,supplierId})?.id;
  ensure(productId&&draft.products.some(row=>row.id===productId&&row.scope===scope),'Produto não encontrado neste ambiente.');
  const purchaseId=previous?.id??id();
  const revision=(previous?.revision??0)+1;
  let stockMovementId=previous?.stockMovementId??'';
  let compensationId:string|undefined;
  if(previous){
   ensure(draft.stock.some(row=>row.id===previous.stockMovementId&&row.scope===scope&&row.purchaseId===purchaseId&&row.productId===previous.productId&&row.quantity===previous.quantity),'O movimento vinculado à compra está inconsistente.');
  }
  const stockChanged=!previous||previous.productId!==productId||previous.quantity!==input.quantity||previous.totalCents!==input.totalCents||previous.date!==input.date;
  if(stockChanged){
   // Corrections have two movements on the real correction date. The original
   // dated entry remains intact, rather than being retroactively rewritten.
   const movementDate=previous?today():input.date;
   if(previous)ensure(draft.stock.filter(row=>row.scope===scope&&row.purchaseId===purchaseId).every(row=>row.date<=movementDate),'A correção não pode anteceder um movimento desta compra.');
   // Adding first permits a net increase after partial consumption; the final
   // compensation still rejects any negative resulting stock, atomically.
   stockMovementId=moveStock(draft,scope,purchaseId,{productId,date:movementDate,quantity:input.quantity,unitCostCents:unitCost(input.totalCents,input.quantity),kind:'compra',reason:previous?`Correção da compra: ${input.reason}`:'Compra vinculada ao financeiro'});
   if(previous){
    compensationId=moveStock(draft,scope,purchaseId,{productId:previous.productId,date:movementDate,quantity:-previous.quantity,unitCostCents:unitCost(previous.totalCents,previous.quantity),kind:'ajuste',reason:`Compensação da compra anterior: ${input.reason}`});
    draft.stock.find(row=>row.id===compensationId)!.reversalOfId=previous.stockMovementId;
   }
  }
  const billId=previous?.billId??id();
  const bill:Bill={id:billId,scope,direction:'pagar',contactId:supplierId,saleId:null,purchaseId:purchaseId,category:'Compra de materiais',costCenter:'Criatório',description:`Compra · ${draft.products.find(row=>row.id===productId)!.name}`.slice(0,150),dueDate:input.dueDate,amountCents:input.totalCents,cancelled:false};
  if(previous)Object.assign(linkedBill(draft,scope,previous),bill);else draft.bills.push(bill);
  const at=new Date().toISOString();
  const purchase:Purchase={id:purchaseId,scope,revision,status:'ativa',productId,stockMovementId,billId,paymentId:previous?.paymentId??null,supplierId,refundBillId:null,date:input.date,dueDate:input.dueDate,quantity:input.quantity,totalCents:input.totalCents,notes:input.notes,createdAt:previous?.createdAt??at,history:[...(previous?.history??[])],operations:[...(previous?.operations??[]),{key:input.idempotencyKey,fingerprint,revision}]};
  // Register the purchase inside this private transaction first: payment.record
  // validates the purchase identity and its date before accepting the expense.
  if(previous)draft.purchases[draft.purchases.findIndex(row=>row.id===purchaseId&&row.scope===scope)]=purchase;else draft.purchases.push(purchase);
  if(input.payment){
   const payment=commercialHandler(draft,scope,'payment.record',{...input.payment,amountCents:input.payment.amountCents??(input.totalCents-paid),billId, idempotencyKey:`purchase-pay:${purchaseId}:${revision}`});
   ensure(payment?.id,'Não foi possível registrar o pagamento da compra.');purchase.paymentId??=payment.id;
  }
  purchase.history.push(snapshot(purchase,previous?'corrigida':'criada',input.reason||'Compra registrada',at,compensationId));
  commit(state,draft);return {id:purchaseId};
 }
 if(action==='purchase.cancel'){
  const input=cancelInput.parse(data);
  const fingerprint=canonical({action,...input});
  const existingId=replay(state,scope,input.idempotencyKey,fingerprint);
  if(existingId)return {id:existingId};
  const previous=findPurchase(state,scope,input.id);
  ensure(previous.status==='ativa','Esta compra já foi cancelada.');
  ensure(input.revision===previous.revision,'A compra foi alterada. Reabra o registro antes de cancelar.');
  ensure(input.date>=previous.date,'O cancelamento não pode anteceder a compra.');
  ensure(state.stock.filter(row=>row.scope===scope&&row.purchaseId===previous.id).every(row=>row.date<=input.date),'O cancelamento não pode anteceder um movimento desta compra.');
  const originalBill=linkedBill(state,scope,previous);
  ensure(!originalBill.cancelled,'A obrigação desta compra já foi cancelada.');
  ensure(state.payments.filter(row=>row.scope===scope&&row.billId===originalBill.id&&!row.reversed).every(row=>row.date<=input.date),'O cancelamento não pode anteceder um pagamento da compra.');
  ensure(Math.round(stockBalance(state,scope,previous.productId)*1000)>=Math.round(previous.quantity*1000),'O estoque desta compra já foi consumido. Corrija o estoque antes de cancelar.');
  const draft=transaction(state);
  const compensationId=moveStock(draft,scope,previous.id,{productId:previous.productId,date:input.date,quantity:-previous.quantity,unitCostCents:unitCost(previous.totalCents,previous.quantity),kind:'ajuste',reason:`Cancelamento da compra: ${input.reason}`});
  draft.stock.find(row=>row.id===compensationId)!.reversalOfId=previous.stockMovementId;
  const bill=linkedBill(draft,scope,previous);bill.cancelled=true;
  const netPaid=billPaid(draft,scope,bill.id);
  let refundBillId:string|null=null;
  if(netPaid>0){
   refundBillId=id();
   draft.bills.push({id:refundBillId,scope,direction:'receber',contactId:previous.supplierId,saleId:null,purchaseId:previous.id,category:'Restituição de compra',costCenter:'Criatório',description:`Restituição · ${input.reason}`.slice(0,150),dueDate:input.date,amountCents:netPaid,cancelled:false});
  }
  const purchase=findPurchase(draft,scope,previous.id);
  purchase.revision+=1;purchase.status='cancelada';purchase.refundBillId=refundBillId;purchase.cancelledDate=input.date;
  const at=new Date().toISOString();purchase.history.push(snapshot(purchase,'cancelada',input.reason,at,compensationId));
  purchase.operations.push({key:input.idempotencyKey,fingerprint,revision:purchase.revision});
  commit(state,draft);return {id:purchase.id};
 }
 return null;
};
