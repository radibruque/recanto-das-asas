import { AnimatePresence, motion } from 'motion/react';
import { Bird as BirdIcon, Package, Plus, Save, Trash2, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ModuleProps, PriceEntry } from '../domain/types';
import { money, moneyInput, parseMoney } from '../domain/shared';
import { birdTablePrice, priceEntries } from '../domain/prices';
import { Button, EmptyHint, SegmentedTabs, shortSpecies } from '../ui/bits';
import { cn } from '../ui/cn';

type Row = { key: string; kind: PriceEntry['kind']; species: string; mutation: string; sex: PriceEntry['sex']; productId: string; name: string; price: string };
const field = 'h-10 py-2.5 w-full min-w-0 rounded-xl bg-secondary px-3 text-sm outline-none focus:ring-2 focus:ring-teal/40 [&>option]:bg-card [&>option]:text-foreground';
let seq = 0;

/** Tabela de preços: base for every price field (sale items, bird cards). */
export default function Prices({ state, scope, command, notify }: Pick<ModuleProps, 'state' | 'scope' | 'command' | 'notify'>) {
  const initial = useMemo(() => priceEntries(state, scope).map<Row>(e => ({ key: e.id, kind: e.kind, species: e.species, mutation: e.mutation, sex: e.sex, productId: e.productId ?? '', name: e.name, price: moneyInput(e.priceCents) })), [state.settings.priceTable, scope]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [tab, setTab] = useState<PriceEntry['kind']>('ave');
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const birds = state.birds.filter(b => b.scope === scope);
  const products = state.products.filter(p => p.scope === scope);
  const speciesNames = [...new Set([...state.settings.speciesCatalog.filter(s => s.active).map(s => s.name), ...birds.map(b => b.species)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const mutations = [...new Set(birds.map(b => b.mutation).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const set = (key: string, patch: Partial<Row>) => setRows(list => list.map(r => r.key === key ? { ...r, ...patch } : r));
  const add = () => setRows(list => [...list, { key: `new-${++seq}`, kind: tab, species: tab === 'ave' ? speciesNames[0] ?? '' : '', mutation: '', sex: '', productId: '', name: '', price: '' }]);
  const shown = rows.filter(r => r.kind === tab);

  async function save() {
    setBusy(true);
    try {
      const entries = rows.map(r => ({ id: r.key.startsWith('new-') ? undefined : r.key, kind: r.kind, species: r.species, mutation: r.mutation, sex: '' as const, productId: r.productId || null, name: r.name, priceCents: parseMoney(r.price || '0') }));
      await command('prices.save', { entries });
      notify('Tabela de preços salva.');
    } catch (e) { notify(e instanceof Error ? e.message : 'Não foi possível salvar a tabela.'); } finally { setBusy(false); }
  }
  /** How many birds of the plantel currently take their price from this line. */
  const coverage = (r: Row) => {
    if (r.kind !== 'ave' || !r.species) return 0;
    const cents = parseMoney(r.price || '0');
    return birds.filter(b => !['vendido', 'doado', 'transferido', 'falecido'].includes(b.status) && !b.priceCents && b.species === r.species && (!r.mutation || b.mutation.toLocaleLowerCase('pt-BR') === r.mutation.toLocaleLowerCase('pt-BR')) && birdTablePrice(state, scope, b) === cents).length;
  };

  return <div className="ui flex flex-col gap-4">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <SegmentedTabs size="sm" value={tab} onChange={setTab} options={[{ value: 'ave', label: 'Aves', icon: BirdIcon, count: rows.filter(r => r.kind === 'ave').length }, { value: 'produto', label: 'Produtos', icon: Package, count: rows.filter(r => r.kind === 'produto').length }, { value: 'serviço', label: 'Serviços', icon: Wrench, count: rows.filter(r => r.kind === 'serviço').length }]}/>
      <Button variant="brand" size="sm" className="h-9" disabled={!dirty || busy} onClick={save}><Save/>{busy ? 'Salvando…' : 'Salvar'}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{tab === 'ave' ? 'Preço de mercado por espécie e mutação. Deixe a mutação em branco para valer para todas as mutações da espécie. Um preço digitado na ficha da ave vale mais que a tabela.' : tab === 'produto' ? 'Preço de venda de cada produto do estoque.' : 'Serviços que você cobra (hospedagem, frete, sexagem…).'}</p>
    {!shown.length && <EmptyHint>Nenhum preço de {tab === 'ave' ? 'ave' : tab} ainda.</EmptyHint>}
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {shown.map(r => <motion.li key={r.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
          className="grid items-end gap-2 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px_auto]">
          {r.kind === 'ave' && <>
            <label className="flex min-w-0 flex-col gap-1"><span className="text-[11px] font-semibold text-muted-foreground">Espécie</span>
              <select value={r.species} onChange={e => set(r.key, { species: e.target.value })} className={field}><option value="">Selecione</option>{speciesNames.map(s => <option key={s} value={s}>{shortSpecies(s)}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-1"><span className="text-[11px] font-semibold text-muted-foreground">Mutação</span>
              <input value={r.mutation} onChange={e => set(r.key, { mutation: e.target.value })} list="price-mutations" placeholder="Todas as mutações" className={field}/></label>
          </>}
          {r.kind === 'produto' && <label className="flex min-w-0 flex-col gap-1 sm:col-span-2"><span className="text-[11px] font-semibold text-muted-foreground">Produto</span>
            <select value={r.productId} onChange={e => set(r.key, { productId: e.target.value })} className={field}><option value="">Selecione</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}{p.lot ? ` · lote ${p.lot}` : ''} ({p.unit})</option>)}</select></label>}
          {r.kind === 'serviço' && <label className="flex min-w-0 flex-col gap-1 sm:col-span-2"><span className="text-[11px] font-semibold text-muted-foreground">Serviço</span>
            <input value={r.name} onChange={e => set(r.key, { name: e.target.value })} placeholder="Ex.: hospedagem por dia" className={field} maxLength={150}/></label>}
          <label className="flex min-w-0 flex-col gap-1"><span className="text-[11px] font-semibold text-muted-foreground">Preço (R$)</span>
            <input inputMode="decimal" value={r.price} onChange={e => set(r.key, { price: e.target.value })} placeholder="0,00" className={cn(field, 'font-bold tabular-nums')}/></label>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {r.kind === 'ave' && <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">{coverage(r)} aves usam</span>}
            <button type="button" onClick={() => setRows(list => list.filter(x => x.key !== r.key))} aria-label="Remover preço" className="press grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-tint-coral hover:text-coral"><Trash2 className="size-4"/></button>
          </div>
        </motion.li>)}
      </AnimatePresence>
    </ul>
    <datalist id="price-mutations">{mutations.map(m => <option key={m} value={m}/>)}</datalist>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={add} disabled={tab === 'produto' && !products.length}><Plus/>Adicionar preço</Button>
      {tab === 'produto' && !products.length && <span className="text-xs text-muted-foreground">Cadastre produtos em Caixa e materiais.</span>}
      {dirty && <span className="text-xs font-semibold text-sun">Alterações não salvas</span>}
      {tab === 'ave' && shown.length > 0 && <span className="ml-auto text-xs text-muted-foreground">Faixa: {money(Math.min(...shown.map(r => parseMoney(r.price || '0'))))} a {money(Math.max(...shown.map(r => parseMoney(r.price || '0'))))}</span>}
    </div>
  </div>;
}
