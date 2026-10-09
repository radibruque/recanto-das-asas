import { describe, expect, it } from 'vitest';
import { accountBalance, billOutstanding, cashClosingSummary, commercialHandler } from '../src/domain/commercial';
import { emptyState, type State } from '../src/domain/types';
import { validateState } from '../src/lib/validation';

const day='2026-10-07';
function apply(state:State,action:string,data:unknown) {
 const draft=structuredClone(state);const result=commercialHandler(draft,'real',action,data);
 if(result)Object.assign(state,draft);return result?.id!;
}
function financialFixture() {
 const state=emptyState();
 const cash=apply(state,'account.save',{name:'Caixa',openingCents:10000});
 const bank=apply(state,'account.save',{name:'Banco',openingCents:50000});
 const receivable=apply(state,'bill.save',{direction:'receber',description:'Serviço',category:'Venda',dueDate:day,amountCents:20000});
 const payable=apply(state,'bill.save',{direction:'pagar',description:'Consulta',category:'Veterinário',dueDate:day,amountCents:3000});
 const receipt=apply(state,'payment.record',{billId:receivable,accountId:cash,date:day,amountCents:10000,method:'Pix manual',idempotencyKey:'receipt'});
 const expense=apply(state,'payment.record',{billId:payable,accountId:cash,date:day,amountCents:3000,method:'Dinheiro',idempotencyKey:'expense'});
 apply(state,'transfer.create',{fromAccountId:bank,toAccountId:cash,date:day,amountCents:2000,reason:'Reforço no caixa'});
 apply(state,'transfer.create',{fromAccountId:cash,toAccountId:bank,date:day,amountCents:500,reason:'Depósito no banco'});
 return {state,cash,bank,receivable,payable,receipt,expense};
}

