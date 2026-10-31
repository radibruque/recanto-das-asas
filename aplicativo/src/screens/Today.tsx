import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Bell, Bird, CalendarClock, Check, Egg, FileBarChart, HandCoins, Heart, Package, Receipt, Truck, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ModuleProps, State, Scope } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { billOutstanding } from '../domain/commercial';
import { birdLabel, dateLabel, money, today } from '../domain/shared';
import { speciesForBird } from '../domain/species';
import { historyStatuses, type Sector } from '../lib/navigation';
import type { Notice } from '../lib/notices';
import { setPreferences, usePreferences } from '../lib/preferences';
import { BirdPhoto, Button, ChartTooltip, EmptyHint, PageHeader, Panel, SegmentedTabs, StatCard, StatusBadge, shortSpecies } from '../ui/bits';
import { Meter, Stagger, riseItem } from '../ui/motion';
import { cn } from '../ui/cn';

type Periodo = '7d' | '30d' | '12m';
const reais = (n: number) => money(Math.round(n));
const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00Z').valueOf() - new Date(a + 'T12:00:00Z').valueOf()) / 86400000);

function saoPauloNow() {
  const now = new Date();
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  const long = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
  return { hour, long };
}

/** Births (hatched eggs or registered birth dates) and sales grouped by period. */
export function productionSeries(state: State, scope: Scope, periodo: Periodo) {
  const iso = today();
  const births = state.birds.filter(b => b.scope === scope && b.birthDate).map(b => b.birthDate.slice(0, 10));
  const sales = state.sales.filter(s => s.scope === scope && ['vendida', 'entregue'].includes(s.status)).map(s => s.date);
  if (periodo === '12m') {
    const rows: { mes: string; key: string; nascimentos: number; vendas: number }[] = [];
    const [y, m] = iso.split('-').map(Number) as [number, number];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = d.toISOString().slice(0, 7);
      rows.push({ mes: monthNames[d.getUTCMonth()]!, key, nascimentos: 0, vendas: 0 });
    }
    for (const b of births) { const r = rows.find(x => x.key === b.slice(0, 7)); if (r) r.nascimentos++; }
    for (const s of sales) { const r = rows.find(x => x.key === s.slice(0, 7)); if (r) r.vendas++; }
    return rows;
  }
  const days = periodo === '7d' ? 7 : 30;
  const rows: { mes: string; key: string; nascimentos: number; vendas: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(iso, -i);
    rows.push({ mes: periodo === '7d' ? new Date(key + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') : key.slice(8) + '/' + key.slice(5, 7), key, nascimentos: 0, vendas: 0 });
  }
  for (const b of births) { const r = rows.find(x => x.key === b); if (r) r.nascimentos++; }
  for (const s of sales) { const r = rows.find(x => x.key === s); if (r) r.vendas++; }
  return rows;
}

/** One overall cash balance: openings + received − paid (reversed payments ignored). */
export function cashBalance(state: State, scope: Scope) {
  const bills = new Map(state.bills.filter(b => b.scope === scope).map(b => [b.id, b]));
  const opening = state.accounts.filter(a => a.scope === scope).reduce((s, a) => s + a.openingCents, 0);
  return state.payments.filter(p => p.scope === scope && !p.reversed).reduce((sum, p) => sum + (bills.get(p.billId)?.direction === 'pagar' ? -p.amountCents : p.amountCents), opening);
}

const toneDot: Record<Notice['tone'], string> = { coral: 'bg-coral', sun: 'bg-sun', teal: 'bg-teal', sky: 'bg-sky', leaf: 'bg-leaf' };
const kindIcon = { task: CalendarClock, hatch: Egg, bill: Receipt, delivery: Truck, stock: Package, report: FileBarChart } as const;

function NoticeBanner({ notices, navigate }: { notices: Notice[]; navigate: (t: NavigationTarget) => void }) {
  const prefs = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? notices : notices.slice(0, 3);
  return <motion.section variants={riseItem} className="overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal"><Bell className="size-4"/>Avisos e observações do dia</p>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{notices.length}</span>
    </div>
    {notices.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">Nada pendente hoje. Tarefas, eclosões, contas e entregas aparecem aqui assim que estiverem próximas.</p> :
      <ul className="divide-y divide-border/60">
        <AnimatePresence initial={false}>
          {shown.map(n => {
            const Icon = kindIcon[n.kind];
            return <motion.li key={n.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-5 py-3">
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl text-ink-foreground', toneDot[n.tone])}><Icon className="size-4"/></span>
              <button type="button" onClick={() => n.target && navigate(n.target)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{n.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>
              </button>
              {n.reportKey ? <button type="button" aria-label="Agora não" title="Agora não" onClick={() => setPreferences({ dismissedReports: [...prefs.dismissedReports.slice(-30), n.reportKey!] })} className="press grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"><X className="size-4"/></button>
                : n.target && <button type="button" onClick={() => navigate(n.target!)} className="press hidden rounded-lg px-2 py-1 text-xs font-bold text-teal hover:bg-tint-teal sm:block">Abrir</button>}
            </motion.li>;
          })}
        </AnimatePresence>
      </ul>}
    {notices.length > 3 && <button type="button" onClick={() => setExpanded(e => !e)} className="w-full border-t border-border/60 px-5 py-2.5 text-xs font-bold text-teal hover:bg-secondary">{expanded ? 'Mostrar menos' : `Ver todos os ${notices.length} avisos`}</button>}
  </motion.section>;
}

export default function Today({ state, scope, command, notify, navigate, sector, notices }: ModuleProps & { navigate: (t: NavigationTarget) => void; sector: Sector; notices: Notice[] }) {
  const prefs = usePreferences();
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [busyTask, setBusyTask] = useState('');
  const iso = today();
  const { hour, long } = saoPauloNow();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const birds = state.birds.filter(b => b.scope === scope);
  const present = birds.filter(b => !historyStatuses.has(b.status));
  const pairs = state.pairs.filter(p => p.scope === scope && !p.endDate);
  const clutches = state.clutches.filter(c => c.scope === scope && !c.endDate);
  const incubating = state.eggs.filter(e => e.scope === scope && e.status === 'incubando');
  const fertile = incubating.filter(e => e.fertility === 'fértil');
  const sitting = new Set(clutches.filter(c => incubating.some(e => e.clutchId === c.id)).map(c => c.pairId));
  const hatchWeek = incubating.filter(e => e.expectedHatchDate && e.expectedHatchDate >= iso && e.expectedHatchDate <= addDays(iso, 7)).length;
  const month = iso.slice(0, 7);
  const prevMonth = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const sold = state.sales.filter(s => s.scope === scope && ['vendida', 'entregue'].includes(s.status));
  const monthSales = sold.filter(s => s.date.startsWith(month));
  const prevSales = sold.filter(s => s.date.startsWith(prevMonth));
  const monthTotal = monthSales.reduce((s, x) => s + x.totalCents, 0);
  const prevTotal = prevSales.reduce((s, x) => s + x.totalCents, 0);
  const birdsSold = monthSales.reduce((s, x) => s + x.items.filter(i => i.kind === 'ave').reduce((a, i) => a + i.quantity, 0), 0);
  const delta = prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : undefined;

  const openBills = state.bills.filter(b => b.scope === scope && !b.cancelled);
  const toReceive = openBills.filter(b => b.direction === 'receber').reduce((s, b) => s + billOutstanding(state, scope, b), 0);
  const toPay = openBills.filter(b => b.direction === 'pagar').reduce((s, b) => s + billOutstanding(state, scope, b), 0);
  const bills = new Map(openBills.map(b => [b.id, b]));
  const receivedMonth = state.payments.filter(p => p.scope === scope && !p.reversed && p.date.startsWith(month) && bills.get(p.billId)?.direction === 'receber').reduce((s, p) => s + p.amountCents, 0);
  const balance = cashBalance(state, scope);
  const deliveries = state.sales.filter(s => s.scope === scope && s.status === 'vendida').length;

  const serie = useMemo(() => productionSeries(state, scope, periodo), [state.birds, state.sales, scope, periodo]);
  const tasks = state.tasks.filter(t => t.scope === scope && (t.dueDate === iso || (!t.done && t.dueDate < iso))).sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate) || (a.reminderTime ?? '').localeCompare(b.reminderTime ?? ''));
  const done = tasks.filter(t => t.done).length;

  const porEspecie = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of present) counts.set(shortSpecies(b.species), (counts.get(shortSpecies(b.species)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n, pct: present.length ? Math.round((n / present.length) * 100) : 0, sample: present.find(b => shortSpecies(b.species) === name)! }));
  }, [present.length, state.birds]);

  const ninhos = clutches.map(c => {
    const eggs = incubating.filter(e => e.clutchId === c.id);
    if (!eggs.length) return null;
    const pair = state.pairs.find(p => p.id === c.pairId);
    const male = birds.find(b => b.id === pair?.maleId), female = birds.find(b => b.id === pair?.femaleId);
    const first = eggs.map(e => e.incubationDate || e.laidDate).sort()[0]!;
    const expected = eggs.map(e => e.expectedHatchDate).filter(Boolean).sort()[0];
    const total = expected ? Math.max(1, daysBetween(first, expected)) : (male && speciesForBird(state, male)?.incubationDays) || 21;
    return { id: c.id, pairId: c.pairId, label: pair?.name || `${male?.name || male?.identification || '?'} × ${female?.name || female?.identification || '?'}`, day: Math.max(0, daysBetween(first, iso)), total, eggs: eggs.length, bird: male ?? female };
  }).filter(Boolean).slice(0, 4) as { id: string; pairId: string; label: string; day: number; total: number; eggs: number; bird?: typeof birds[number] }[];

  const photos = useMemo(() => new Map(state.attachments.filter(a => a.scope === scope && a.mime.startsWith('image/')).map(a => [a.id, a])), [state.attachments, scope]);
  const lastSales = state.sales.filter(s => s.scope === scope).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  async function toggle(id: string, value: boolean) {
    if (busyTask) return;
    setBusyTask(id);
    try { await command('toggleTask', { id, done: value }); notify(value ? 'Tarefa concluída.' : 'Tarefa reaberta.'); }
    catch (e) { notify(e instanceof Error ? e.message : 'Não foi possível alterar a tarefa.'); }
    finally { setBusyTask(''); }
  }

  const description = sector === 'breeding'
    ? `${present.length ? `Seu plantel tem ${present.length} ${present.length === 1 ? 'ave presente' : 'aves presentes'}.` : 'Cadastre sua primeira ave pelo botão +.'}${hatchWeek ? ` Há ${hatchWeek} ${hatchWeek === 1 ? 'eclosão prevista' : 'eclosões previstas'} para esta semana.` : ''}`
    : `Saldo atual de ${money(balance)}. ${deliveries ? `${deliveries} ${deliveries === 1 ? 'entrega pendente' : 'entregas pendentes'}.` : 'Nenhuma entrega pendente.'}`;

  return <Stagger className="flex flex-col gap-6">
    <PageHeader eyebrow={long} title={`${greeting}${prefs.ownerName ? ', ' + prefs.ownerName.split(' ')[0] : ''}`} description={description}
      actions={<Button variant="ink" onClick={() => navigate({ view: 'reports' })}>Ver relatórios <ArrowRight/></Button>}/>

    <NoticeBanner notices={notices} navigate={navigate}/>

    {sector === 'breeding' ? <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <StatCard label="Aves no plantel" value={present.length} icon={Bird} tone="sky" hint={`${birds.length - present.length} no histórico`} onClick={() => navigate({ view: 'birds', filter: 'present' })}/>
      <StatCard label="Casais ativos" value={pairs.length} icon={Heart} tone="teal" hint={`${sitting.size} chocando agora`} onClick={() => navigate({ view: 'pairs', filter: 'active-pairs' })}/>
      <StatCard label="Ovos férteis" value={fertile.length} icon={Egg} tone="sun" hint={`${incubating.length} em incubação`} onClick={() => navigate({ view: 'breeding', filter: 'open-clutches' })}/>
      <StatCard label={`Vendas em ${monthNames[Number(iso.slice(5, 7)) - 1]}`} value={monthTotal / 100} format={n => reais(n * 100)} icon={Wallet} tone="ink" delta={delta} hint={`${birdsSold} ${birdsSold === 1 ? 'ave vendida' : 'aves vendidas'}`} onClick={() => navigate({ view: 'sales', filter: 'sales' })}/>
    </div> : <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <StatCard label="Saldo em caixa" value={balance / 100} format={n => reais(n * 100)} icon={Wallet} tone="ink" hint="Entradas menos saídas" onClick={() => navigate({ view: 'finance' })}/>
      <StatCard label="Recebido no mês" value={receivedMonth / 100} format={n => reais(n * 100)} icon={HandCoins} tone="leaf" onClick={() => navigate({ view: 'finance', filter: 'sale-receipts' })}/>
      <StatCard label="A receber" value={toReceive / 100} format={n => reais(n * 100)} icon={Receipt} tone="sky" hint="Vendas e contas em aberto" onClick={() => navigate({ view: 'finance', filter: 'sale-receivables' })}/>
      <StatCard label="A pagar" value={toPay / 100} format={n => reais(n * 100)} icon={Receipt} tone="coral" hint="Compras e despesas em aberto" onClick={() => navigate({ view: 'finance', filter: 'overdue' })}/>
    </div>}

    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Nascimentos e vendas" subtitle="Compare a produção do criatório com a saída comercial"
        action={<SegmentedTabs size="sm" value={periodo} onChange={setPeriodo} options={[{ value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }, { value: '12m', label: '12 meses' }]}/>}>
        <div className="mb-3 flex gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-teal"/> Nascimentos</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sun"/> Vendas</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={periodo} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ left: -24, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gNasc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ui-teal)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--ui-teal)" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gVend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ui-sun)" stopOpacity={0.4}/><stop offset="100%" stopColor="var(--ui-sun)" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeDasharray="4 4"/>
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }} interval="preserveStartEnd"/>
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted-foreground)' }}/>
                <Tooltip content={<ChartTooltip/>} cursor={{ stroke: 'var(--ui-teal)', strokeDasharray: '4 4' }}/>
                <Area type="monotone" dataKey="nascimentos" name="Nascimentos" stroke="var(--ui-teal)" strokeWidth={2.5} fill="url(#gNasc)" animationDuration={900}/>
                <Area type="monotone" dataKey="vendas" name="Vendas" stroke="var(--ui-sun)" strokeWidth={2.5} fill="url(#gVend)" animationDuration={900}/>
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </Panel>

      <Panel title="Agenda de hoje" subtitle={tasks.length ? `${done} de ${tasks.length} tarefas concluídas` : 'Nenhuma tarefa para hoje'}
        action={<button type="button" onClick={() => navigate({ view: 'tasks', filter: 'pending' })} className="press rounded-lg px-2 py-1 text-xs font-bold text-teal hover:bg-tint-teal">Ver tudo</button>}>
        {tasks.length > 0 && <Meter value={(done / tasks.length) * 100} className="mb-4"/>}
        {tasks.length === 0 && <EmptyHint>Use o botão + para criar uma tarefa.</EmptyHint>}
        <ul className="flex flex-col gap-1.5">
          {tasks.slice(0, 6).map(t => <li key={t.id}>
            <div className="group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-secondary">
              <button type="button" aria-label={t.done ? 'Reabrir tarefa' : 'Concluir tarefa'} disabled={busyTask === t.id || !!t.resolvedAt} onClick={() => void toggle(t.id, !t.done)}>
                <motion.span animate={{ scale: t.done ? [1, 1.2, 1] : 1 }} className={cn('grid size-6 shrink-0 place-items-center rounded-lg ring-2 transition-colors duration-300', t.done ? 'bg-leaf text-ink-foreground ring-leaf' : 'ring-border group-hover:ring-teal')}>
                  <AnimatePresence>{t.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="size-3.5" strokeWidth={3}/></motion.span>}</AnimatePresence>
                </motion.span>
              </button>
              <button type="button" onClick={() => navigate({ view: 'tasks', taskId: t.id })} className="min-w-0 flex-1 text-left">
                <span className={cn('block truncate text-sm font-semibold transition-all', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.dueDate < iso ? `Vencida em ${dateLabel(t.dueDate)}` : t.reminderTime || 'Hoje'}{t.birdId ? ` · ${birdLabel(birds.find(b => b.id === t.birdId))}` : ''}</span>
              </button>
            </div>
          </li>)}
        </ul>
      </Panel>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Incubação" subtitle="Ninhos com ovos em acompanhamento">
        {ninhos.length === 0 && <EmptyHint>Nenhum ovo em incubação agora.</EmptyHint>}
        <div className="flex flex-col gap-4">
          {ninhos.map(c => <button type="button" key={c.id} onClick={() => navigate({ view: 'breeding', clutchId: c.id, pairId: c.pairId })} className="flex items-center gap-3 text-left">
            {c.bird ? <BirdPhoto bird={c.bird} photo={c.bird.photoId ? photos.get(c.bird.photoId) : undefined} size={40}/> : <span className="grid size-10 place-items-center rounded-2xl bg-tint-sun"><Egg className="size-4"/></span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold">{c.label}</span><span className="shrink-0 text-xs font-bold text-muted-foreground">dia {c.day}/{c.total}</span></div>
              <Meter value={(c.day / c.total) * 100} className="mt-2"/>
              <p className="mt-1 text-[11px] text-muted-foreground">{c.eggs} {c.eggs === 1 ? 'ovo' : 'ovos'}</p>
            </div>
          </button>)}
        </div>
      </Panel>

      <Panel title="Plantel por espécie" subtitle="Distribuição das aves presentes">
        {porEspecie.length === 0 && <EmptyHint>Nenhuma ave cadastrada.</EmptyHint>}
        <div className="flex flex-col gap-3">
          {porEspecie.map((e, i) => <motion.div key={e.name} variants={riseItem} className="flex items-center gap-3">
            <BirdPhoto bird={e.sample} size={36}/>
            <div className="flex-1">
              <div className="flex justify-between text-sm font-semibold">{e.name}<span className="text-muted-foreground">{e.n}</span></div>
              <Meter value={e.pct} className="mt-1.5 h-1.5" barClassName={['bg-primary', 'bg-sun', 'bg-leaf', 'bg-teal', 'bg-coral'][i]}/>
            </div>
          </motion.div>)}
        </div>
      </Panel>

      <Panel title="Últimos pedidos" action={<button type="button" onClick={() => navigate({ view: 'sales' })} className="press rounded-lg px-2 py-1 text-xs font-bold text-teal hover:bg-tint-teal">Comercial</button>}>
        {lastSales.length === 0 && <EmptyHint>Nenhuma venda ou reserva registrada.</EmptyHint>}
        <ul className="flex flex-col divide-y divide-border">
          {lastSales.map(p => {
            const contact = state.contacts.find(c => c.id === p.contactId);
            const birdItem = p.items.find(i => i.kind === 'ave' && i.refId);
            const bird = birdItem ? birds.find(b => b.id === birdItem.refId) : undefined;
            return <li key={p.id}>
              <button type="button" onClick={() => navigate({ view: 'sales', saleId: p.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
                {bird ? <BirdPhoto bird={bird} photo={bird.photoId ? photos.get(bird.photoId) : undefined} size={36}/> : <span className="grid size-9 place-items-center rounded-2xl bg-tint-leaf text-leaf"><Wallet className="size-4"/></span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{contact?.name ?? 'Sem contato'}</p><p className="text-xs text-muted-foreground">{p.number} · {dateLabel(p.date)}</p></div>
                <div className="text-right"><p className="text-sm font-bold">{money(p.totalCents)}</p><StatusBadge status={p.status} className="mt-0.5"/></div>
              </button>
            </li>;
          })}
        </ul>
      </Panel>
    </div>
  </Stagger>;
}
