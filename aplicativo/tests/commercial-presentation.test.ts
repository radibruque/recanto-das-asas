import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Commercial from '../src/modules/Commercial';
import { applyCommand } from '../src/domain/engine';
import { emptyState, type State } from '../src/domain/types';
import { today } from '../src/domain/shared';

const scope = 'demo' as const;
const date = today();
function fixture() {
  const state = emptyState();
  const birds = ['FICTICIA-A', 'FICTICIA-B'].map(identification => applyCommand(state, scope, 'saveBird', {
    identification, species: 'Calopsita', sex: 'indeterminado', mutation: 'Mutação fictícia de teste', certainty: 'informada', origin: 'Teste isolado', status: 'disponível',
  })!);
  const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Cliente fictício isolado' })!;
  const accountId = applyCommand(state, scope, 'account.save', { name: 'Caixa fictício', openingCents: 0 })!;
  const saleId = applyCommand(state, scope, 'sale.save', {
    contactId, date, status: 'vendida',
    items: birds.map(refId => ({ kind: 'ave', refId, description: refId === birds[0] ? 'Ave A' : 'Ave B', quantity: 1, unitCents: 50000 })),
    installments: [{ dueDate: date, amountCents: 100000 }],
  })!;
  const receive = (amountCents: number, key: string) => applyCommand(state, scope, 'payment.record', {
    billId: state.bills[0].id, accountId, date, amountCents, method: 'Pix manual', idempotencyKey: key,
  });
  return { state, saleId, receive };
}
function render(state: State, view: 'sales' | 'finance') {
  return renderToStaticMarkup(createElement(Commercial, { state, scope, view, search: '', command: async () => undefined, notify: () => undefined }));
}
/** Text of the single operation row (total + what is still open). */
function saleValues(markup: string) {
  return markup.match(/data-sale-id="[^"]+"[^>]*>(.*?)<\/li>/)?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') ?? '';
}

describe('apresentação de operações e recebimentos sem duplicação por ave', () => {
  it('exibe uma operação de duas aves e mantém vendido, recebido e devido distintos após parcial e entrega', () => {
    const { state, saleId, receive } = fixture();
    receive(20000, 'deposito-ficticio');
    let markup = render(state, 'sales');
    expect(markup.match(/data-sale-id=/g)).toHaveLength(1);
    expect(markup).toContain('FICTICIA-A');
    expect(markup).toContain('FICTICIA-B');
    expect(saleValues(markup)).toMatch(/R\$\s*1\.000,00 falta R\$\s*800,00/);
    receive(30000, 'parcial-ficticio');
    markup = render(state, 'sales');
    const beforeDelivery = saleValues(markup).replace(/vendida|entregue/i, '');
    expect(beforeDelivery).toMatch(/R\$\s*1\.000,00 falta R\$\s*500,00/);
    applyCommand(state, scope, 'sale.transition', { id: saleId, status: 'entregue', date, reason: 'Entrega fictícia de teste' });
    expect(saleValues(render(state, 'sales')).replace(/vendida|entregue/i, '')).toBe(beforeDelivery);
    expect(state.sales).toHaveLength(1);
    expect(state.payments).toHaveLength(2);
  });
  it('exibe cada recebimento uma vez no extrato, incluindo todos os itens da operação', () => {
    const { state, receive } = fixture();
    const first = receive(20000, 'recebimento-primeiro');
    receive(20000, 'recebimento-primeiro');
    const second = receive(30000, 'recebimento-segundo');
    const markup = render(state, 'finance');
    expect(state.payments).toHaveLength(2);
    expect(markup.match(/data-payment-id=/g)).toHaveLength(2);
    expect(markup.match(new RegExp(`data-payment-id="${first}"`, 'g'))).toHaveLength(1);
    expect(markup.match(new RegExp(`data-payment-id="${second}"`, 'g'))).toHaveLength(1);
    expect(markup).toContain('Itens: FICTICIA-A · FICTICIA-B');
  });
});