describe('conferências de caixa auditáveis e quitação por lançamentos',()=>{
 it('explains the expected balance with income, expenses, transfers and dated reversals',()=>{
  const {state,cash,receipt,expense}=financialFixture();
  expect(cashClosingSummary(state,'real',cash,day)).toMatchObject({openingCents:10000,incomeCents:10000,expenseCents:3000,transferInCents:2000,transferOutCents:500,reversalCents:0,expectedCents:18500});
  apply(state,'payment.reverse',{id:receipt,date:'2026-10-08',reason:'Recebimento incorreto'});
  apply(state,'payment.reverse',{id:expense,date:'2026-10-09',reason:'Pagamento incorreto'});
  for(const [date,expected] of [[day,18500],['2026-10-08',8500],['2026-10-09',11500]] as const) {
   expect(cashClosingSummary(state,'real',cash,date).expectedCents).toBe(expected);
   expect(cashClosingSummary(state,'real',cash,date).expectedCents).toBe(accountBalance(state,'real',cash,date));
  }
 });
 it('preserves the closing evidence when a later entry is recorded with an earlier date',()=>{
  const {state,cash,receivable}=financialFixture();
  const closing=apply(state,'closing.create',{accountId:cash,date:day,countedCents:18500,notes:'Conferido com extrato'});
  const original=structuredClone(state.closings[0]);
  expect(original.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);expect(original.snapshot?.paymentIds).toHaveLength(2);expect(original.snapshot?.transferIds).toHaveLength(2);
  apply(state,'payment.record',{billId:receivable,accountId:cash,date:day,amountCents:1000,method:'Dinheiro',idempotencyKey:'backdated'});
  expect(state.closings.find(c=>c.id===closing)).toEqual(original);
  expect(accountBalance(state,'real',cash,day)).toBe(19500);expect(state.closings[0].expectedCents).toBe(18500);
  expect(()=>apply(state,'closing.create',{accountId:cash,date:day,countedCents:19500,notes:'Repetido'})).toThrow(/Já existe/);
 });
 it('requires an explanation for a cash difference and references the previous closing for that account',()=>{
  const {state,cash,bank}=financialFixture();
  expect(()=>apply(state,'closing.create',{accountId:cash,date:day,countedCents:18400,notes:' '})).toThrow(/Explique a diferença/);
  expect(state.closings).toHaveLength(0);
  const first=apply(state,'closing.create',{accountId:cash,date:day,countedCents:18500,notes:''});
  apply(state,'closing.create',{accountId:bank,date:'2026-10-08',countedCents:48500,notes:''});
  apply(state,'closing.create',{accountId:cash,date:'2026-10-08',countedCents:18400,notes:'Falta de um real identificada na contagem'});
  expect(state.closings[0].previousClosingId).toBeNull();expect(state.closings[2].previousClosingId).toBe(first);
  expect(accountBalance(state,'real',cash)).toBe(18500);
 });
 it('uses only movements through the chosen date and keeps account and environment boundaries',()=>{
  const {state,cash,bank,receivable}=financialFixture();
  apply(state,'payment.record',{billId:receivable,accountId:cash,date:'2026-10-10',amountCents:2000,method:'Pix manual',idempotencyKey:'future'});
  expect(cashClosingSummary(state,'real',cash,day).expectedCents).toBe(18500);
  expect(cashClosingSummary(state,'real',bank,day).expectedCents).toBe(48500);
  expect(()=>cashClosingSummary(state,'demo',cash,day)).toThrow(/ambiente/);
  expect(()=>apply(state,'closing.create',{accountId:cash,date:'2026-02-30',countedCents:0,notes:'Teste'})).toThrow(/Data inválida/);
 });
 it('settles a bill by partial payments and reopens it after reversing a confirmed amount',()=>{
  const {state,cash,receivable}=financialFixture();const bill=state.bills.find(b=>b.id===receivable)!;
  expect(billOutstanding(state,'real',bill)).toBe(10000);
  const remaining=apply(state,'payment.record',{billId:receivable,accountId:cash,date:day,amountCents:10000,method:'Dinheiro',idempotencyKey:'settlement'});
  expect(billOutstanding(state,'real',bill)).toBe(0);
  expect(()=>apply(state,'payment.record',{billId:receivable,accountId:cash,date:day,amountCents:1,method:'Dinheiro',idempotencyKey:'overpayment'})).toThrow(/excede/);
  apply(state,'payment.reverse',{id:remaining,date:day,reason:'Confirmação incorreta'});
  expect(billOutstanding(state,'real',bill)).toBe(10000);
 });
 it('keeps the established account balance behavior for legacy reversals without a stored date',()=>{
  const {state,cash,receipt}=financialFixture();
  const payment=state.payments.find(p=>p.id===receipt)!;payment.reversed=true;payment.reversalReason='Estorno antigo';delete payment.reversalDate;
  expect(cashClosingSummary(state,'real',cash,day).expectedCents).toBe(accountBalance(state,'real',cash,day));
 });
});

function closingFixture(){
 const fixture=financialFixture();
 apply(fixture.state,'closing.create',{accountId:fixture.cash,date:day,countedCents:18500,notes:'Conferido'});
 return {...fixture,closing:fixture.state.closings[0]};
}
function addOtherScope(state:State){
 const account={...state.accounts[0],id:'demo-account',scope:'demo' as const};
 const otherAccount={...state.accounts[1],id:'demo-account-other',scope:'demo' as const};
 const bill={...state.bills[0],id:'demo-bill',scope:'demo' as const};
 const payment={...state.payments[0],id:'demo-payment',scope:'demo' as const,accountId:account.id,billId:bill.id};
 const transfer={...state.transfers[0],id:'demo-transfer',scope:'demo' as const,fromAccountId:account.id,toAccountId:otherAccount.id};
 state.accounts.push(account,otherAccount);state.bills.push(bill);state.payments.push(payment);state.transfers.push(transfer);
 return {account,bill,payment,transfer};
}

