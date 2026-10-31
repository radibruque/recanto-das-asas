import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { emptyState, type State } from '../src/domain/types';
import { today } from '../src/domain/shared';
import { birdSalePrice, birdTablePrice, productTablePrice } from '../src/domain/prices';
import { buildPaymentPlan } from '../src/domain/payment-plan';
import { validateState } from '../src/lib/validation';

const scope = 'demo' as const;
const date = today();

function addBird(state: State, overrides: Record<string, unknown> = {}) {
  return applyCommand(state, scope, 'saveBird', { identification: `T-${state.birds.length + 1}`, species: 'Calopsita', sex: 'macho', mutation: 'Lutino', certainty: 'informada', origin: 'Teste', status: 'disponível', ...overrides })!;
}

const get = (state: State, id: string) => state.birds.find(b => b.id === id)!;

describe('0.4.1 — tabela de preços (espécie + mutação)', () => {
  function priced() {
    const state = emptyState();
    applyCommand(state, scope, 'prices.save', { entries: [
      { kind: 'ave', species: 'Calopsita', mutation: '', sex: '', priceCents: 15000 },
      { kind: 'ave', species: 'Calopsita', mutation: 'Lutino', sex: '', priceCents: 20000 },
    ] });
    return state;
  }
  it('species + mutation price is the same for male and female', () => {
    const state = priced();
    const female = get(state, addBird(state, { sex: 'fêmea' }));
    const male = get(state, addBird(state, { sex: 'macho' }));
    expect(birdTablePrice(state, scope, female)).toBe(20000);
    expect(birdTablePrice(state, scope, male)).toBe(20000);
  });
  it('falls back to species + mutation, then species only', () => {
    const state = priced();
    const male = get(state, addBird(state));
    const pearl = get(state, addBird(state, { mutation: 'Pérola' }));
    expect(birdTablePrice(state, scope, male)).toBe(20000);
    expect(birdTablePrice(state, scope, pearl)).toBe(15000);
  });
  it("a bird's own asking price wins over the table", () => {
    const state = priced();
    const bird = get(state, addBird(state, { priceCents: 9900 }));
    expect(birdSalePrice(state, scope, bird)).toBe(9900);
  });
  it('keeps real and demo tables apart', () => {
    const state = priced();
    applyCommand(state, 'real', 'prices.save', { entries: [] });
    expect(state.settings.priceTable?.filter(e => e.scope === scope)).toHaveLength(2);
    expect(() => validateState(state)).not.toThrow();
  });
  it('prices products by product', () => {
    const state = emptyState();
    const productId = applyCommand(state, scope, 'product.save', { name: 'Ração', unit: 'kg', minimum: 0, lot: '', expiryDate: '' })!;
    applyCommand(state, scope, 'prices.save', { entries: [{ kind: 'produto', species: '', mutation: '', productId, priceCents: 3500 }] });
    expect(productTablePrice(state, scope, productId)).toBe(3500);
  });
});

describe('0.4.1 — forma de pagamento', () => {
  const base = { status: 'vendida' as const, totalCents: 30000, date: '2026-10-31', firstDue: '2026-11-30', count: 1, paid: false, entryCents: 0 };
  it('Pix already paid: one installment received at once', () => {
    const plan = buildPaymentPlan({ ...base, method: 'pix', paid: true });
    expect(plan.installments).toEqual([{ dueDate: '2026-10-31', amountCents: 30000 }]);
    expect(plan.receipt).toEqual({ amountCents: 30000, method: 'Pix' });
  });
  it('Pix not paid: stays open until the chosen date', () => {
    const plan = buildPaymentPlan({ ...base, method: 'pix' });
    expect(plan.installments).toEqual([{ dueDate: '2026-11-30', amountCents: 30000 }]);
    expect(plan.receipt).toBeUndefined();
  });
  it('credit card in 3x: three monthly installments, label with 3x', () => {
    const plan = buildPaymentPlan({ ...base, method: 'credito-parcelado', count: 3 });
    expect(plan.installments.map(i => i.amountCents)).toEqual([10000, 10000, 10000]);
    expect(plan.installments.map(i => i.dueDate)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(plan.paymentPlan).toBe('Cartão de crédito parcelado · 3x');
  });
  it('credit card in installments needs 2 to 12', () => {
    expect(() => buildPaymentPlan({ ...base, method: 'credito-parcelado', count: 1 })).toThrow(/2 a 12/);
    expect(() => buildPaymentPlan({ ...base, method: 'credito-parcelado', count: 13 })).toThrow(/2 a 12/);
  });
  it('a prazo with a down payment: entry received today, rest split', () => {
    const plan = buildPaymentPlan({ ...base, method: 'prazo', count: 2, entryCents: 10000 });
    expect(plan.installments).toEqual([{ dueDate: '2026-10-31', amountCents: 10000 }, { dueDate: '2026-11-30', amountCents: 10000 }, { dueDate: '2026-12-30', amountCents: 10000 }]);
    expect(plan.receipt?.amountCents).toBe(10000);
  });
  it('reservation sinal is received; the rest stays open', () => {
    const plan = buildPaymentPlan({ ...base, status: 'reservada', method: 'pix', entryCents: 5000 });
    expect(plan.receipt?.amountCents).toBe(5000);
    expect(plan.installments.reduce((n, i) => n + i.amountCents, 0)).toBe(30000);
  });
  it('quote creates no charges', () => {
    expect(buildPaymentPlan({ ...base, status: 'orçamento', method: 'boleto', count: 2 }).installments).toEqual([]);
  });
  it('sale stores the chosen payment method', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Cliente' })!;
    const plan = buildPaymentPlan({ ...base, date, firstDue: date, method: 'pix', paid: true });
    applyCommand(state, scope, 'sale.save', { contactId, date, status: 'vendida', items: [{ kind: 'ave', refId: birdId, description: 'Ave', quantity: 1, unitCents: 30000 }], installments: plan.installments, receipt: plan.receipt, paymentMethod: plan.paymentMethod, paymentPlan: plan.paymentPlan });
    expect(state.sales[0]?.paymentMethod).toBe('Pix');
    expect(() => validateState(state)).not.toThrow();
  });
});

