import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownLeft, ArrowUpRight, Baby, CalendarClock, Egg, FileBarChart, HandCoins, Heart, MessageCircle, Receipt, ShoppingBag, ShoppingCart, Thermometer, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Scope, State } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { billOutstanding } from '../domain/commercial';
import { dateLabel, money, today } from '../domain/shared';
import { historyStatuses } from '../lib/navigation';
import { reportSuggestions } from '../lib/notices';
import { BirdPhoto, ChartTooltip, EmptyHint, Panel, SegmentedTabs, StatCard, StatusBadge, shortSpecies } from '../ui/bits';
import { Meter, Stagger } from '../ui/motion';
import { cn } from '../ui/cn';
import { cashBalance } from './Today';

const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const reais = (n: number) => money(Math.round(n));
const lastMonths = (count: number) => { const iso = today(); const [y, m] = iso.split('-').map(Number) as [number, number]; return Array.from({ length: count }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1)); return { key: d.toISOString().slice(0, 7), mes: monthNames[d.getUTCMonth()]! }; }); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00Z').valueOf() - new Date(a + 'T12:00:00Z').valueOf()) / 86400000);
type Props = { state: State; scope: Scope; navigate: (t: NavigationTarget) => void };

/** Money in and out per month (reversed payments ignored). */
function cashSeries(state: State, scope: Scope) {
  const bills = new Map(state.bills.filter(b => b.scope === scope).map(b => [b.id, b]));
  const rows = lastMonths(6).map(m => ({ ...m, entradas: 0, saidas: 0 }));
  for (const p of state.payments) {
    if (p.scope !== scope || p.reversed) continue;
    const r = rows.find(x => x.key === p.date.slice(0, 7)); if (!r) continue;
    if (bills.get(p.billId)?.direction === 'pagar') r.saidas += p.amountCents / 100; else r.entradas += p.amountCents / 100;
  }
  return rows;
}

