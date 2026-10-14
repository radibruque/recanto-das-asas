import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountBalance, billBalance, billPaid, cashClosingSummary, commercialHandler, stockBalance } from '../src/domain/commercial';
import { purchaseHandler } from '../src/domain/purchases';
import { emptyState, type Scope, type State } from '../src/domain/types';

const on='2026-10-10';
const now='2026-10-14';
function commercial(state:State,action:string,data:unknown,scope:Scope='demo'):string {
 const result=commercialHandler(state,scope,action,data);expect(result?.id).toBeTruthy();return result!.id!;
}
function purchase(state:State,action:string,data:unknown,scope:Scope='demo'):string {
 const result=purchaseHandler(state,scope,action,data);expect(result?.id).toBeTruthy();return result!.id!;
}
function fixture(){
 const state=emptyState();
 const supplierId=commercial(state,'contact.save',{kind:'fornecedor',name:'Fornecedor fictício'});
 const accountId=commercial(state,'account.save',{name:'Caixa fictício',openingCents:100000});
 const productId=commercial(state,'product.save',{name:'Ração fictícia',unit:'kg',minimum:1,lot:'L-1',supplierId});
 return {state,supplierId,accountId,productId};
}
function input(productId:string,supplierId:string|null=null){return {idempotencyKey:'purchase-create-1',productId,supplierId,date:on,dueDate:'2026-11-10',quantity:10,totalCents:20000,notes:'Compra fictícia para teste'};}
function change(state:State,patch:Record<string,unknown>={}){
 const row=state.purchases[0];
 return {...input(row.productId,row.supplierId),id:row.id,revision:row.revision,idempotencyKey:`purchase-change-${row.revision}`,reason:'Correção solicitada',date:row.date,dueDate:row.dueDate,quantity:row.quantity,totalCents:row.totalCents,notes:row.notes,...patch};
}
function cancel(state:State,patch:Record<string,unknown>={}){const row=state.purchases[0];return {id:row.id,revision:row.revision,idempotencyKey:'purchase-cancel-1',date:now,reason:'Devolução ao fornecedor',...patch};}
function paidFixture(amountCents=20000){const fixtureData=fixture();const {state,productId,supplierId,accountId}=fixtureData;purchase(state,'purchase.save',{...input(productId,supplierId),payment:{accountId,date:on,method:'Pix',amountCents}});return fixtureData;}

