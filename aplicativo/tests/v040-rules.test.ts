import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { emptyState } from '../src/domain/types';
import { today } from '../src/domain/shared';

const scope = 'demo' as const;
const date = today();

function saleFixture(receipt?: { amountCents: number; method: string }) {
  const state = emptyState();
  const birdId = applyCommand(state, scope, 'saveBird', { identification: 'V040-A', species: 'Calopsita', sex: 'indeterminado', mutation: 'Teste', certainty: 'informada', origin: 'Teste', status: 'disponível' })!;
  const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Cliente teste 0.4' })!;
  applyCommand(state, scope, 'sale.save', {
    contactId, date, status: 'vendida',
    items: [{ kind: 'ave', refId: birdId, description: 'Ave', quantity: 1, unitCents: 50000 }],
    installments: [{ dueDate: date, amountCents: 30000 }, { dueDate: date, amountCents: 20000 }],
    ...(receipt ? { receipt } : {}),
  });
  return state;
}

describe('0.4.0 — forma de pagamento na venda', () => {
  it('registra o valor recebido na hora no caixa único, com a forma de pagamento', () => {
    const state = saleFixture({ amountCents: 40000, method: 'Pix' });
    const payments = state.payments.filter(p => p.scope === scope);
    expect(payments.reduce((s, p) => s + p.amountCents, 0)).toBe(40000);
    expect(payments.every(p => p.method === 'Pix')).toBe(true);
    expect(state.accounts.filter(a => a.scope === scope).map(a => a.name)).toEqual(['Caixa']);
  });
  it('sem recebimento, a venda fica toda a receber', () => {
    const state = saleFixture();
    expect(state.payments).toHaveLength(0);
  });
  it('não aceita receber mais que o total da venda', () => {
    expect(() => saleFixture({ amountCents: 60000, method: 'Dinheiro' })).toThrow();
  });
});

describe('0.4.0 — aparelhos conectados', () => {
  it('guarda cada aparelho uma vez e atualiza a última sincronização', () => {
    const state = emptyState();
    applyCommand(state, 'real', 'device.seen', { id: 'pc', name: 'Computador', platform: 'Windows', lastSeen: '2026-10-30T10:00:00.000Z' });
    applyCommand(state, 'real', 'device.seen', { id: 'cel', name: 'Celular', platform: 'Android', lastSeen: '2026-10-31T10:00:00.000Z' });
    applyCommand(state, 'real', 'device.seen', { id: 'pc', name: 'Computador', platform: 'Windows', lastSeen: '2026-10-31T12:00:00.000Z' });
    expect(state.settings.devices?.map(d => [d.id, d.lastSeen])).toEqual([['pc', '2026-10-31T12:00:00.000Z'], ['cel', '2026-10-31T10:00:00.000Z']]);
  });
});