/** Caixa: one balance, money in/out and the history of sales and purchases. */
export function CashOverview({ state, scope, navigate }: Props) {
  const iso = today(), month = iso.slice(0, 7);
  const bills = state.bills.filter(b => b.scope === scope && !b.cancelled);
  const byId = new Map(bills.map(b => [b.id, b]));
  const balance = cashBalance(state, scope);
  const payments = state.payments.filter(p => p.scope === scope && !p.reversed);
  const inMonth = payments.filter(p => p.date.startsWith(month) && byId.get(p.billId)?.direction !== 'pagar').reduce((s, p) => s + p.amountCents, 0);
  const outMonth = payments.filter(p => p.date.startsWith(month) && byId.get(p.billId)?.direction === 'pagar').reduce((s, p) => s + p.amountCents, 0);
  const toReceive = bills.filter(b => b.direction === 'receber').reduce((s, b) => s + billOutstanding(state, scope, b), 0);
  const toPay = bills.filter(b => b.direction === 'pagar').reduce((s, b) => s + billOutstanding(state, scope, b), 0);
  const serie = useMemo(() => cashSeries(state, scope), [state.payments, state.bills, scope]);
  const [tab, setTab] = useState<'tudo' | 'vendas' | 'compras'>('tudo');
  const contacts = new Map(state.contacts.filter(c => c.scope === scope).map(c => [c.id, c]));
  const products = new Map(state.products.filter(p => p.scope === scope).map(p => [p.id, p]));
  const history = [
    ...state.sales.filter(s => s.scope === scope && s.status !== 'orçamento').map(s => ({ id: 's' + s.id, kind: 'venda' as const, date: s.date, title: `${s.number} · ${contacts.get(s.contactId)?.name ?? 'Sem cliente'}`, detail: s.items.map(i => i.description).join(' · '), amount: s.totalCents, status: s.status, target: { view: 'sales', saleId: s.id } })),
    ...state.purchases.filter(p => p.scope === scope).map(p => ({ id: 'p' + p.id, kind: 'compra' as const, date: p.date, title: products.get(p.productId)?.name ?? 'Compra', detail: `${p.quantity.toLocaleString('pt-BR')} ${products.get(p.productId)?.unit ?? ''}${p.supplierId ? ' · ' + (contacts.get(p.supplierId)?.name ?? '') : ''}`, amount: p.totalCents, status: p.status === 'cancelada' ? 'cancelada' : 'paga', target: { view: 'stock', filter: 'purchases' } })),
  ].filter(h => tab === 'tudo' || (tab === 'vendas' ? h.kind === 'venda' : h.kind === 'compra')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return <Stagger className="ui mb-6 flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <StatCard label="Saldo em caixa" value={balance / 100} format={n => reais(n * 100)} icon={Wallet} tone="ink" hint="Tudo o que entrou menos o que saiu"/>
      <StatCard label="Entradas no mês" value={inMonth / 100} format={n => reais(n * 100)} icon={ArrowDownLeft} tone="leaf" hint={`Saídas: ${money(outMonth)}`}/>
      <StatCard label="A receber" value={toReceive / 100} format={n => reais(n * 100)} icon={HandCoins} tone="sky" hint="Vendas e reservas em aberto"/>
      <StatCard label="A pagar" value={toPay / 100} format={n => reais(n * 100)} icon={Receipt} tone="coral" hint="Compras e despesas em aberto"/>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Panel title="Entradas × saídas" subtitle="Últimos 6 meses">
        <div className="mb-3 flex gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-leaf"/>Entradas</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-coral"/>Saídas</span>
        </div>
        <div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ left: -8, right: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeDasharray="4 4"/>
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }}/>
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }} tickFormatter={v => `${Math.round(v / 1000)}k`}/>
            <Tooltip content={<ChartTooltip format={n => reais(n * 100)}/>} cursor={{ fill: 'var(--ui-secondary)' }}/>
            <Bar dataKey="entradas" name="Entradas" fill="var(--ui-leaf)" radius={[8, 8, 0, 0]} animationDuration={800}/>
            <Bar dataKey="saidas" name="Saídas" fill="var(--ui-coral)" radius={[8, 8, 0, 0]} animationDuration={800}/>
          </BarChart>
        </ResponsiveContainer></div>
      </Panel>
      <Panel title="Histórico de vendas e compras" action={<SegmentedTabs size="sm" value={tab} onChange={setTab} options={[{ value: 'tudo', label: 'Tudo' }, { value: 'vendas', label: 'Vendas' }, { value: 'compras', label: 'Compras' }]}/>}>
        {history.length === 0 && <EmptyHint>Nenhuma venda ou compra registrada ainda.</EmptyHint>}
        <ul className="flex flex-col divide-y divide-border">
          <AnimatePresence initial={false} mode="popLayout">
            {history.map(h => <motion.li layout key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <button type="button" onClick={() => navigate(h.target)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', h.kind === 'venda' ? 'bg-tint-leaf text-leaf' : 'bg-tint-coral text-coral')}>{h.kind === 'venda' ? <ArrowUpRight className="size-4"/> : <ShoppingCart className="size-4"/>}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.title}</span><span className="block truncate text-xs text-muted-foreground">{dateLabel(h.date)} · {h.detail}</span></span>
                <span className="text-right"><span className={cn('block text-sm font-bold', h.kind === 'venda' ? 'text-leaf' : 'text-coral')}>{h.kind === 'venda' ? '+' : '−'} {money(h.amount)}</span><StatusBadge status={h.status} className="mt-0.5"/></span>
              </button>
            </motion.li>)}
          </AnimatePresence>
        </ul>
      </Panel>
    </div>
  </Stagger>;
}

/** Vendas e reservas: month revenue, open orders, reservations and active clients. */
export function SalesOverview({ state, scope }: Props) {
  const iso = today(), month = iso.slice(0, 7);
  const sales = state.sales.filter(s => s.scope === scope);
  const monthTotal = sales.filter(s => ['vendida', 'entregue'].includes(s.status) && s.date.startsWith(month)).reduce((n, s) => n + s.totalCents, 0);
  const open = sales.filter(s => ['orçamento', 'reservada', 'vendida'].includes(s.status)).length;
  const reservations = sales.filter(s => s.status === 'reservada').length;
  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const activeClients = new Set(sales.filter(s => s.date >= since).map(s => s.contactId)).size;
  return <Stagger className="ui mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
    <StatCard label="Faturamento do mês" value={monthTotal / 100} format={n => reais(n * 100)} icon={ShoppingBag} tone="ink"/>
    <StatCard label="Pedidos em aberto" value={open} icon={MessageCircle} tone="sky" hint="Orçamentos, reservas e entregas"/>
    <StatCard label="Reservas" value={reservations} icon={CalendarClock} tone="sun"/>
    <StatCard label="Clientes ativos" value={activeClients} icon={Users} tone="leaf" hint="Compraram nos últimos 6 meses"/>
  </Stagger>;
}

