import { describe, expect, it } from 'vitest';
import { accountBalance, billBalance, billPaid, commercialHandler, itemTotal, salePaid, stockBalance } from '../src/domain/commercial';
import { emptyState, type Bird, type Scope, type State } from '../src/domain/types';

const on='2026-10-07';
function bird(recordId='bird',scope:Scope='demo'):Bird{return {id:recordId,scope,identification:recordId,name:'Luna',species:'Calopsita',sex:'fêmea',mutation:'',certainty:'informada',carriers:'',origin:'Criatório',notes:'',birthDate:'2026-01-01',fatherId:null,motherId:null,createdAt:on,status:'disponível',scientificName:'',microchip:'',sexMethod:'',sexSource:'',visualDescription:'',birthEstimated:false,breeder:'',supplierId:null,acquiredDate:'',acquisitionCents:0,enclosure:'',responsible:'Recanto das Asas',photoId:null,statusHistory:[]};}
// The production dispatcher commits only a successful draft. Use the same contract here.
function invoke(state:State,action:string,data:unknown,scope:Scope='demo'){const draft=structuredClone(state);const result=commercialHandler(draft,scope,action,data);if(result)Object.assign(state,draft);return result?.id;}
function fixture(){const state=emptyState();state.birds.push(bird());const contact=invoke(state,'contact.save',{kind:'cliente',name:'Cliente fictício',phone:'',email:'',notes:'Acompanhamento privado'});const account=invoke(state,'account.save',{name:'Caixa',openingCents:10000});const product=invoke(state,'product.save',{name:'Ração',unit:'kg',minimum:1,lot:'L-1',expiryDate:'2027-01-31'});invoke(state,'stock.create',{productId:product,date:on,quantity:10,unitCostCents:1000,kind:'compra',reason:'Compra de lote fictício'});return {state,contact:contact!,account:account!,product:product!};}
function saleInput(contactId:string,status:'orçamento'|'reservada'|'vendida'='reservada'){return {contactId,date:on,status,items:[{kind:'ave',refId:'bird',description:'Calopsita Luna',quantity:1,unitCents:120000}],discountCents:0,feeCents:0,installments:[{dueDate:on,amountCents:40000},{dueDate:'2026-11-07',amountCents:40000},{dueDate:'2026-12-07',amountCents:40000}]};}

