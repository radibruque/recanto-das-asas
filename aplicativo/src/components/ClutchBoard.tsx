import { motion } from 'motion/react';
import { Baby, Egg as EggIcon, Plus, Sparkles } from 'lucide-react';
import type { Bird, Clutch, Egg, Pair, Scope, State } from '../domain/types';
import { dateLabel, today } from '../domain/shared';
import { BirdChip, BirdPhoto, Button, EmptyHint } from '../ui/bits';
import { Meter } from '../ui/motion';
import { cn } from '../ui/cn';

const days = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00Z').valueOf() - new Date(a + 'T12:00:00Z').valueOf()) / 86400000);
const eggTone: Record<string, string> = { incubando: 'bg-tint-sun text-foreground', eclodido: 'bg-tint-leaf text-leaf', infértil: 'bg-secondary text-muted-foreground', perdido: 'bg-tint-coral text-coral' };
const eggLabel = (e: Egg) => e.status === 'incubando' ? (e.fertility === 'fértil' ? 'Fértil · chocando' : e.fertility === 'infértil' ? 'Infértil' : 'Chocando') : e.status === 'eclodido' ? 'Eclodiu' : e.status;

/** Clutches as a compact header + square egg cards. */
export default function ClutchBoard({ state, scope, clutches, pairs, birds, eggs, onAddEgg, onCloseClutch, onEvaluate, onHatch, onOpenBird, onNewClutch }: {
  state: State; scope: Scope; clutches: Clutch[]; pairs: Pair[]; birds: Bird[]; eggs: Egg[];
  onAddEgg: (clutchId: string) => void; onCloseClutch: (c: Clutch) => void; onEvaluate: (e: Egg) => void; onHatch: (e: Egg) => void; onOpenBird: (id: string) => void; onNewClutch: () => void;
}) {
  const iso = today();
  const photo = (b?: Bird) => b?.photoId ? state.attachments.find(a => a.id === b.photoId && a.scope === scope) : undefined;
  if (!clutches.length) return <div className="ui"><EmptyHint>Nenhuma postura neste filtro. <button type="button" className="font-semibold text-teal" onClick={onNewClutch}>Registrar postura</button></EmptyHint></div>;
  return <div className="ui flex flex-col gap-5">
    {clutches.map(c => {
      const pair = pairs.find(p => p.id === c.pairId), male = birds.find(b => b.id === pair?.maleId), female = birds.find(b => b.id === pair?.femaleId);
      const list = eggs.filter(e => e.clutchId === c.id).sort((a, b) => a.number - b.number);
      return <section key={c.id} className="flex flex-col gap-3 rounded-3xl bg-card p-3.5 shadow-soft ring-1 ring-border/60 sm:p-4">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 -space-x-3">{[male, female].map((b, k) => b ? <BirdPhoto key={k} bird={b} photo={photo(b)} size={38} className="rounded-xl"/> : null)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{pair?.name ?? 'Casal'}</p>
              <p className="truncate text-xs text-muted-foreground">Postura de {dateLabel(c.startDate)} · {c.endDate ? 'encerrada' : 'aberta'} · {list.length} {list.length === 1 ? 'ovo' : 'ovos'}</p>
            </div>
          </div>
          {!c.endDate && <div className="flex items-center gap-1.5">
            <Button variant="brand" size="sm" onClick={() => onAddEgg(c.id)}><Plus/>Ovo</Button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => onCloseClutch(c)}>Encerrar</Button>
          </div>}
        </header>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {list.map((e, i) => {
            const start = e.incubationDate || e.laidDate, total = e.expectedHatchDate ? Math.max(1, days(start, e.expectedHatchDate)) : 0, day = Math.max(0, days(start, iso));
            return <motion.article key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.25) } }}
              className="flex aspect-square min-w-0 flex-col rounded-2xl bg-background p-3 ring-1 ring-border/70">
              <div className="flex items-start justify-between gap-2">
                <span className={cn('grid size-10 place-items-center rounded-2xl', eggTone[e.status] ?? 'bg-secondary')}>{e.status === 'eclodido' ? <Baby className="size-5"/> : <EggIcon className="size-5"/>}</span>
                <span className="font-display text-xl font-semibold">{e.number}</span>
              </div>
              <p className="mt-2 truncate text-xs font-bold capitalize">{eggLabel(e)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Postura {dateLabel(e.laidDate)}</p>
              <div className="mt-auto flex flex-col gap-1.5">
                {e.status === 'incubando' && total > 0 && <><p className="text-[11px] font-semibold text-muted-foreground">dia {Math.min(day, total)} de {total}</p><Meter value={(day / total) * 100} className="h-1.5" barClassName={day >= total - 1 ? 'bg-sun' : undefined}/></>}
                {e.status === 'incubando' && !total && <p className="truncate text-[11px] text-muted-foreground">Previsão não informada</p>}
                {e.chickId && <BirdChip state={state} scope={scope} birdId={e.chickId} size={26} onClick={() => onOpenBird(e.chickId!)} sub={`Eclodiu ${dateLabel(e.hatchDate)}`}/>}
                {!c.endDate && e.status === 'incubando' && <div className="flex gap-1">
                  <button type="button" onClick={() => onEvaluate(e)} className="press h-7 flex-1 rounded-lg bg-secondary text-[11px] font-bold">Avaliar</button>
                  <button type="button" onClick={() => onHatch(e)} className="press inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-brand text-[11px] font-bold text-primary-foreground"><Sparkles className="size-3"/>Eclodiu</button>
                </div>}
                {!c.endDate && e.status !== 'incubando' && !e.chickId && <button type="button" onClick={() => onEvaluate(e)} className="press h-7 rounded-lg bg-secondary text-[11px] font-bold">Editar</button>}
              </div>
            </motion.article>;
          })}
          {!c.endDate && <button type="button" onClick={() => onAddEgg(c.id)} className="press grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-teal hover:text-teal">
            <span className="flex flex-col items-center gap-1.5"><Plus className="size-5"/>Registrar ovo</span>
          </button>}
        </div>
        {!c.endDate && <Button variant="ghost" size="sm" className="self-end sm:hidden" onClick={() => onCloseClutch(c)}>Encerrar postura</Button>}
      </section>;
    })}
  </div>;
}