describe('compra integrada: estoque, obrigação e pagamento atômicos',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(`${now}T12:00:00Z`));});
 afterEach(()=>vi.useRealTimers());

 it('creates a new material and unpaid purchase with stable links without inventing a payment',()=>{
  const {state,supplierId}=fixture();
  const purchaseId=purchase(state,'purchase.save',{...input('unused',supplierId),productId:undefined,product:{name:'Sementes fictícias',unit:'g',lot:'L-2',expiryDate:'2027-01-31',minimum:2}});
  const row=state.purchases[0],bill=state.bills[0],movement=state.stock[0];
  expect(row.id).toBe(purchaseId);expect(row.revision).toBe(1);expect(row.status).toBe('ativa');expect(row.supplierId).toBe(supplierId);
  expect(movement).toMatchObject({id:row.stockMovementId,productId:row.productId,quantity:10,kind:'compra',purchaseId,saleId:null,date:on,unitCostCents:2000});
  expect(bill).toMatchObject({id:row.billId,direction:'pagar',amountCents:20000,purchaseId,contactId:supplierId,cancelled:false,saleId:null});
  expect(row.paymentId).toBeNull();expect(state.payments).toHaveLength(0);expect(billBalance(state,'demo',bill.id)).toBe(20000);
  expect(row.history[0]).toMatchObject({action:'criada',revision:1,status:'ativa',quantity:10,totalCents:20000,paymentId:null});
 });

 it('pays a purchase once and retries the same request without another stock entry, obligation or expense',()=>{
  const {state,productId,supplierId,accountId}=fixture();
  const data={...input(productId,supplierId),payment:{accountId,date:on,method:'Dinheiro'}};
  const purchaseId=purchase(state,'purchase.save',data),original=structuredClone(state);
  expect(purchase(state,'purchase.save',data)).toBe(purchaseId);expect(state).toEqual(original);
  expect(state.stock).toHaveLength(1);expect(state.bills).toHaveLength(1);expect(state.payments).toHaveLength(1);
  expect(state.purchases[0].paymentId).toBe(state.payments[0].id);expect(billPaid(state,'demo',state.bills[0].id)).toBe(20000);expect(accountBalance(state,'demo',accountId)).toBe(80000);
 });

 it('rejects a changed payload using an existing key without changing any record',()=>{
  const {state,productId,supplierId}=fixture();const data=input(productId,supplierId);purchase(state,'purchase.save',data);const before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...data,totalCents:20001})).toThrow(/chave/);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...data,notes:'Conteúdo diferente'})).toThrow(/chave/);expect(state).toEqual(before);
 });

 it('rolls back a new product, stock and bill when the last payment step fails',()=>{
  const {state,supplierId}=fixture();const before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...input('unused',supplierId),productId:undefined,product:{name:'Novo material',unit:'kg'},payment:{accountId:'missing-account',date:on,method:'Pix'}})).toThrow(/Conta não encontrad/);
  expect(state).toEqual(before);
 });

 it('rejects both/neither product modes and excessive payment before committing any part',()=>{
  const {state,productId,supplierId,accountId}=fixture(),before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...input(productId,supplierId),product:{name:'Ração',unit:'kg'}})).toThrow(/produto existente/);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...input(productId,supplierId),productId:undefined})).toThrow(/produto existente/);
  expect(()=>purchaseHandler(state,'demo','purchase.save',{...input(productId,supplierId),payment:{accountId,date:on,method:'Pix',amountCents:20001}})).toThrow(/excede/);expect(state).toEqual(before);
 });

 it('requires valid dates and quantities and leaves absent supplier explicit',()=>{
  const {state,productId}=fixture(),before=structuredClone(state);
  for(const patch of [{quantity:0},{quantity:1.0001},{date:'2026-02-30'},{date:'2026-10-15'},{dueDate:'2026-10-09'},{totalCents:0}])expect(()=>purchaseHandler(state,'demo','purchase.save',{...input(productId),...patch})).toThrow();
  expect(state).toEqual(before);purchase(state,'purchase.save',input(productId));expect(state.purchases[0].supplierId).toBeNull();expect(state.bills[0].contactId).toBeNull();
 });

 it('isolates suppliers, materials, accounts and purchases between real and demonstration',()=>{
  const {state,productId,supplierId,accountId}=fixture(),data=input(productId,supplierId),before=structuredClone(state);
  expect(()=>purchaseHandler(state,'real','purchase.save',data)).toThrow(/Fornecedor/);
  expect(()=>purchaseHandler(state,'real','purchase.save',{...data,supplierId:null})).toThrow(/Produto/);
  purchase(state,'purchase.save',data);
  expect(()=>purchaseHandler(state,'real','purchase.cancel',cancel(state))).toThrow(/Compra não encontrada/);
  const realProduct=commercial(state,'product.save',{name:'Material real',unit:'kg',minimum:0},'real');
  const after=structuredClone(state);expect(()=>purchaseHandler(state,'real','purchase.save',{...input(realProduct),payment:{accountId,date:on,method:'Pix'}})).toThrow(/Conta não encontrad/);expect(state).toEqual(after);
  expect(before.purchases).toHaveLength(0);
 });

 it('requires a supplier contact rather than silently reclassifying a client',()=>{
  const {state,productId}=fixture();const client=commercial(state,'contact.save',{kind:'cliente',name:'Cliente fictício'}),before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',input(productId,client))).toThrow(/cadastrado como fornecedor/);expect(state).toEqual(before);
 });

 it('requires the current revision and a reason for corrections',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));const before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{revision:2}))).toThrow(/Reabra/);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{revision:undefined}))).toThrow(/Reabra/);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{reason:''}))).toThrow(/motivo/);expect(state).toEqual(before);
 });

 it('corrects quantity atomically after partial consumption and keeps stock evidence and the same bill',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));
  commercial(state,'stock.create',{productId,date:'2026-10-11',quantity:-8,kind:'consumo',reason:'Uso fictício'});
  const originalMovement=structuredClone(state.stock[0]),oldBill=state.bills[0].id;
  const data=change(state,{quantity:11,totalCents:22000});purchase(state,'purchase.save',data);
  expect(stockBalance(state,'demo',productId)).toBe(3);expect(state.stock[0]).toEqual(originalMovement);
  expect(state.bills).toHaveLength(1);expect(state.bills[0].id).toBe(oldBill);expect(state.bills[0].amountCents).toBe(22000);
  const row=state.purchases[0];expect(row.history).toHaveLength(2);expect(row.history[0].quantity).toBe(10);expect(row.history[1].quantity).toBe(11);expect(row.revision).toBe(2);
  expect(state.stock.slice(-2).map(m=>m.date)).toEqual([now,now]);expect(state.stock.at(-1)?.reversalOfId).toBe(originalMovement.id);
  const before=structuredClone(state);purchase(state,'purchase.save',data);expect(state).toEqual(before);
 });

 it('updates notes, supplier, due date and an additional payment after consumption without replacing stock',()=>{
  const {state,productId,supplierId,accountId}=paidFixture(5000);
  commercial(state,'stock.create',{productId,date:'2026-10-11',quantity:-10,kind:'consumo',reason:'Uso de todo o material'});
  const originalStock=structuredClone(state.stock),oldMovement=state.purchases[0].stockMovementId,firstPayment=state.purchases[0].paymentId;
  const otherSupplier=commercial(state,'contact.save',{kind:'fornecedor',name:'Outro fornecedor fictício'});
  purchase(state,'purchase.save',change(state,{supplierId:otherSupplier,notes:'Nota complementar',dueDate:'2026-12-10',payment:{accountId,date:now,method:'Pix',amountCents:3000}}));
  expect(state.stock).toEqual(originalStock);expect(state.purchases[0].stockMovementId).toBe(oldMovement);expect(state.purchases[0].paymentId).toBe(firstPayment);
  expect(state.bills[0]).toMatchObject({contactId:otherSupplier,dueDate:'2026-12-10'});expect(billPaid(state,'demo',state.bills[0].id)).toBe(8000);expect(state.payments).toHaveLength(2);expect(supplierId).not.toBe(otherSupplier);
 });

 it('blocks corrections below paid amount and reductions beyond remaining stock without partial mutations',()=>{
  const {state,productId}=paidFixture();let before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{totalCents:19999}))).toThrow(/menor/);expect(state).toEqual(before);
  commercial(state,'stock.create',{productId,date:'2026-10-11',quantity:-8,kind:'consumo',reason:'Uso fictício'});before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{quantity:7}))).toThrow(/negativo/);expect(state).toEqual(before);
 });

 it('blocks changing a consumed product and retries successfully after an explicit stock correction',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));
  const otherProduct=commercial(state,'product.save',{name:'Outro material',unit:'kg',minimum:0});
  commercial(state,'stock.create',{productId,date:'2026-10-11',quantity:-1,kind:'consumo',reason:'Uso fictício'});
  const data=change(state,{productId:otherProduct}),before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',data)).toThrow(/negativo/);expect(state).toEqual(before);
  commercial(state,'stock.create',{productId,date:now,quantity:1,kind:'ajuste',reason:'Retorno revisado e documentado'});purchase(state,'purchase.save',data);
  expect(stockBalance(state,'demo',productId)).toBe(0);expect(stockBalance(state,'demo',otherProduct)).toBe(10);expect(state.purchases[0].productId).toBe(otherProduct);
 });

 it('preserves the original purchase date and records both date-correction stock rows on the actual correction day',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));
  purchase(state,'purchase.save',change(state,{date:'2026-10-09'}));
  expect(state.purchases[0].date).toBe('2026-10-09');expect(state.purchases[0].history.map(h=>h.date)).toEqual([on,'2026-10-09']);
  expect(state.stock.map(m=>m.date)).toEqual([on,now,now]);expect(stockBalance(state,'demo',productId)).toBe(10);
  const before=structuredClone(state);expect(()=>purchaseHandler(state,'demo','purchase.cancel',cancel(state,{date:'2026-10-13'}))).toThrow(/movimento/);expect(state).toEqual(before);
 });

 it('cancels an unpaid purchase once, retaining the obligation and stock audit without a fake refund',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));const data=cancel(state);
  purchase(state,'purchase.cancel',data);expect(state.purchases[0]).toMatchObject({revision:2,status:'cancelada',refundBillId:null,cancelledDate:now});
  expect(stockBalance(state,'demo',productId)).toBe(0);expect(state.bills).toHaveLength(1);expect(state.bills[0].cancelled).toBe(true);expect(state.payments).toHaveLength(0);
  expect(state.purchases[0].history.map(h=>h.action)).toEqual(['criada','cancelada']);
  const before=structuredClone(state);purchase(state,'purchase.cancel',data);expect(state).toEqual(before);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{idempotencyKey:'after-cancel'}))).toThrow(/cancelada/);expect(state).toEqual(before);
 });

 it('cancels a paid purchase, keeps the real expense and creates one receivable until the supplier actually refunds',()=>{
  const {state,productId,accountId}=paidFixture();const originalPayment=structuredClone(state.payments[0]),originalBill=state.bills[0].id;
  purchase(state,'purchase.cancel',cancel(state));
  const row=state.purchases[0],refund=state.bills.find(b=>b.id===row.refundBillId)!;
  expect(refund).toMatchObject({direction:'receber',amountCents:20000,category:'Restituição de compra',purchaseId:row.id,cancelled:false,saleId:null});
  expect(state.payments).toHaveLength(1);expect(state.payments[0]).toEqual(originalPayment);expect(state.bills.find(b=>b.id===originalBill)?.cancelled).toBe(true);
  expect(accountBalance(state,'demo',accountId)).toBe(80000);expect(stockBalance(state,'demo',productId)).toBe(0);expect(billBalance(state,'demo',refund.id)).toBe(20000);
  commercial(state,'payment.record',{billId:refund.id,accountId,date:now,method:'Restituição recebida via Pix',amountCents:20000,idempotencyKey:'actual-refund-1'});
  expect(accountBalance(state,'demo',accountId)).toBe(100000);expect(billBalance(state,'demo',refund.id)).toBe(0);expect(state.purchases[0].history.at(-1)?.refundBillId).toBe(refund.id);
  expect(state.sales).toHaveLength(0);expect(cashClosingSummary(state,'demo',accountId,now)).toMatchObject({openingCents:100000,incomeCents:20000,expenseCents:20000,expectedCents:100000});
 });

 it('calculates the restitution from net unreversed partial payments',()=>{
  const {state,accountId}=paidFixture(5000),billId=state.bills[0].id;
  const extra=commercial(state,'payment.record',{billId,accountId,date:'2026-10-12',method:'Dinheiro',amountCents:3000,idempotencyKey:'extra-partial'});
  commercial(state,'payment.reverse',{id:extra,date:'2026-10-13',reason:'Pagamento anotado indevidamente'});
  purchase(state,'purchase.cancel',cancel(state));
  expect(state.payments).toHaveLength(2);expect(state.bills.find(b=>b.id===state.purchases[0].refundBillId)?.amountCents).toBe(5000);expect(accountBalance(state,'demo',accountId)).toBe(95000);
 });

 it('rejects cancellation before payments, with stale revision or after consumption without changing money or stock',()=>{
  const {state,productId,accountId}=paidFixture(5000);
  commercial(state,'payment.record',{billId:state.bills[0].id,accountId,date:'2026-10-12',method:'Pix',amountCents:3000,idempotencyKey:'late-pay'});
  let before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.cancel',cancel(state,{date:'2026-10-11'}))).toThrow(/pagamento/);
  expect(()=>purchaseHandler(state,'demo','purchase.cancel',cancel(state,{revision:2}))).toThrow(/Reabra/);expect(state).toEqual(before);
  commercial(state,'stock.create',{productId,date:'2026-10-13',quantity:-0.001,kind:'consumo',reason:'Uso fracionado'});before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.cancel',cancel(state))).toThrow(/consumido/);expect(state).toEqual(before);
 });

 it('keeps operation keys unique across create, corrections and cancellations within a scope',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));const before=structuredClone(state);
  expect(()=>purchaseHandler(state,'demo','purchase.save',change(state,{idempotencyKey:'purchase-create-1'}))).toThrow(/chave/);
  expect(()=>purchaseHandler(state,'demo','purchase.cancel',cancel(state,{idempotencyKey:'purchase-create-1'}))).toThrow(/chave/);expect(state).toEqual(before);
 });

 it('uses actual cent totals and three-decimal quantities without currency drift',()=>{
  const {state,productId}=fixture();purchase(state,'purchase.save',{...input(productId),quantity:0.333,totalCents:100});
  expect(state.stock[0].unitCostCents).toBe(300);expect(state.bills[0].amountCents).toBe(100);expect(stockBalance(state,'demo',productId)).toBe(0.333);
  purchase(state,'purchase.cancel',cancel(state));expect(stockBalance(state,'demo',productId)).toBe(0);
 });

 it('does not reinterpret legacy purchases, opening balances or adjustments as paid expenses',()=>{
  const {state,productId}=fixture();commercial(state,'stock.create',{productId,date:on,quantity:5,kind:'compra',unitCostCents:500,reason:'Entrada antiga'});
  commercial(state,'stock.create',{productId,date:on,quantity:1,kind:'ajuste',reason:'Saldo inicial conferido'});
  const originalStock=structuredClone(state.stock);purchase(state,'purchase.save',input(productId));
  expect(state.stock.slice(0,2)).toEqual(originalStock);expect(state.purchases).toHaveLength(1);expect(state.bills).toHaveLength(1);expect(state.payments).toHaveLength(0);expect(stockBalance(state,'demo',productId)).toBe(16);
 });

 it('leaves files and unrelated collections untouched and returns null for unrelated commands',()=>{
  const {state,productId}=fixture();const files=state.attachments,documents=state.documents,birds=state.birds,settings=state.settings;
  expect(purchaseHandler(state,'demo','sale.save',{})).toBeNull();purchase(state,'purchase.save',input(productId));
  expect(state.attachments).toBe(files);expect(state.documents).toBe(documents);expect(state.birds).toBe(birds);expect(state.settings).toBe(settings);
 });

 it('protects an unpaid linked obligation from independent financial editing',()=>{
  const {state,productId,supplierId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));const bill=state.bills[0],before=structuredClone(state);
  expect(()=>commercialHandler(state,'demo','bill.save',{...bill,description:'Alteração fora da compra',amountCents:5000})).toThrow(/Use a compra/);expect(state).toEqual(before);
 });

 it('rejects a generic payment before the linked purchase date',()=>{
  const {state,productId,supplierId,accountId}=fixture();purchase(state,'purchase.save',input(productId,supplierId));const before=structuredClone(state);
  expect(()=>commercialHandler(state,'demo','payment.record',{billId:state.bills[0].id,accountId,date:'2026-10-09',amountCents:1000,method:'Pix',idempotencyKey:'early-payment'})).toThrow(/anteceder/);expect(state).toEqual(before);
 });

 it('rejects restitution before cancellation and further payment of the cancelled original obligation',()=>{
  const {state,accountId}=paidFixture(5000);purchase(state,'purchase.cancel',cancel(state));const row=state.purchases[0],before=structuredClone(state);
  expect(()=>commercialHandler(state,'demo','payment.record',{billId:row.refundBillId,accountId,date:'2026-10-13',amountCents:5000,method:'Pix',idempotencyKey:'early-refund'})).toThrow(/anteceder/);
  expect(()=>commercialHandler(state,'demo','payment.record',{billId:row.billId,accountId,date:now,amountCents:1000,method:'Pix',idempotencyKey:'cancelled-pay'})).toThrow(/cancelada/);expect(state).toEqual(before);
 });
});
