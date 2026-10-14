import type { Scope, State } from '../domain/types';
import { birdLabel, dateLabel, money } from '../domain/shared';
import { billOutstanding, salePaid } from '../domain/commercial';

/** Customer-facing text reads only explicitly allowed metadata, never internal costs or notes. */
export function recordDocumentContent(state: State, scope: Scope, template: string, links: { birdId?: string; saleId?: string; recordId?: string } = {}): string {
  const birds = state.birds.filter(b => b.scope === scope);
  const bird = birds.find(b => b.id === links.birdId);
  const sale = state.sales.find(s => s.scope === scope && s.id === links.saleId);
  const info = bird ? `Ave: ${birdLabel(bird)}\nEspécie: ${bird.species}\nSexo: ${bird.sex} · ${bird.sexMethod || 'Método não informado'} · ${bird.sexSource || 'Fonte não informada'}\nMutação: ${bird.mutation} · ${bird.certainty}\nNascimento${bird.birthEstimated ? ' estimado' : ''}: ${dateLabel(bird.birthDate)}` : '';
  if (['Recibo de pagamento', 'Orçamento', 'Termo de entrega', 'Extrato de cobrança'].includes(template)) {
    if (!sale) return 'Selecione uma operação para preencher os dados.';
    const contact = state.contacts.find(c => c.scope === scope && c.id === sale.contactId);
    const bills = state.bills.filter(b => b.scope === scope && b.saleId === sale.id && b.direction === 'receber');
    const payments = state.payments.filter(p => p.scope === scope && !p.reversed && bills.some(b => b.id === p.billId));
    const outstanding = bills.reduce((sum, bill) => sum + billOutstanding(state, scope, bill), 0);
    return `${template} próprio — não é documento fiscal ou oficial\nOperação: ${sale.number}\nCliente: ${contact?.name || 'Não informado'}\nData da operação: ${dateLabel(sale.date)}\nSituação: ${sale.status}\nItens:\n${sale.items.map(item => `${item.description} · ${item.quantity.toLocaleString('pt-BR')} × ${money(item.unitCents)}`).join('\n')}\nValor da operação: ${money(sale.totalCents)}\nRecebimentos confirmados:\n${payments.map(payment => `${dateLabel(payment.date)} · ${money(payment.amountCents)} · ${payment.method}`).join('\n') || 'Nenhum recebimento registrado.'}\nRecebido líquido: ${money(salePaid(state, scope, sale.id))}\nSaldo devido: ${money(outstanding)}\nEntrega: ${dateLabel(sale.deliveryDate)}\nRegistrar entrega não quita o saldo devido.\nAssinatura do responsável: __________________\nAssinatura do cliente: __________________`;
  }
  if (['Ficha da ave', 'Documento de origem'].includes(template)) return `${info}\nOrigem registrada: ${bird?.origin || 'Não informada'}\nCriador: ${bird?.breeder || 'Não informado'}\nPai: ${birdLabel(birds.find(b => b.id === bird?.fatherId))}\nMãe: ${birdLabel(birds.find(b => b.id === bird?.motherId))}`;
  if (template === 'Ficha do casal') {
    const pair = state.pairs.find(p => p.scope === scope && p.id === links.recordId);
    return pair ? `Casal: ${pair.name}\nAve 1: ${birdLabel(birds.find(b => b.id === pair.maleId))}\nAve 2: ${birdLabel(birds.find(b => b.id === pair.femaleId))}\nRecinto: ${pair.enclosure}\nInício: ${dateLabel(pair.startDate)}\nEncerramento: ${dateLabel(pair.endDate)}` : 'Selecione um casal.';
  }
  if (template === 'Registro de postura') {
    const clutch = state.clutches.find(c => c.scope === scope && c.id === links.recordId);
    return clutch ? `Postura: ${clutch.id}\nCasal: ${state.pairs.find(p => p.scope === scope && p.id === clutch.pairId)?.name || ''}\nInício: ${dateLabel(clutch.startDate)}\n${state.eggs.filter(e => e.scope === scope && e.clutchId === clutch.id).map(e => `Ovo ${e.number}: ${dateLabel(e.laidDate)} · ${e.fertility} · ${e.status}`).join('\n')}` : 'Selecione uma postura.';
  }
  return 'Inclua orientações revisadas para a espécie e os dados que deseja entregar ao tutor.';
}
