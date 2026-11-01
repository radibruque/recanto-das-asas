import { motion } from 'motion/react';
import { ArrowDownLeft, ArrowUpRight, Building2, Check, ChevronRight, Pencil, Phone, Undo2, User } from 'lucide-react';
import type { Bill, Contact, Payment, Sale, Scope, State } from '../domain/types';
import { dateLabel, money, today } from '../domain/shared';
import { billOutstanding, salePaid } from '../domain/commercial';
import { BirdPhoto, EmptyHint, SegmentedTabs, StatusBadge } from '../ui/bits';
import { cn } from '../ui/cn';

/* ---------- Period ---------- */
const monthStart = (iso: string) => iso.slice(0, 8) + '01';
const monthEnd = (iso: string) => { const [y, m] = iso.split('-').map(Number) as [number, number]; return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10); };
const prevMonth = (iso: string) => { const [y, m] = iso.split('-').map(Number) as [number, number]; return new Date(Date.UTC(y, m - 2, 1, 12)).toISOString().slice(0, 10); };

/** Period chooser: all / this month / last month / custom dates. */
export function PeriodBar({ from, to, onChange, className }: { from: string; to: string; onChange: (from: string, to: string) => void; className?: string }) {
  const iso = today();
  const mode = !from && !to ? 'all' : from === monthStart(iso) && to === monthEnd(iso) ? 'month' : from === prevMonth(iso) && to === monthEnd(prevMonth(iso)) ? 'last' : 'custom';
  const input = 'h-9 rounded-full bg-secondary px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal/40';
  return <div className={cn('ui flex flex-wrap items-center gap-2', className)}>
    <SegmentedTabs size="sm" value={mode} onChange={v => {
      if (v === 'all') onChange('', ''); else if (v === 'month') onChange(monthStart(iso), monthEnd(iso)); else if (v === 'last') onChange(prevMonth(iso), monthEnd(prevMonth(iso))); else onChange(from || monthStart(iso), to || iso);
    }} options={[{ value: 'all', label: 'Tudo' }, { value: 'month', label: 'Este mês' }, { value: 'last', label: 'Mês passado' }, { value: 'custom', label: 'Escolher datas' }]}/>
    {mode === 'custom' && <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <input type="date" aria-label="Período inicial" value={from} onChange={e => onChange(e.target.value, to)} className={input}/>até
      <input type="date" aria-label="Período final" value={to} onChange={e => onChange(from, e.target.value)} className={input}/>
    </span>}
  </div>;
}

