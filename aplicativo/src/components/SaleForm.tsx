import { AnimatePresence, motion } from 'motion/react';
import { Bird as BirdIcon, CircleDollarSign, Package, Plus, Tag, Trash2, Wrench } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ModuleProps, Sale } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { birdLabel, money, moneyInput, parseMoney, today } from '../domain/shared';
import { itemTotal, stockBalance } from '../domain/commercial';
import { birdSalePrice, productTablePrice, serviceEntries } from '../domain/prices';
import { buildPaymentPlan, interestFor, MAX_INTEREST_RATE, monthly, PAYMENT_METHODS, type PaymentMethodId } from '../domain/payment-plan';
import { AttachmentPicker, type PendingAttachment } from './DirectAttachments';
import { BirdChip, Button, SegmentedTabs } from '../ui/bits';
import { cn } from '../ui/cn';

type Status = 'vendida' | 'reservada' | 'orçamento';
type Kind = 'ave' | 'produto' | 'serviço';
type Item = { key: number; kind: Kind; refId: string; description: string; quantity: string; price: string };

const inputCls = 'h-11 py-3 w-full min-w-0 rounded-2xl bg-secondary px-4 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-2 focus:ring-teal/40 [&>option]:bg-card [&>option]:text-foreground';
const unavailable = new Set(['vendido', 'doado', 'transferido', 'falecido']);

