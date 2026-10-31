/** Payment methods of the sale form and how each one becomes installments + money received. */
export type PaymentMethodId = 'pix' | 'dinheiro' | 'credito' | 'credito-parcelado' | 'boleto' | 'prazo';

export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; installments: false | { min: number; max: number; label: string }; interest: boolean }[] = [
  { id: 'pix', label: 'Pix', installments: false, interest: false },
  { id: 'dinheiro', label: 'Dinheiro', installments: false, interest: false },
  { id: 'credito', label: 'Cartão de crédito à vista', installments: false, interest: false },
  { id: 'credito-parcelado', label: 'Cartão de crédito parcelado', installments: { min: 2, max: 12, label: 'Parcelas no cartão' }, interest: true },
  { id: 'boleto', label: 'Boleto', installments: { min: 1, max: 12, label: 'Quantidade de boletos' }, interest: true },
  { id: 'prazo', label: 'A prazo / fiado', installments: { min: 1, max: 24, label: 'Parcelas' }, interest: true },
];

export const methodLabel = (id: PaymentMethodId) => PAYMENT_METHODS.find(m => m.id === id)?.label ?? id;

export type PlanInput = {
  status: 'vendida' | 'reservada' | 'orçamento';
  method: PaymentMethodId;
  totalCents: number;
  /** Operation date (yyyy-mm-dd). */
  date: string;
  /** Installments chosen (only used when the method allows). */
  count: number;
  /** First due date of what is still open. */
  firstDue: string;
  /** Sale: everything already received. */
  paid: boolean;
  /** Reservation sinal or "a prazo" down payment already received. */
  entryCents: number;
  /** Interest in % per month (only for methods with interest; 0 = no interest). */
  interestRate?: number;
};

export type Plan = { installments: { dueDate: string; amountCents: number }[]; receipt?: { amountCents: number; method: string }; paymentMethod: string; paymentPlan: string;
  /** Interest added on top of the sale total. */
  interestCents: number;
  /** Sale total + interest: what the client pays in the end. */
  finalCents: number };

export const MAX_INTEREST_RATE = 30;

/**
 * Interest of a financed amount in `count` monthly installments at `ratePercent` % a.m.
 * Uses the fixed-installment (Tabela Price) rule, the usual one for cards, boletos and crediário.
 */
export function interestFor(financedCents: number, ratePercent: number, count: number): number {
  if (!(ratePercent > 0) || financedCents <= 0 || count < 1) return 0;
  const i = ratePercent / 100;
  const installment = financedCents * i / (1 - Math.pow(1 + i, -count));
  return Math.max(0, Math.round(installment * count) - financedCents);
}

/** Splits cents in monthly parts; the extra cents go to the first parts. */
export function monthly(totalCents: number, count: number, start: string) {
  const base = new Date(start + 'T12:00:00Z');
  if (Number.isNaN(base.valueOf())) throw new Error('Informe o primeiro vencimento.');
  return Array.from({ length: count }, (_, i) => {
    const month = base.getUTCMonth() + i;
    const last = new Date(Date.UTC(base.getUTCFullYear(), month + 1, 0, 12)).getUTCDate();
    const dueDate = new Date(Date.UTC(base.getUTCFullYear(), month, Math.min(base.getUTCDate(), last), 12)).toISOString().slice(0, 10);
    return { dueDate, amountCents: Math.floor(totalCents / count) + (i < totalCents % count ? 1 : 0) };
  });
}

export function buildPaymentPlan(input: PlanInput): Plan {
  const def = PAYMENT_METHODS.find(m => m.id === input.method);
  if (!def) throw new Error('Escolha a forma de pagamento.');
  const count = def.installments ? Math.round(input.count) : 1;
  if (def.installments && (!Number.isInteger(count) || count < def.installments.min || count > def.installments.max)) throw new Error(`${def.installments.label}: use de ${def.installments.min} a ${def.installments.max}.`);
  const rate = def.interest ? Number(input.interestRate ?? 0) : 0;
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_INTEREST_RATE) throw new Error(`Juros: use de 0 a ${MAX_INTEREST_RATE}% ao mês.`);
  const rateText = rate > 0 ? ` · juros ${String(rate).replace('.', ',')}% a.m.` : '';
  const label = def.label + (def.installments && count > 1 ? ` · ${count}x` : '');
  const plan: Plan = { installments: [], paymentMethod: def.label, paymentPlan: label + rateText, interestCents: 0, finalCents: Math.max(0, input.totalCents) };
  if (input.totalCents <= 0) return plan;

  const allowsEntry = input.status === 'reservada' || input.method === 'prazo';
  const entry = allowsEntry && !(input.status === 'vendida' && input.paid) ? Math.max(0, Math.round(input.entryCents)) : 0;
  if (entry > input.totalCents) throw new Error('O valor de entrada/sinal não pode ser maior que o total.');
  const rest = input.totalCents - entry;
  plan.interestCents = interestFor(rest, rate, count);
  plan.finalCents = input.totalCents + plan.interestCents;
  if (input.status === 'orçamento') return plan;

  // Sale fully paid now: one installment, received at once (card interest included).
  if (input.status === 'vendida' && input.paid) {
    plan.installments = [{ dueDate: input.date, amountCents: plan.finalCents }];
    plan.receipt = { amountCents: plan.finalCents, method: label };
    return plan;
  }
  const financed = rest + plan.interestCents;
  plan.installments = [
    ...(entry > 0 ? [{ dueDate: input.date, amountCents: entry }] : []),
    ...(financed > 0 ? monthly(financed, Math.min(count, financed), input.firstDue || input.date) : []),
  ];
  if (entry > 0) plan.receipt = { amountCents: entry, method: label };
  return plan;
}