/** Small clickable number tile. */
export function MiniStat({ label, value, hint, tone = 'sky', onClick }: { label: string; value: string; hint?: string; tone?: 'sky' | 'leaf' | 'sun' | 'coral' | 'teal'; onClick?: () => void }) {
  const bg = { sky: 'bg-tint-sky', leaf: 'bg-tint-leaf', sun: 'bg-tint-sun', coral: 'bg-tint-coral', teal: 'bg-tint-teal' }[tone];
  return <button type="button" onClick={onClick} disabled={!onClick} className={cn('press group flex min-w-0 flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left disabled:cursor-default disabled:opacity-100', bg)}>
    <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
    <span className="whitespace-nowrap font-display text-xl font-semibold tabular-nums">{value}</span>
    {hint && <span className="flex items-center gap-0.5 truncate text-[11px] font-semibold text-muted-foreground">{hint}{onClick && <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5"/>}</span>}
  </button>;
}

/* ---------- Contacts ---------- */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

export function ContactCards({ state, scope, contacts, kind, onOpen, onEdit, onCreate }: { state: State; scope: Scope; contacts: Contact[]; kind: 'cliente' | 'fornecedor'; onOpen: (c: Contact) => void; onEdit: (c: Contact) => void; onCreate: () => void }) {
  const sales = state.sales.filter(s => s.scope === scope), bills = state.bills.filter(b => b.scope === scope);
  if (!contacts.length) return <div className="ui"><EmptyHint>{kind === 'fornecedor' ? 'Nenhum fornecedor ainda.' : 'Nenhum cliente ainda.'} <button type="button" className="font-semibold text-teal" onClick={onCreate}>{kind === 'fornecedor' ? 'Cadastrar fornecedor' : 'Cadastrar cliente'}</button></EmptyHint></div>;
  return <div className="ui grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {contacts.map((c, i) => {
      const supplier = c.kind === 'fornecedor';
      const count = supplier ? state.purchases.filter(p => p.scope === scope && p.supplierId === c.id && p.status === 'ativa').length : sales.filter(s => s.contactId === c.id && ['vendida', 'entregue'].includes(s.status)).length;
      const reservations = supplier ? 0 : sales.filter(s => s.contactId === c.id && s.status === 'reservada').length;
      const open = bills.filter(b => b.contactId === c.id && b.direction === (supplier ? 'pagar' : 'receber')).reduce((n, b) => n + billOutstanding(state, scope, b), 0);
      return <motion.article key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.3) } }}
        className="flex min-w-0 items-center gap-3 rounded-3xl bg-card p-3 shadow-soft ring-1 ring-border/60 transition-shadow hover:shadow-float">
        <button type="button" onClick={() => onOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ficha de ${c.name}`}>
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-semibold', supplier ? 'bg-tint-sun' : 'bg-tint-teal text-teal')}>{initials(c.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5"><span className="truncate font-semibold">{c.name}</span>{supplier ? <Building2 className="size-3.5 shrink-0 text-muted-foreground"/> : <User className="size-3.5 shrink-0 text-muted-foreground"/>}</span>
            <span className="block truncate text-xs text-muted-foreground">{c.phone || c.email || 'Sem contato'}{supplier&&c.interest ? ` · ${c.interest}` : ''}</span>
            <span className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">
              <span className="rounded-lg bg-secondary px-1.5 py-0.5">{count} {count === 1 ? 'compra' : 'compras'}</span>
              {reservations > 0 && <span className="rounded-lg bg-tint-sun px-1.5 py-0.5">{reservations} reserva{reservations > 1 ? 's' : ''}</span>}
              {open > 0 && <span className={cn('rounded-lg px-1.5 py-0.5', supplier ? 'bg-tint-coral text-coral' : 'bg-tint-sky text-primary')}>{supplier ? 'A pagar' : 'A receber'} {money(open)}</span>}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 flex-col gap-1">
          {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} aria-label={`Ligar para ${c.name}`} className="press grid size-8 place-items-center rounded-xl bg-secondary"><Phone className="size-3.5"/></a>}
          <button type="button" onClick={() => onEdit(c)} aria-label={`Editar ${c.name}`} className="press grid size-8 place-items-center rounded-xl bg-secondary"><Pencil className="size-3.5"/></button>
        </span>
      </motion.article>;
    })}
  </div>;
}

/* ---------- Sales ---------- */
export function SaleRows({ state, scope, sales, onOpen }: { state: State; scope: Scope; sales: Sale[]; onOpen: (s: Sale) => void }) {
  const contacts = new Map(state.contacts.filter(c => c.scope === scope).map(c => [c.id, c]));
  const birds = new Map(state.birds.filter(b => b.scope === scope).map(b => [b.id, b]));
  const photos = new Map(state.attachments.filter(a => a.scope === scope && a.mime.startsWith('image/')).map(a => [a.id, a]));
  if (!sales.length) return <div className="ui"><EmptyHint>Nenhuma operação neste filtro.</EmptyHint></div>;
  return <ul className="ui flex flex-col gap-2">
    {sales.map((s, i) => {
      const openCents = state.bills.filter(b => b.scope === scope && b.saleId === s.id && b.direction === 'receber').reduce((n, b) => n + billOutstanding(state, scope, b), 0);
      const itemBirds = s.items.filter(it => it.kind === 'ave' && it.refId).map(it => birds.get(it.refId!)).filter(Boolean);
      const names = s.items.map(it => it.kind === 'ave' && it.refId ? (birds.get(it.refId)?.name || birds.get(it.refId)?.identification || it.description) : it.description);
      return <motion.li key={s.id} data-sale-id={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.02, 0.25) } }}>
        <button type="button" onClick={() => onOpen(s)} className="press grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60 hover:shadow-float">
          <span className="flex -space-x-3">
            {itemBirds.length ? itemBirds.slice(0, 3).map(b => <BirdPhoto key={b!.id} bird={b!} photo={b!.photoId ? photos.get(b!.photoId) : undefined} size={40} className="rounded-xl"/>)
              : <span className="grid size-10 place-items-center rounded-xl bg-tint-sky text-primary"><ArrowUpRight className="size-4"/></span>}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{contacts.get(s.contactId)?.name ?? 'Sem cliente'}</span><StatusBadge status={s.status} className="shrink-0 px-2 py-0.5 text-[10px]"/></span>
            <span className="block truncate text-xs text-muted-foreground">{names.join(' · ')}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{s.number} · {dateLabel(s.date)}{s.paymentPlan ? ` · ${s.paymentPlan}` : ''}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-right">
              <span className="block whitespace-nowrap text-sm font-bold tabular-nums">{money(s.totalCents)}</span>
              {openCents > 0 ? <span className="block whitespace-nowrap text-[11px] font-semibold text-coral">falta {money(openCents)}</span>
                : s.status !== 'orçamento' && !['cancelada', 'devolvida'].includes(s.status) ? <span className="block text-[11px] font-semibold text-leaf">pago</span> : null}
            </span>
            <ChevronRight className="size-4 text-muted-foreground"/>
          </span>
        </button>
      </motion.li>;
    })}
  </ul>;
}

/* ---------- Cash statement (extrato) ---------- */
export function StatementList({ state, scope, payments, onOpenBill, onReconcile, onReverse }: { state: State; scope: Scope; payments: Payment[]; onOpenBill: (b: Bill) => void; onReconcile: (p: Payment) => void; onReverse: (p: Payment) => void }) {
  const bills = new Map(state.bills.filter(b => b.scope === scope).map(b => [b.id, b]));
  const contacts = new Map(state.contacts.filter(c => c.scope === scope).map(c => [c.id, c]));
  const sales = new Map(state.sales.filter(s => s.scope === scope).map(s => [s.id, s]));
  const birdNames = new Map(state.birds.filter(b => b.scope === scope).map(b => [b.id, b.name || b.identification]));
  const itemsOf = (bill?: Bill) => { const sale = bill?.saleId ? sales.get(bill.saleId) : undefined; return sale ? sale.items.map(it => (it.kind === 'ave' && it.refId ? birdNames.get(it.refId) : undefined) ?? it.description).join(' · ') : ''; };
  const active = payments.filter(p => !p.reversed);
  const inCents = active.filter(p => bills.get(p.billId)?.direction !== 'pagar').reduce((n, p) => n + p.amountCents, 0);
  const outCents = active.filter(p => bills.get(p.billId)?.direction === 'pagar').reduce((n, p) => n + p.amountCents, 0);
  const groups = new Map<string, Payment[]>();
  for (const p of payments.slice().sort((a, b) => b.date.localeCompare(a.date))) groups.set(p.date, [...(groups.get(p.date) ?? []), p]);
  return <div className="ui flex flex-col gap-3">
    <div className="grid grid-cols-3 gap-2">
      <MiniStat label="Entradas" value={money(inCents)} tone="leaf"/>
      <MiniStat label="Saídas" value={money(outCents)} tone="coral"/>
      <MiniStat label="Resultado" value={money(inCents - outCents)} tone="sky"/>
    </div>
    {!payments.length && <EmptyHint>Nenhuma entrada ou saída neste período.</EmptyHint>}
    {[...groups.entries()].map(([date, list]) => <section key={date} className="rounded-3xl bg-card p-2 shadow-soft ring-1 ring-border/60">
      <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{dateLabel(date)}</p>
      <ul className="flex flex-col divide-y divide-border">
        {list.map(p => {
          const bill = bills.get(p.billId), out = bill?.direction === 'pagar';
          return <li key={p.id} data-payment-id={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2.5">
            <span className={cn('grid size-9 place-items-center rounded-xl', p.reversed ? 'bg-secondary text-muted-foreground' : out ? 'bg-tint-coral text-coral' : 'bg-tint-leaf text-leaf')}>{out ? <ArrowUpRight className="size-4"/> : <ArrowDownLeft className="size-4"/>}</span>
            <button type="button" onClick={() => bill && onOpenBill(bill)} className="min-w-0 text-left">
              <span className={cn('block truncate text-sm font-semibold', p.reversed && 'line-through opacity-60')}>{bill?.description ?? 'Movimento'}</span>
              <span className="block truncate text-xs text-muted-foreground">{[contacts.get(bill?.contactId ?? '')?.name, p.method].filter(Boolean).join(' · ')}{p.reversed ? ' · estornado' : ''}</span>
              {itemsOf(bill) && <span className="block truncate text-[11px] text-muted-foreground">Itens: {itemsOf(bill)}</span>}
            </button>
            <span className="flex items-center gap-1.5">
              <span className={cn('whitespace-nowrap text-sm font-bold tabular-nums', p.reversed ? 'text-muted-foreground line-through' : out ? 'text-coral' : 'text-leaf')}>{out ? '−' : '+'} {money(p.amountCents)}</span>
              {!p.reversed && <button type="button" onClick={() => !p.reconciledAt && onReconcile(p)} title={p.reconciledAt ? `Conferido em ${dateLabel(p.reconciledAt)}` : 'Marcar como conferido com o banco'} aria-label={p.reconciledAt ? 'Conferido' : 'Marcar conferido'}
                className={cn('press grid size-7 place-items-center rounded-lg', p.reconciledAt ? 'bg-tint-leaf text-leaf' : 'bg-secondary text-muted-foreground hover:text-foreground')}><Check className="size-3.5"/></button>}
              {!p.reversed && bill && !bill.cancelled && bill.category !== 'Reembolso' && <button type="button" onClick={() => onReverse(p)} title="Estornar (desfazer) este registro" aria-label="Estornar registro" className="press grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-tint-coral hover:text-coral"><Undo2 className="size-3.5"/></button>}
            </span>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}

/** Open totals for the two bill cards of the cash screen. */
export function openTotals(state: State, scope: Scope) {
  const bills = state.bills.filter(b => b.scope === scope && !b.cancelled);
  const receive = bills.filter(b => b.direction === 'receber'), pay = bills.filter(b => b.direction === 'pagar');
  const sum = (list: Bill[]) => list.reduce((n, b) => n + billOutstanding(state, scope, b), 0);
  const count = (list: Bill[]) => list.filter(b => billOutstanding(state, scope, b) > 0).length;
  return { receive: sum(receive), receiveCount: count(receive), pay: sum(pay), payCount: count(pay) };
}

export const salePaidCents = salePaid;
