import { expect, it } from 'vitest';
import { emptyState } from '../src/domain/types';
import { applyCommand } from '../src/domain/engine';
import { today } from '../src/domain/shared';
import { recordDocumentContent } from '../src/lib/document-content';

it('prepares customer receipts from real financial records without internal notes, costs or account details', () => {
  const state = emptyState(), date = today();
  const birdId = applyCommand(state, 'real', 'saveBird', { identification: 'QA-DOC', species: 'Calopsita', sex: 'indeterminado', mutation: 'Não informada', certainty: 'informada', origin: 'Não informada', status: 'disponível', acquisitionCents: 999999, notes: 'INTERNO-AVE' })!;
  const contactId = applyCommand(state, 'real', 'contact.save', { kind: 'cliente', name: 'Tutor fictício', notes: 'INTERNO-PESSOA' })!;
  const accountId = applyCommand(state, 'real', 'account.save', { name: 'INTERNO-CONTA', openingCents: 700000 })!;
  const saleId = applyCommand(state, 'real', 'sale.save', { contactId, date, status: 'vendida', notes: 'INTERNO-VENDA', items: [{ kind: 'ave', refId: birdId, description: 'Ave QA', quantity: 1, unitCents: 100000 }], installments: [{ dueDate: date, amountCents: 100000 }] })!;
  applyCommand(state, 'real', 'payment.record', { billId: state.bills[0].id, accountId, date, amountCents: 50000, method: 'Pix confirmado', idempotencyKey: 'qa-doc-pagamento' });
  applyCommand(state, 'real', 'sale.transition', { id: saleId, status: 'entregue', date, reason: 'INTERNO-ENTREGA' });
  const content = recordDocumentContent(state, 'real', 'Recibo de pagamento', { birdId, saleId });
  expect(content).toMatch(/Valor da operação: R\$\s*1\.000,00/);
  expect(content).toMatch(/Recebido líquido: R\$\s*500,00/);
  expect(content).toMatch(/Saldo devido: R\$\s*500,00/);
  expect(content).toContain('não é documento fiscal ou oficial');
  expect(content).not.toContain('INTERNO');
  expect(content).not.toContain('9.999,99');
  expect(recordDocumentContent(state, 'demo', 'Recibo de pagamento', { saleId })).not.toContain('Tutor fictício');
  expect(recordDocumentContent(state, 'real', 'Ficha da ave', { birdId })).not.toContain('INTERNO');
});