describe('0.4.1 — excluir ave vendida', () => {
  it('keeps the sale and its money, the item becomes "Ave excluída"', () => {
    const state = emptyState();
    const birdId = addBird(state, { name: 'Sol' });
    const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Cliente' })!;
    applyCommand(state, scope, 'sale.save', { contactId, date, status: 'vendida', items: [{ kind: 'ave', refId: birdId, description: 'Ave', quantity: 1, unitCents: 30000 }], installments: [{ dueDate: date, amountCents: 30000 }], receipt: { amountCents: 30000, method: 'Pix' } });
    applyCommand(state, scope, 'deleteBird', { id: birdId });
    expect(state.birds).toHaveLength(0);
    expect(state.sales[0]?.items[0]).toMatchObject({ kind: 'serviço', refId: null });
    expect(state.sales[0]?.items[0]?.description).toMatch(/^Ave excluída/);
    expect(state.sales[0]?.totalCents).toBe(30000);
    expect(state.payments.filter(p => p.scope === scope)).toHaveLength(1);
    expect(() => validateState(state)).not.toThrow();
  });
});

describe('0.4.1 — juros conforme a forma de pagamento', () => {
  const base = { status: 'vendida' as const, totalCents: 100000, date: '2026-10-31', firstDue: '2026-11-30', count: 1, paid: false, entryCents: 0 };
  it('credit card 3x at 2% a.m. adds Price-table interest to the installments', () => {
    const plan = buildPaymentPlan({ ...base, method: 'credito-parcelado', count: 3, interestRate: 2 });
    expect(plan.interestCents).toBe(4026);
    expect(plan.finalCents).toBe(104026);
    expect(plan.installments.reduce((n, i) => n + i.amountCents, 0)).toBe(104026);
    expect(plan.paymentPlan).toContain('juros 2% a.m.');
  });
  it('0% keeps the sale without interest', () => {
    const plan = buildPaymentPlan({ ...base, method: 'boleto', count: 2, interestRate: 0 });
    expect(plan.interestCents).toBe(0);
    expect(plan.finalCents).toBe(100000);
  });
  it('Pix, dinheiro and crédito à vista never charge interest', () => {
    for (const method of ['pix', 'dinheiro', 'credito'] as const) expect(buildPaymentPlan({ ...base, method, interestRate: 5 }).interestCents).toBe(0);
  });
  it('a prazo: interest only on what remains after the entry', () => {
    const plan = buildPaymentPlan({ ...base, method: 'prazo', count: 1, entryCents: 50000, interestRate: 10 });
    expect(plan.interestCents).toBe(5000);
    expect(plan.installments).toEqual([{ dueDate: '2026-10-31', amountCents: 50000 }, { dueDate: '2026-11-30', amountCents: 55000 }]);
  });
  it('rejects interest above 30% a.m.', () => {
    expect(() => buildPaymentPlan({ ...base, method: 'boleto', count: 2, interestRate: 31 })).toThrow(/0 a 30%/);
  });
  it('débito is not offered', async () => {
    const { PAYMENT_METHODS } = await import('../src/domain/payment-plan');
    expect(PAYMENT_METHODS.map(m => m.label)).toEqual(['Pix', 'Dinheiro', 'Cartão de crédito à vista', 'Cartão de crédito parcelado', 'Boleto', 'A prazo / fiado']);
  });
  it('sale total stored with the interest so installments match', () => {
    const state = emptyState();
    const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Ana' })!;
    const plan = buildPaymentPlan({ ...base, method: 'credito-parcelado', count: 3, interestRate: 2 });
    const id = applyCommand(state, scope, 'sale.save', { contactId, date: base.date, status: 'vendida', items: [{ kind: 'serviço', refId: null, description: 'Hospedagem', quantity: 1, unitCents: 100000 }], interestCents: plan.interestCents, installments: plan.installments, paymentMethod: plan.paymentMethod, paymentPlan: plan.paymentPlan })!;
    const sale = state.sales.find(s => s.id === id)!;
    expect(sale.totalCents).toBe(104026);
    expect(sale.interestCents).toBe(4026);
    expect(() => validateState(state)).not.toThrow();
  });
});