describe('commercial workflows and financial precision',()=>{
 it('reserves an individual bird, receives a deposit once, sells in installments, receives partially and delivers',()=>{
  const {state,contact,account}=fixture();const saleId=invoke(state,'sale.save',saleInput(contact));
  expect(state.birds[0].status).toBe('reservado');expect(state.bills).toHaveLength(3);
  const deposit={billId:state.bills[0].id,accountId:account,date:on,amountCents:15000,method:'Pix manual',idempotencyKey:'signal-device-1'};
  const receipt=invoke(state,'payment.record',deposit);expect(invoke(state,'payment.record',deposit)).toBe(receipt);expect(state.payments).toHaveLength(1);
  invoke(state,'sale.transition',{id:saleId,status:'vendida',date:'2026-10-08',reason:'Venda confirmada'});
  expect(state.birds[0].status).toBe('vendido');expect(state.bills).toHaveLength(3);expect(state.sales[0].date).toBe('2026-10-08');
  invoke(state,'payment.record',{...deposit,date:'2026-10-08',amountCents:10000,idempotencyKey:'second-partial'});
  expect(billBalance(state,'demo',state.bills[0].id)).toBe(15000);expect(salePaid(state,'demo',saleId!)).toBe(25000);expect(accountBalance(state,'demo',account)).toBe(35000);
  invoke(state,'sale.transition',{id:saleId,status:'entregue',date:'2026-10-09',reason:'Entrega ao tutor'});
  expect(state.sales[0].deliveryDate).toBe('2026-10-09');expect(state.sales[0].status).toBe('entregue');expect(state.birds[0].responsible).toBe('Cliente fictício');expect(state.bills.reduce((sum,b)=>sum+billBalance(state,'demo',b.id),0)).toBe(95000);
 });
 it('rejects a second active sale and repeated bird items, including stale availability',()=>{
  const {state,contact}=fixture();invoke(state,'sale.save',saleInput(contact));
  const original=structuredClone(state);expect(()=>invoke(state,'sale.save',saleInput(contact,'vendida'))).toThrow(/reservada|vendida/);expect(state).toEqual(original);
  state.birds[0].status='disponível';expect(()=>invoke(state,'sale.save',saleInput(contact,'vendida'))).toThrow(/outra operação/);
  const duplicates=saleInput(contact,'orçamento');duplicates.items.push({...duplicates.items[0]});expect(()=>invoke(state,'sale.save',duplicates)).toThrow(/duas vezes/);
 });
 it('keeps quotes nonblocking but revalidates availability when converting',()=>{
  const {state,contact}=fixture();const quote=invoke(state,'sale.save',saleInput(contact,'orçamento'));expect(state.birds[0].status).toBe('disponível');expect(state.bills).toHaveLength(0);
  invoke(state,'sale.save',saleInput(contact));expect(()=>invoke(state,'sale.transition',{id:quote,status:'vendida',date:on,reason:'Aceite'})).toThrow(/outra operação/);expect(state.sales[0].status).toBe('orçamento');
 });
 it('cancels with a real outgoing refund, restores product stock once and keeps receipts/history',()=>{
  const {state,contact,account,product}=fixture();const input=saleInput(contact,'vendida');const data={...input,items:[...input.items,{kind:'produto',refId:product,description:'Ração kg',quantity:2,unitCents:3000}],installments:[{dueDate:on,amountCents:126000}]};
  const sale=invoke(state,'sale.save',data);expect(stockBalance(state,'demo',product)).toBe(8);
  invoke(state,'payment.record',{billId:state.bills[0].id,accountId:account,date:on,amountCents:30000,method:'Dinheiro',idempotencyKey:'cash-signal'});
  expect(()=>invoke(state,'sale.transition',{id:sale,status:'cancelada',date:on,reason:'Desistência'})).toThrow(/Conta do reembolso/);
  const cancellation={id:sale,status:'cancelada',date:on,reason:'Desistência com reembolso confirmado',refundAccountId:account};invoke(state,'sale.transition',cancellation);invoke(state,'sale.transition',cancellation);
  expect(stockBalance(state,'demo',product)).toBe(10);expect(state.stock.filter(m=>m.kind==='devolução')).toHaveLength(1);expect(state.payments).toHaveLength(2);expect(state.payments[0].reversed).toBe(false);expect(state.bills[0].cancelled).toBe(true);expect(state.birds[0].status).toBe('disponível');expect(salePaid(state,'demo',sale!)).toBe(0);expect(accountBalance(state,'demo',account)).toBe(10000);expect(state.sales[0].statusHistory.at(-1)?.reason).toContain('reembolso');
  expect(()=>invoke(state,'payment.reverse',{id:state.payments[0].id,date:on,reason:'Estornar após reembolso'})).toThrow(/encerrada/);
 });
 it('returns a delivered bird, preserves its origin and permits a future sale',()=>{
  const {state,contact}=fixture();const sale=invoke(state,'sale.save',saleInput(contact,'vendida'));invoke(state,'sale.transition',{id:sale,status:'entregue',date:on,reason:'Entrega'});
  expect(()=>invoke(state,'sale.transition',{id:sale,status:'cancelada',date:on,reason:'Cancelar entregue'})).toThrow(/devolução/);
  invoke(state,'sale.transition',{id:sale,status:'devolvida',date:on,reason:'Tutor devolveu sem pagamento'});expect(state.birds[0].status).toBe('disponível');expect(state.birds[0].origin).toBe('Criatório');expect(state.birds[0].responsible).toBe('Recanto das Asas');invoke(state,'sale.save',saleInput(contact,'vendida'));expect(state.sales).toHaveLength(2);
 });
 it('records expenses, partial payments, reconciliation and cash differences without inventing revenue on transfers',()=>{
  const {state,contact,account}=fixture();const bank=invoke(state,'account.save',{name:'Banco',openingCents:0});const bill=invoke(state,'bill.save',{direction:'pagar',contactId:contact,category:'Alimentação',costCenter:'Criatório',description:'Compra de ração',dueDate:on,amountCents:5000});
  invoke(state,'payment.record',{billId:bill,accountId:account,date:on,amountCents:2000,method:'Dinheiro',idempotencyKey:'expense-partial'});expect(billBalance(state,'demo',bill!)).toBe(3000);
  invoke(state,'payment.reconcile',{id:state.payments[0].id,date:on});expect(state.payments[0].reconciledAt).toBe(on);
  invoke(state,'transfer.create',{fromAccountId:account,toAccountId:bank,date:on,amountCents:3000,reason:'Reforço na conta bancária'});
  expect(accountBalance(state,'demo',account)).toBe(5000);expect(accountBalance(state,'demo',bank!)).toBe(3000);expect(state.bills).toHaveLength(1);expect(state.payments).toHaveLength(1);
  invoke(state,'closing.create',{accountId:account,date:on,countedCents:4900,notes:'Falta de 1 real'});expect(state.closings[0].expectedCents).toBe(5000);expect(state.closings[0].countedCents-state.closings[0].expectedCents).toBe(-100);expect(()=>invoke(state,'closing.create',{accountId:account,date:on,countedCents:5000})).toThrow(/Já existe/);
 });
 it('reverses a partial receipt once, reopens its bill and maintains past cash balances',()=>{
  const {state,contact,account}=fixture();invoke(state,'sale.save',saleInput(contact));const bill=state.bills[0];invoke(state,'payment.record',{billId:bill.id,accountId:account,date:on,amountCents:10000,method:'Pix manual',idempotencyKey:'mistaken'});
  const reverse={id:state.payments[0].id,date:'2026-10-08',reason:'Confirmação indevida'};invoke(state,'payment.reverse',reverse);invoke(state,'payment.reverse',reverse);expect(state.payments).toHaveLength(1);expect(billPaid(state,'demo',bill.id)).toBe(0);expect(billBalance(state,'demo',bill.id)).toBe(40000);expect(accountBalance(state,'demo',account,on)).toBe(20000);expect(accountBalance(state,'demo',account,'2026-10-08')).toBe(10000);
 });
 it('rejects changed receipt-key payloads and payments above the pending balance',()=>{
  const {state,contact,account}=fixture();invoke(state,'sale.save',saleInput(contact));const payment={billId:state.bills[0].id,accountId:account,date:on,amountCents:10000,method:'Dinheiro',idempotencyKey:'one-key'};invoke(state,'payment.record',payment);expect(()=>invoke(state,'payment.record',{...payment,amountCents:20000})).toThrow(/chave/);expect(()=>invoke(state,'payment.record',{...payment,amountCents:30001,idempotencyKey:'too-large'})).toThrow(/excede/);expect(state.payments).toHaveLength(1);
 });
 it('isolates real and demonstration scopes for every commercial reference',()=>{
  const {state,contact,account,product}=fixture();state.birds.push(bird('real-bird','real'));
  expect(()=>invoke(state,'contact.save',{id:contact,kind:'cliente',name:'Real'},'real')).toThrow(/ambiente/);
  expect(()=>invoke(state,'sale.save',{...saleInput(contact),items:[{kind:'ave',refId:'real-bird',description:'Ave real',quantity:1,unitCents:10}]})).toThrow(/ambiente/);
  expect(()=>invoke(state,'stock.create',{productId:product,date:on,quantity:-1,kind:'consumo',reason:'Teste'},'real')).toThrow(/ambiente/);
  expect(()=>accountBalance(state,'real',account)).toThrow(/ambiente/);expect(stockBalance(state,'real',product)).toBe(0);expect(state.sales).toHaveLength(0);
 });
 it('handles fractional quantities and cent rounding without currency arithmetic drift',()=>{
  const {state,contact,product}=fixture();expect(itemTotal({quantity:0.333,unitCents:100})).toBe(33);expect(itemTotal({quantity:0.005,unitCents:100})).toBe(1);
  invoke(state,'stock.create',{productId:product,date:on,quantity:-0.125,kind:'consumo',reason:'Uso interno'});const sold=invoke(state,'sale.save',{contactId:contact,date:on,status:'vendida',items:[{kind:'produto',refId:product,description:'Ração fracionada',quantity:0.333,unitCents:100}],installments:[{dueDate:on,amountCents:33}]});expect(state.sales.find(s=>s.id===sold)?.totalCents).toBe(33);expect(stockBalance(state,'demo',product)).toBe(9.542);
  expect(()=>invoke(state,'stock.create',{productId:product,date:on,quantity:-0.0001,kind:'consumo',reason:'Precisão excessiva'})).toThrow(/casas decimais/);
 });
 it('blocks expired lots and insufficient grouped stock without partial mutations',()=>{
  const {state,contact,product}=fixture();const input={contactId:contact,date:'2027-02-01',status:'vendida',items:[{kind:'produto',refId:product,description:'Lote vencido',quantity:1,unitCents:100}]};const before=structuredClone(state);expect(()=>invoke(state,'sale.save',input)).toThrow(/vencido/);expect(state).toEqual(before);
  expect(()=>invoke(state,'sale.save',{...input,date:on,items:[{...input.items[0],quantity:6},{...input.items[0],quantity:6}]})).toThrow(/Estoque insuficiente/);expect(state).toEqual(before);
 });
 it('requires recorded authorization for exceptional negative stock and blocks unit changes',()=>{
  const {state,product}=fixture();const movement={productId:product,date:on,quantity:-11,kind:'ajuste',reason:'Contagem física revisada'};expect(()=>invoke(state,'stock.create',movement)).toThrow(/negativo/);invoke(state,'stock.create',{...movement,allowNegative:true});expect(stockBalance(state,'demo',product)).toBe(-1);expect(state.stock.at(-1)?.reason).toContain('autorizada');expect(()=>invoke(state,'product.save',{id:product,name:'Ração',unit:'g',minimum:1,lot:'L-1'})).toThrow(/unidade/);
 });
 it('rejects invalid installment totals and dates, and leaves unknown actions to other handlers',()=>{
  const {state,contact}=fixture();const before=structuredClone(state);expect(()=>invoke(state,'sale.save',{...saleInput(contact),installments:[{dueDate:on,amountCents:119999}]})).toThrow(/soma/);expect(state).toEqual(before);expect(()=>invoke(state,'sale.save',{...saleInput(contact),date:'2026-02-30'})).toThrow(/Data inválida/);expect(commercialHandler(state,'demo','bird.save',{})).toBeNull();
 });
});