/** Casais e reprodução: pairs, eggs, chicks, hatch rate and the incubation timeline. */
export function BreedingOverview({ state, scope, navigate }: Props) {
  const iso = today();
  const pairs = state.pairs.filter(p => p.scope === scope && !p.endDate);
  const eggs = state.eggs.filter(e => e.scope === scope);
  const incubating = eggs.filter(e => e.status === 'incubando');
  const decided = eggs.filter(e => ['eclodido', 'infértil', 'perdido'].includes(e.status));
  const rate = decided.length ? Math.round((eggs.filter(e => e.status === 'eclodido').length / decided.length) * 100) : 0;
  const chicks = state.birds.filter(b => b.scope === scope && b.status === 'filhote' && !historyStatuses.has(b.status));
  const birds = state.birds.filter(b => b.scope === scope);
  const photos = new Map(state.attachments.filter(a => a.scope === scope && a.mime.startsWith('image/')).map(a => [a.id, a]));
  const rows = state.clutches.filter(c => c.scope === scope && !c.endDate).map(c => {
    const list = incubating.filter(e => e.clutchId === c.id);
    if (!list.length) return null;
    const pair = state.pairs.find(p => p.id === c.pairId);
    const start = list.map(e => e.incubationDate || e.laidDate).sort()[0]!;
    const expected = list.map(e => e.expectedHatchDate).filter(Boolean).sort()[0];
    const total = expected ? Math.max(1, daysBetween(start, expected)) : 21;
    const bird = birds.find(b => b.id === pair?.maleId) ?? birds.find(b => b.id === pair?.femaleId);
    return { id: c.id, pairId: c.pairId, name: pair?.name ?? 'Casal', day: Math.max(0, daysBetween(start, iso)), total, eggs: list.length, bird };
  }).filter(Boolean) as { id: string; pairId: string; name: string; day: number; total: number; eggs: number; bird?: typeof birds[number] }[];
  return <Stagger className="ui mb-6 flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <StatCard label="Casais formados" value={pairs.length} icon={Heart} tone="teal" onClick={() => navigate({ view: 'pairs', filter: 'active-pairs' })}/>
      <StatCard label="Ovos em incubação" value={incubating.length} icon={Egg} tone="sun" hint={`${incubating.filter(e => e.fertility === 'fértil').length} férteis`} onClick={() => navigate({ view: 'breeding', filter: 'open-clutches' })}/>
      <StatCard label="Filhotes no berçário" value={chicks.length} icon={Baby} tone="leaf" onClick={() => navigate({ view: 'breeding', filter: 'hatchlings' })}/>
      <StatCard label="Taxa de eclosão" value={rate} format={n => `${Math.round(n)}%`} icon={Thermometer} tone="ink" hint={`${decided.length} ovos avaliados`}/>
    </div>
    {rows.length > 0 && <Panel title="Linha do tempo de incubação" subtitle="Dias decorridos por ninho">
      <div className="flex flex-col gap-4">
        {rows.map(r => <button type="button" key={r.id} onClick={() => navigate({ view: 'breeding', clutchId: r.id, pairId: r.pairId })} className="flex items-center gap-3 text-left">
          {r.bird ? <BirdPhoto bird={r.bird} photo={r.bird.photoId ? photos.get(r.bird.photoId) : undefined} size={40}/> : <span className="grid size-10 place-items-center rounded-2xl bg-tint-sun"><Egg className="size-4"/></span>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold">{r.name}</span><span className="shrink-0 text-xs font-bold text-muted-foreground">dia {r.day} de {r.total} · {r.eggs} {r.eggs === 1 ? 'ovo' : 'ovos'}</span></div>
            <Meter value={(r.day / r.total) * 100} className="mt-2 h-2.5" barClassName={r.day >= r.total - 1 ? 'bg-sun' : undefined}/>
          </div>
        </button>)}
      </div>
    </Panel>}
  </Stagger>;
}

const pieColors = ['var(--ui-primary)', 'var(--ui-teal)', 'var(--ui-sun)', 'var(--ui-leaf)', 'var(--ui-coral)', 'var(--ui-sky)'];

/** Relatórios: interactive charts + the end-of-day/week/month/year suggestion. */
export function ReportsOverview({ state, scope }: Props) {
  const [rel, setRel] = useState<'vendas' | 'nascimentos' | 'caixa'>('vendas');
  const [species, setSpecies] = useState<string | null>(null);
  const present = state.birds.filter(b => b.scope === scope && !historyStatuses.has(b.status));
  const composition = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of present) m.set(shortSpecies(b.species), (m.get(shortSpecies(b.species)) ?? 0) + 1);
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [state.birds, scope]);
  const months = lastMonths(12);
  const serie = useMemo(() => {
    if (rel === 'caixa') return cashSeries(state, scope).map(r => ({ mes: r.mes, valor: r.entradas - r.saidas }));
    return months.map(m => ({ mes: m.mes, valor: rel === 'vendas'
      ? state.sales.filter(s => s.scope === scope && ['vendida', 'entregue'].includes(s.status) && s.date.startsWith(m.key)).reduce((n, s) => n + s.totalCents, 0) / 100
      : state.birds.filter(b => b.scope === scope && b.birthDate?.startsWith(m.key)).length }));
  }, [rel, state.sales, state.birds, state.payments, scope]);
  const suggestions = reportSuggestions();
  const sample = present.filter(b => !species || shortSpecies(b.species) === species).slice(0, 6);
  const photos = new Map(state.attachments.filter(a => a.scope === scope && a.mime.startsWith('image/')).map(a => [a.id, a]));
  const fmt = rel === 'vendas' || rel === 'caixa' ? (n: number) => reais(n * 100) : undefined;
  return <Stagger className="ui mb-6 flex flex-col gap-4">
    {suggestions.length > 0 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-3xl bg-tint-sky px-5 py-4 text-sm">
      <FileBarChart className="size-5 text-primary"/>
      <span className="flex-1"><strong>{suggestions.map(s => s.label).join(' e ')}:</strong> é um bom momento para gerar o relatório do {suggestions[0]!.period}. Escolha o tipo abaixo e exporte em PDF, Excel, CSV ou Word.</span>
    </motion.div>}
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Panel title={rel === 'vendas' ? 'Faturamento por mês' : rel === 'nascimentos' ? 'Nascimentos por mês' : 'Resultado do caixa por mês'} subtitle={rel === 'caixa' ? 'Entradas menos saídas, últimos 6 meses' : 'Últimos 12 meses'}
        action={<SegmentedTabs size="sm" value={rel} onChange={setRel} options={[{ value: 'vendas', label: 'Vendas' }, { value: 'nascimentos', label: 'Nascimentos' }, { value: 'caixa', label: 'Caixa' }]}/>}>
        <AnimatePresence mode="wait">
          <motion.div key={rel} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ left: -8, right: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeDasharray="4 4"/>
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }}/>
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }}/>
                <Tooltip content={<ChartTooltip format={fmt}/>} cursor={{ fill: 'var(--ui-secondary)' }}/>
                <Bar dataKey="valor" name={rel === 'nascimentos' ? 'Nascimentos' : 'Valor'} fill={rel === 'nascimentos' ? 'var(--ui-teal)' : rel === 'caixa' ? 'var(--ui-leaf)' : 'var(--ui-sun)'} radius={[8, 8, 0, 0]} animationDuration={800}/>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </Panel>
      <Panel title="Composição do plantel" subtitle="Toque em uma fatia para filtrar">
        {composition.length === 0 ? <EmptyHint>Nenhuma ave cadastrada.</EmptyHint> : <div className="flex flex-col gap-3">
          <div className="h-48"><ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={composition} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} onClick={(d: { name?: string }) => setSpecies(s => s === d.name ? null : d.name ?? null)} animationDuration={800}>
                {composition.map((c, i) => <Cell key={c.name} fill={pieColors[i % pieColors.length]} opacity={!species || species === c.name ? 1 : 0.3} className="cursor-pointer outline-none"/>)}
              </Pie>
              <Tooltip content={<ChartTooltip/>}/>
            </PieChart>
          </ResponsiveContainer></div>
          <div className="flex flex-wrap gap-2">{composition.map((c, i) => <button type="button" key={c.name} onClick={() => setSpecies(s => s === c.name ? null : c.name)} className={cn('press flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', species === c.name ? 'bg-ink text-ink-foreground' : 'bg-secondary')}>
            <span className="size-2 rounded-full" style={{ background: pieColors[i % pieColors.length] }}/>{c.name} · {c.value}</button>)}</div>
          <div className="flex -space-x-2">{sample.map(b => <BirdPhoto key={b.id} bird={b} photo={b.photoId ? photos.get(b.photoId) : undefined} size={36}/>)}</div>
        </div>}
      </Panel>
    </div>
  </Stagger>;
}