function Step({ n, title, children, hint }: { n: number; title: string; children: ReactNode; hint?: ReactNode }) {
  return <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-border/70">
    <header className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-ink-foreground">{n}</span>
      <h3 className="font-sans text-sm font-bold">{title}</h3>
      {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
    </header>
    {children}
  </motion.section>;
}
function Label({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return <label className={cn('flex min-w-0 flex-col gap-1.5', className)}><span className="text-xs font-semibold text-muted-foreground">{text}</span>{children}</label>;
}
const qty = (v: string) => { const s = v.trim(); if (!/^\d+(,\d{1,3})?$/.test(s)) throw new Error('Informe a quantidade com até três casas decimais, usando vírgula.'); return Number(s.replace(',', '.')); };
const safe = <T,>(fn: () => T, fallback: T) => { try { return fn(); } catch { return fallback; } };

/** Sale / reservation / quote in the order the owner thinks: client → date → items → payment → paid? */
export default function SaleForm({ state, scope, command, notify, status, sale, close, navigate }: Pick<ModuleProps, 'state' | 'scope' | 'command' | 'notify'> & { status: Status; sale?: Sale; close: () => void; navigate?: (t: NavigationTarget) => void }) {
  const contacts = state.contacts.filter(c => c.scope === scope && c.kind !== 'fornecedor');
  const birds = state.birds.filter(b => b.scope === scope);
  const products = state.products.filter(p => p.scope === scope);
  const services = serviceEntries(state, scope);
  const nextKey = useRef(1);
  const [contactId, setContactId] = useState(sale?.contactId ?? '');
  const [date, setDate] = useState(sale?.date ?? today());
  const [items, setItems] = useState<Item[]>(() => sale?.items.map(i => ({ key: nextKey.current++, kind: i.kind, refId: i.refId ?? '', description: i.description, quantity: String(i.quantity).replace('.', ','), price: moneyInput(i.unitCents) })) ?? [{ key: 0, kind: 'ave', refId: '', description: '', quantity: '1', price: '' }]);
  const [adjust, setAdjust] = useState(!!sale && (sale.discountCents > 0 || sale.feeCents > 0));
  const [discount, setDiscount] = useState(sale ? moneyInput(sale.discountCents) : '0,00');
  const [fee, setFee] = useState(sale ? moneyInput(sale.feeCents) : '0,00');
  const [method, setMethod] = useState<PaymentMethodId>(() => (PAYMENT_METHODS.find(m => sale?.paymentMethod === m.label)?.id ?? 'pix'));
  const def = PAYMENT_METHODS.find(m => m.id === method)!;
  const [count, setCount] = useState(def.installments ? def.installments.min : 1);
  const [firstDue, setFirstDue] = useState(today());
  const [paid, setPaid] = useState(true);
  const [entry, setEntry] = useState('0,00');
  const [rate, setRate] = useState('0');
  const rateNum = Number((rate || '0').replace(',', '.'));
  const [notes, setNotes] = useState(sale?.notes ?? '');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [fileBusy, setFileBusy] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');

  const usedBirds = new Set(items.filter(i => i.kind === 'ave' && i.refId).map(i => i.refId));
  // Sales and reservations only take birds marked "disponível" (same rule as the sale engine).
  const birdOptions = birds.filter(b => sale?.items.some(i => i.refId === b.id) || (status === 'orçamento' ? !unavailable.has(b.status) : b.status === 'disponível'));
  const total = safe(() => items.reduce((n, i) => n + itemTotal({ quantity: qty(i.quantity), unitCents: parseMoney(i.price || '0') }), 0) - parseMoney(discount || '0') + parseMoney(fee || '0'), NaN);
  const setItem = (key: number, patch: Partial<Item>) => setItems(list => list.map(i => i.key === key ? { ...i, ...patch } : i));

  function pick(item: Item, refId: string) {
    if (item.kind === 'ave') {
      const b = birds.find(x => x.id === refId);
      const price = b ? birdSalePrice(state, scope, b) : null;
      setItem(item.key, { refId, description: b ? birdLabel(b) : '', quantity: '1', price: price !== null ? moneyInput(price) : item.price });
    } else if (item.kind === 'produto') {
      const p = products.find(x => x.id === refId); const price = p ? productTablePrice(state, scope, p.id) : null;
      setItem(item.key, { refId, description: p?.name ?? '', price: price !== null ? moneyInput(price) : item.price });
    } else {
      const s = services.find(x => x.id === refId);
      setItem(item.key, { refId: '', description: s?.name ?? '', price: s ? moneyInput(s.priceCents) : item.price });
    }
  }
  const changeMethod = (id: PaymentMethodId) => { setMethod(id); setRate('0'); const d = PAYMENT_METHODS.find(m => m.id === id)!; setCount(d.installments ? d.installments.min : 1); if (id === 'prazo' || id === 'boleto') setPaid(false); };

  const plan = useMemo(() => safe(() => buildPaymentPlan({ status, method, totalCents: Number.isFinite(total) ? total : 0, date, count, firstDue, paid, entryCents: safe(() => parseMoney(entry || '0'), 0), interestRate: rateNum }), null), [status, method, total, date, count, firstDue, paid, entry, rateNum]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || fileBusy) return; setError('');
    try {
      if (!contactId) throw new Error('Selecione o cliente.');
      for (const i of items) { if (i.kind !== 'serviço' && !i.refId) throw new Error(i.kind === 'ave' ? 'Selecione a ave de cada item.' : 'Selecione o produto de cada item.'); if (!i.description.trim()) throw new Error('Descreva cada item.'); if (!i.price.trim()) throw new Error('Informe o valor de cada item.'); }
      if (!Number.isFinite(total)) throw new Error('Confira valores e quantidades.');
      const p = buildPaymentPlan({ status, method, totalCents: total, date, count, firstDue, paid, entryCents: parseMoney(entry || '0'), interestRate: rateNum });
      setBusy(true);
      const payload = { id: sale?.id, contactId, date, status, items: items.map(i => ({ kind: i.kind, refId: i.kind === 'serviço' ? null : i.refId, description: i.description.trim(), quantity: qty(i.quantity), unitCents: parseMoney(i.price) })), discountCents: parseMoney(discount || '0'), feeCents: parseMoney(fee || '0'), interestCents: p.interestCents, notes, installments: p.installments, receipt: sale ? undefined : p.receipt, paymentMethod: p.paymentMethod, paymentPlan: p.paymentPlan };
      await command(attachments.length ? 'save.withAttachments' : 'sale.save', attachments.length ? { action: 'sale.save', data: payload, attachments } : payload);
      notify(status === 'vendida' ? 'Venda registrada.' : status === 'reservada' ? 'Reserva registrada.' : 'Orçamento salvo.');
      close();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  const word = status === 'vendida' ? 'venda' : status === 'reservada' ? 'reserva' : 'orçamento';
  let n = 0;
  return <form onSubmit={save} className="ui flex flex-col gap-3">
    <Step n={++n} title="Cliente e data">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Label text="Cliente"><select value={contactId} onChange={e => setContactId(e.target.value)} className={inputCls} required>
          <option value="">Selecione o cliente</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></Label>
        <Label text="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required/></Label>
      </div>
      {!contacts.length && <p className="text-xs text-muted-foreground">Cadastre um cliente no menu Clientes antes de registrar.</p>}
    </Step>

    <Step n={++n} title={items.length > 1 ? 'Itens' : 'O que está sendo vendido'} hint={navigate && <button type="button" className="inline-flex items-center gap-1 font-semibold text-teal" onClick={() => { close(); navigate({ view: 'prices' }); }}><Tag className="size-3"/>Tabela de preços</button>}>
      <AnimatePresence initial={false}>
        {items.map((item, index) => {
          const bird = item.kind === 'ave' ? birds.find(b => b.id === item.refId) : undefined;
          const tablePrice = item.kind === 'ave' && bird ? birdSalePrice(state, scope, bird) : item.kind === 'produto' && item.refId ? productTablePrice(state, scope, item.refId) : null;
          return <motion.div key={item.key} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={cn('flex flex-col gap-3', index > 0 && 'border-t border-border pt-3')}>
              <div className="flex items-center justify-between gap-2">
                <SegmentedTabs size="sm" value={item.kind} onChange={k => setItem(item.key, { kind: k, refId: '', description: '', quantity: '1', price: '' })}
                  options={[{ value: 'ave', label: 'Ave', icon: BirdIcon }, { value: 'produto', label: 'Produto', icon: Package }, { value: 'serviço', label: 'Serviço', icon: Wrench }]}/>
                {items.length > 1 && <button type="button" aria-label={`Remover item ${index + 1}`} onClick={() => setItems(list => list.filter(i => i.key !== item.key))} className="press grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-tint-coral hover:text-coral"><Trash2 className="size-4"/></button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                {item.kind === 'ave' && <Label text="Qual ave"><select value={item.refId} onChange={e => pick(item, e.target.value)} className={inputCls} required>
                  <option value="">Selecione a ave</option>
                  {birdOptions.filter(b => !usedBirds.has(b.id) || b.id === item.refId).map(b => <option key={b.id} value={b.id}>{birdLabel(b)} · {b.mutation} · {b.sex}</option>)}
                </select>{!birdOptions.length && <span className="text-[11px] text-muted-foreground">Nenhuma ave disponível. Marque a ave como “disponível” na ficha.</span>}</Label>}
                {item.kind === 'produto' && <Label text="Qual produto"><select value={item.refId} onChange={e => pick(item, e.target.value)} className={inputCls} required>
                  <option value="">Selecione o produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}{p.lot ? ` · lote ${p.lot}` : ''} · {String(stockBalance(state, scope, p.id)).replace('.', ',')} {p.unit}</option>)}
                </select></Label>}
                {item.kind === 'serviço' && <Label text="Qual serviço">{services.length ? <select value={services.find(s => s.name === item.description)?.id ?? (item.description ? 'outro' : '')} onChange={e => e.target.value === 'outro' ? setItem(item.key, { description: ' ' }) : pick(item, e.target.value)} className={inputCls}>
                  <option value="">Selecione o serviço</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="outro">Outro serviço…</option>
                </select> : <input value={item.description} onChange={e => setItem(item.key, { description: e.target.value })} placeholder="Ex.: hospedagem, frete" className={inputCls} maxLength={150}/>}</Label>}
                <Label text={item.kind === 'produto' ? 'Valor unitário' : 'Valor'}><input inputMode="decimal" value={item.price} onChange={e => setItem(item.key, { price: e.target.value })} placeholder="0,00" className={cn(inputCls, 'font-bold tabular-nums')} required/></Label>
              </div>
              {item.kind === 'serviço' && services.length > 0 && !services.some(s => s.name === item.description) && item.description !== '' && <Label text="Descrição do serviço"><input value={item.description.trimStart()} onChange={e => setItem(item.key, { description: e.target.value })} className={inputCls} maxLength={150}/></Label>}
              {item.kind === 'produto' && item.refId && <Label text="Quantidade" className="max-w-[180px]"><input inputMode="decimal" value={item.quantity} onChange={e => setItem(item.key, { quantity: e.target.value })} className={inputCls}/></Label>}
              {bird && <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-2"><BirdChip state={state} scope={scope} bird={bird} size={40}/><span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{tablePrice !== null ? (bird.priceCents ? 'Preço da ficha' : 'Preço da tabela') : 'Sem preço na tabela'}</span></div>}
              {item.kind === 'produto' && item.refId && tablePrice === null && <p className="text-[11px] text-muted-foreground">Sem preço na tabela — digite o valor.</p>}
            </div>
          </motion.div>;
        })}
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setItems(list => [...list, { key: nextKey.current++, kind: 'produto', refId: '', description: '', quantity: '1', price: '' }])}><Plus/>Adicionar outro item</Button>
        {!adjust && <Button variant="ghost" size="sm" onClick={() => setAdjust(true)}>Desconto ou taxa</Button>}
      </div>
      {adjust && <div className="grid grid-cols-2 gap-3">
        <Label text="Desconto (R$)"><input inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} className={inputCls}/></Label>
        <Label text="Taxa / frete (R$)"><input inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} className={inputCls}/></Label>
      </div>}
      <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-ink-foreground">
        <span className="text-sm font-semibold text-ink-muted">Total</span>
        <span className="text-right"><span className="block font-display text-2xl font-semibold tabular-nums">{Number.isFinite(total) ? money(plan && plan.interestCents > 0 ? plan.finalCents : total) : '—'}</span>{plan && plan.interestCents > 0 && <span className="block text-[11px] text-ink-muted">inclui {money(plan.interestCents)} de juros</span>}</span>
      </div>
    </Step>

    <Step n={++n} title={status === 'orçamento' ? 'Forma de pagamento combinada' : 'Forma de pagamento'}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map(m => <button type="button" key={m.id} onClick={() => changeMethod(m.id)} aria-pressed={method === m.id}
          className={cn('press min-h-11 rounded-2xl px-3 py-2 text-left text-xs font-bold leading-tight transition-colors', method === m.id ? 'bg-ink text-ink-foreground shadow-soft' : 'bg-secondary text-secondary-foreground hover:bg-muted')}>{m.label}</button>)}
      </div>
      <AnimatePresence initial={false}>
        {def.installments && <motion.div key="parts" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Label text={def.installments.label}><select value={count} onChange={e => setCount(Number(e.target.value))} className={inputCls}>
              {(() => { const r = def.installments as { min: number; max: number }; return Array.from({ length: r.max - r.min + 1 }, (_, i) => i + r.min); })().map(v => <option key={v} value={v}>{v}x{Number.isFinite(total) && total > 0 ? ` de ${money(Math.ceil((total + interestFor(total, rateNum, v)) / v))}` : ''}</option>)}
            </select></Label>
            {status !== 'orçamento' && !(status === 'vendida' && paid) && <Label text={method === 'credito-parcelado' ? '1ª parcela cai em' : '1º vencimento'}><input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className={inputCls}/></Label>}
            {def.interest && <Label text="Juros (% ao mês)"><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="0" className={inputCls} aria-describedby="juros-hint"/></Label>}
          </div>
          {def.interest && <p id="juros-hint" className="pt-2 text-[11px] text-muted-foreground">{!(rateNum >= 0 && rateNum <= MAX_INTEREST_RATE) ? `Use de 0 a ${MAX_INTEREST_RATE}%.` : rateNum > 0 && plan ? `Juros de ${money(plan.interestCents)} · o cliente paga ${money(plan.finalCents)} no total.` : 'Deixe 0 para parcelar sem juros.'}</p>}
        </motion.div>}
      </AnimatePresence>
    </Step>

    {status !== 'orçamento' && <Step n={++n} title={status === 'reservada' ? 'Sinal da reserva' : method === 'prazo' ? 'Entrada' : 'Já foi pago?'}>
      {status === 'vendida' && method !== 'prazo' && <SegmentedTabs size="sm" value={paid ? 'sim' : 'nao'} onChange={v => setPaid(v === 'sim')} options={[{ value: 'sim', label: method === 'boleto' ? 'Sim, boletos pagos' : 'Sim, já recebi' }, { value: 'nao', label: 'Ainda não' }]}/>}
      {status === 'vendida' && method !== 'prazo' && !paid && !def.installments && <Label text="Receber até" className="max-w-[220px]"><input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className={inputCls}/></Label>}
      {(status === 'reservada' || method === 'prazo') && <div className="grid gap-3 sm:grid-cols-2">
        <Label text={status === 'reservada' ? 'Sinal já recebido (R$)' : 'Entrada já recebida (R$)'}><input inputMode="decimal" value={entry} onChange={e => setEntry(e.target.value)} className={cn(inputCls, 'font-bold')}/></Label>
        {!def.installments && <Label text="Restante para"><input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className={inputCls}/></Label>}
      </div>}
      {plan && plan.installments.length > 0 && <ul className="flex flex-col gap-1 rounded-2xl bg-secondary/60 p-3 text-xs">
        {plan.installments.map((p, i) => <li key={i} className="flex justify-between gap-3"><span className="text-muted-foreground">{plan.installments.length > 1 ? `Parcela ${i + 1}` : 'Valor'} · {p.dueDate.split('-').reverse().join('/')}</span><span className="font-bold tabular-nums">{money(p.amountCents)}{plan.receipt && i === 0 && (plan.receipt.amountCents >= p.amountCents) ? ' · recebido' : ''}</span></li>)}
      </ul>}
      {plan && !plan.receipt && status === 'vendida' && <p className="text-[11px] text-muted-foreground">Fica como “a receber” no Caixa até você confirmar o pagamento.</p>}
    </Step>}

    <details className="group rounded-3xl bg-card p-4 ring-1 ring-border/70">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold"><CircleDollarSign className="size-4 text-teal"/>Observações e comprovante (opcional)</summary>
      <div className="mt-3 flex flex-col gap-3">
        <Label text="Observações internas"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={cn(inputCls, 'h-auto py-3 leading-normal')}/></Label>
        <div className="legacy"><AttachmentPicker value={attachments} onChange={setAttachments} category="Venda / reserva" disabled={busy} onBusyChange={setFileBusy}/></div>
      </div>
    </details>

    {error && <p role="alert" className="rounded-2xl bg-tint-coral px-4 py-3 text-sm font-semibold text-coral">{error}</p>}
    <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-card/95 px-1 pt-2 backdrop-blur sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={close} disabled={busy || fileBusy}>Cancelar</Button>
      <Button type="submit" variant="brand" disabled={busy || fileBusy || !contacts.length}>{busy ? 'Salvando…' : `Salvar ${word}`}</Button>
    </div>
  </form>;
}

export { monthly };