describe('cronologia e destino comercial',()=>{
 it('preserves the tutor and returning owner in the bird custody history',()=>{
  const {state,contact}=fixture();const sale=invoke(state,'sale.save',saleInput(contact,'vendida'));
  invoke(state,'sale.transition',{id:sale,status:'entregue',date:'2026-10-08',reason:'Entrega confirmada'});
  invoke(state,'sale.transition',{id:sale,status:'devolvida',date:'2026-10-09',reason:'Retorno confirmado'});
  expect(state.birds[0].custodyHistory?.map(h=>[h.date,h.responsible])).toEqual([['2026-10-08','Cliente fictício'],['2026-10-09','Recanto das Asas']]);
  expect(state.birds[0].origin).toBe('Criatório');
 });
 it('rejects a return before delivery and an operation before the bird birth',()=>{
  const {state,contact}=fixture();const sale=invoke(state,'sale.save',saleInput(contact,'vendida'));
  invoke(state,'sale.transition',{id:sale,status:'entregue',date:'2026-10-09',reason:'Entrega'});
  expect(()=>invoke(state,'sale.transition',{id:sale,status:'devolvida',date:'2026-10-08',reason:'Retorno anterior'})).toThrow(/último evento/);
  expect(state.sales[0].status).toBe('entregue');
  const other=fixture();expect(()=>invoke(other.state,'sale.save',{...saleInput(other.contact),date:'2025-12-31'})).toThrow(/nascimento/);
 });
 it('rejects a receipt before the operation and refund before the actual receipt',()=>{
  const {state,contact,account}=fixture();const sale=invoke(state,'sale.save',saleInput(contact));
  const payment={billId:state.bills[0].id,accountId:account,date:'2026-10-06',amountCents:10000,method:'Dinheiro',idempotencyKey:'chronology-test'};
  expect(()=>invoke(state,'payment.record',payment)).toThrow(/criação da operação/);
  invoke(state,'payment.record',{...payment,date:'2026-10-09'});
  expect(()=>invoke(state,'sale.transition',{id:sale,status:'cancelada',date:'2026-10-08',reason:'Reembolso anterior',refundAccountId:account})).toThrow(/anteceder um recebimento/);
  expect(state.sales[0].status).toBe('reservada');expect(state.payments).toHaveLength(1);
 });
});