describe('integridade e compatibilidade dos fechamentos armazenados',()=>{
 it('accepts old closings without optional audit fields, keeping their original historical amounts',()=>{
  const {state,closing}=closingFixture();
  delete closing.recordedAt;delete closing.previousClosingId;delete closing.snapshot;
  closing.expectedCents=1234;closing.countedCents=1200;
  const old={...state,schemaVersion:1};
  const result=validateState(old);
  expect(result.schemaVersion).toBe(2);expect(result.closings[0]).toEqual(closing);
 });
 it('accepts a valid earlier closing from the same account and rejects missing, equal-date or later references',()=>{
  const {state,cash,closing}=closingFixture();
  const nextId=apply(state,'closing.create',{accountId:cash,date:'2026-10-08',countedCents:18500,notes:''});
  expect(validateState(state).closings.find(c=>c.id===nextId)?.previousClosingId).toBe(closing.id);
  for(const invalidId of ['missing',nextId]){
   const invalid=structuredClone(state);invalid.closings[1].previousClosingId=invalidId;
   expect(()=>validateState(invalid)).toThrow(/vínculos/);
  }
  const later=structuredClone(state);later.closings[0].previousClosingId=nextId;
  expect(()=>validateState(later)).toThrow(/vínculos/);
 });
 it('rejects a previous closing from another account or demonstration environment',()=>{
  const {state,bank}=closingFixture();
  const bankClosingId=apply(state,'closing.create',{accountId:bank,date:'2026-10-06',countedCents:50000,notes:''});
  state.closings[0].previousClosingId=bankClosingId;
  expect(()=>validateState(state)).toThrow(/vínculos/);
  const foreign=addOtherScope(state);
  state.closings.push({...state.closings[0],id:'demo-closing',scope:'demo',accountId:foreign.account.id,date:'2026-10-06',snapshot:undefined,previousClosingId:null});
  state.closings[0].previousClosingId='demo-closing';
  expect(()=>validateState(state)).toThrow(/vínculos/);
 });
 it('rejects snapshot payments missing from the base or belonging to another account or scope',()=>{
  for(const kind of ['missing','account','scope','duplicate'] as const){
   const {state,bank,closing}=closingFixture();
   const foreign=addOtherScope(state);
   const wrongAccount={...state.payments[0],id:'other-account-payment',accountId:bank};state.payments.push(wrongAccount);
   closing.snapshot!.paymentIds=kind==='missing'?['missing-payment']:kind==='account'?[wrongAccount.id]:kind==='scope'?[foreign.payment.id]:[state.payments[0].id,state.payments[0].id];
   expect(()=>validateState(state)).toThrow(/vínculos/);
  }
 });
 it('rejects snapshot transfers outside the closing account, scope or base and duplicated IDs',()=>{
  for(const kind of ['missing','account','scope','duplicate'] as const){
   const {state,bank,closing}=closingFixture();
   const foreign=addOtherScope(state);
   const other={...state.accounts[1],id:'third-account'};state.accounts.push(other);
   const wrongAccount={...state.transfers[0],id:'unrelated-transfer',fromAccountId:bank,toAccountId:other.id};state.transfers.push(wrongAccount);
   closing.snapshot!.transferIds=kind==='missing'?['missing-transfer']:kind==='account'?[wrongAccount.id]:kind==='scope'?[foreign.transfer.id]:[state.transfers[0].id,state.transfers[0].id];
   expect(()=>validateState(state)).toThrow(/vínculos/);
  }
 });
 it('uses exact arithmetic when checking the saved summary against its recorded expected balance',()=>{
  const {state,closing}=closingFixture();closing.expectedCents++;
  expect(()=>validateState(state)).toThrow(/resumo do fechamento/);
  closing.snapshot!.openingCents=Number.MAX_SAFE_INTEGER;closing.snapshot!.incomeCents=Number.MAX_SAFE_INTEGER;closing.snapshot!.expenseCents=Number.MAX_SAFE_INTEGER;
  closing.snapshot!.transferInCents=0;closing.snapshot!.transferOutCents=0;closing.snapshot!.reversalCents=0;
  closing.expectedCents=Number.MAX_SAFE_INTEGER;
  expect(validateState(state).closings[0].expectedCents).toBe(Number.MAX_SAFE_INTEGER);
 });
 it('accepts later backdated payments and reversals without changing or recomputing the saved snapshot',()=>{
  const {state,cash,receivable,receipt,closing}=closingFixture();const original=structuredClone(closing);
  apply(state,'payment.record',{billId:receivable,accountId:cash,date:day,amountCents:1000,method:'Dinheiro',idempotencyKey:'after-closing'});
  apply(state,'payment.reverse',{id:receipt,date:day,reason:'Estorno lançado após a conferência'});
  expect(validateState(state).closings[0]).toEqual(original);
  expect(accountBalance(state,'real',cash,day)).toBe(9500);
 });
});
