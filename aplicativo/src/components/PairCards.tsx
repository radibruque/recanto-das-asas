import { motion } from 'motion/react';
import { Baby, Egg as EggIcon, Heart, ListOrdered, Plus, Power } from 'lucide-react';
import type { Bird, Clutch, Egg, Pair, Scope, State } from '../domain/types';
import { dateLabel } from '../domain/shared';
import { BirdPhoto, Button, EmptyHint } from '../ui/bits';
import { cn } from '../ui/cn';

/** Pairs as square cards (like Aves): both birds' photos, simple numbers, two actions. */
export default function PairCards({ state, scope, pairs, birds, clutches, eggs, onNewClutch, onClutches, onClose, onOpenBird, onCreate }: {
  state: State; scope: Scope; pairs: Pair[]; birds: Bird[]; clutches: Clutch[]; eggs: Egg[];
  onNewClutch: (pairId: string) => void; onClutches: (pairId: string) => void; onClose: (pair: Pair) => void; onOpenBird: (birdId: string) => void; onCreate: () => void;
}) {
  const photo = (b?: Bird) => b?.photoId ? state.attachments.find(a => a.id === b.photoId && a.scope === scope) : undefined;
  if (!pairs.length) return <div className="ui"><EmptyHint>Nenhum casal registrado. <button type="button" className="font-semibold text-teal" onClick={onCreate}>Formar o primeiro casal</button></EmptyHint></div>;
  return <div className="ui grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
    {pairs.map((p, i) => {
      const male = birds.find(b => b.id === p.maleId), female = birds.find(b => b.id === p.femaleId);
      const own = clutches.filter(c => c.pairId === p.id), ownEggs = eggs.filter(e => own.some(c => c.id === e.clutchId));
      const incubating = ownEggs.filter(e => e.status === 'incubando').length, hatched = ownEggs.filter(e => e.status === 'eclodido').length;
      const open = own.some(c => !c.endDate);
      return <motion.article key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, transition: { delay: Math.min(i * 0.03, 0.3) } }} whileHover={{ y: -4 }}
        className="group flex flex-col overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border/60 transition-shadow hover:shadow-float">
        <button type="button" onClick={() => onClutches(p.id)} aria-label={`Ver posturas de ${p.name}`} className="relative grid aspect-[4/3] grid-cols-2 overflow-hidden bg-tint-sky">
          {[male, female].map((b, k) => <span key={k} className="relative overflow-hidden">
            {b ? <span className="block size-full transition-transform duration-700 group-hover:scale-110"><BirdPhoto bird={b} photo={photo(b)} fill className="object-[50%_20%]"/></span> : <span className="grid size-full place-items-center text-xs text-muted-foreground">—</span>}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[11px] font-bold text-ink-foreground">
              <span className={cn('mr-1', k === 0 ? 'text-sky' : 'text-coral')}>{k === 0 ? '♂' : '♀'}</span>{b ? (b.name || b.identification) : 'Não encontrada'}
            </span>
          </span>)}
          <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card shadow-float ring-2 ring-card"><Heart className="size-4 fill-coral text-coral"/></span>
          <span className={cn('absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur', p.endDate ? 'bg-card/90 text-muted-foreground' : 'bg-tint-leaf/95 text-leaf')}>{p.endDate ? 'Encerrado' : open ? 'Em postura' : 'Ativo'}</span>
        </button>
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">Desde {dateLabel(p.startDate)}{p.enclosure ? ` · ${p.enclosure}` : ''}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <button type="button" onClick={() => onClutches(p.id)} title={`${own.length} ${own.length === 1 ? 'postura' : 'posturas'}`} className="press inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-secondary px-2 py-1 hover:bg-tint-sky"><ListOrdered className="size-3"/>{own.length}<span className="hidden min-[480px]:inline">{own.length === 1 ? ' postura' : ' posturas'}</span></button>
            {incubating > 0 && <span title="Ovos chocando" className="inline-flex items-center gap-1 rounded-lg bg-tint-sun px-2 py-1"><EggIcon className="size-3"/>{incubating}</span>}
            {hatched > 0 && <span title="Filhotes nascidos" className="inline-flex items-center gap-1 rounded-lg bg-tint-leaf px-2 py-1 text-leaf"><Baby className="size-3"/>{hatched}</span>}
            {!p.endDate && <button type="button" onClick={() => onClose(p)} title="Encerrar casal" aria-label={`Encerrar casal ${p.name}`} className="press ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-tint-coral hover:text-coral"><Power className="size-3.5"/></button>}
          </div>
          <div className="mt-auto">
            {p.endDate ? <Button variant="secondary" size="sm" className="w-full" onClick={() => onClutches(p.id)}><ListOrdered/>Ver posturas</Button>
              : open ? <Button variant="secondary" size="sm" className="w-full" onClick={() => onClutches(p.id)}><EggIcon/>Ver postura aberta</Button>
              : <Button variant="brand" size="sm" className="w-full" onClick={() => onNewClutch(p.id)}><Plus/>Nova postura</Button>}
          </div>
          {(male || female) && <div className="sr-only">{[male, female].filter(Boolean).map(b => <button key={b!.id} type="button" onClick={() => onOpenBird(b!.id)}>Abrir ficha de {b!.name || b!.identification}</button>)}</div>}
        </div>
      </motion.article>;
    })}
  </div>;
}
