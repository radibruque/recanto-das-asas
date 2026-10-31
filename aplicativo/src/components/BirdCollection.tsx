import { AnimatePresence, motion } from 'motion/react';
import { Bird as BirdIcon, LayoutGrid, List, Mars, Plus, Venus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Bird, Scope, State } from '../domain/types';
import { money } from '../domain/shared';
import { BirdPhoto, Button, SegmentedTabs, StatusBadge, shortSpecies } from '../ui/bits';
import { cn } from '../ui/cn';

type BirdCollectionProps = {
  birds: Bird[];
  state: State;
  scope: Scope;
  onOpen: (birdId: string) => void;
  variant?: 'compact' | 'full';
  onCreate?: () => void;
};

const VIEW_KEY = 'recanto.ui.birds-view';

/** Price shown on the card: the asking price, or the value of the bird's current sale/reservation. */
export function birdPrice(state: State, scope: Scope, bird: Bird): number | null {
  if (bird.priceCents) return bird.priceCents;
  const sale = state.sales.filter(s => s.scope === scope && !['cancelada', 'devolvida'].includes(s.status) && s.items.some(i => i.kind === 'ave' && i.refId === bird.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const item = sale?.items.find(i => i.kind === 'ave' && i.refId === bird.id);
  return item ? item.unitCents : null;
}

/** Plantel as photo cards (like the presentation) or as a compact list. Selection opens the bird record. */
export default function BirdCollection({ birds, state, scope, onOpen, variant = 'full', onCreate }: BirdCollectionProps) {
  const photos = useMemo(() => new Map(state.attachments.filter(file => file.scope === scope && file.mime.startsWith('image/')).map(file => [file.id, file])), [state.attachments, scope]);
  const [mode, setMode] = useState<'grade' | 'lista'>(() => { try { return (localStorage.getItem(VIEW_KEY) as 'grade' | 'lista') || 'grade'; } catch { return 'grade'; } });
  const changeMode = (m: 'grade' | 'lista') => { setMode(m); try { localStorage.setItem(VIEW_KEY, m); } catch { /* session only */ } };
  const shown = variant === 'compact' ? 'lista' : mode;

  if (!birds.length) return <div className="ui flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
    <BirdIcon className="size-8 text-teal"/>
    <p>Nenhuma ave encontrada neste espaço.</p>
    {onCreate && <Button onClick={onCreate}><Plus/>Cadastrar ave</Button>}
  </div>;

  return <div className="ui flex flex-col gap-4">
    {variant === 'full' && <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{birds.length} {birds.length === 1 ? 'ave' : 'aves'}</p>
      <SegmentedTabs size="sm" value={mode} onChange={changeMode} options={[{ value: 'grade', label: 'Cartões', icon: LayoutGrid }, { value: 'lista', label: 'Lista', icon: List }]}/>
    </div>}
    <motion.div layout className={cn('grid gap-3', shown === 'grade' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 md:gap-4' : 'grid-cols-1 lg:grid-cols-2')}>
      <AnimatePresence mode="popLayout">
        {birds.map((bird, i) => {
          const photo = bird.photoId ? photos.get(bird.photoId) : undefined;
          const price = birdPrice(state, scope, bird);
          const male = bird.sex === 'macho', female = bird.sex === 'fêmea';
          return shown === 'grade' ? <motion.button type="button" layout key={bird.id + shown}
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1, transition: { delay: Math.min(i * 0.025, 0.3) } }} exit={{ opacity: 0, scale: 0.94 }} whileHover={{ y: -4 }}
            onClick={() => onOpen(bird.id)} aria-label={`Abrir ficha de ${bird.name || bird.identification}`}
            className="group overflow-hidden rounded-3xl bg-card text-left shadow-soft ring-1 ring-border/60 transition-shadow hover:shadow-float">
            <div className="relative aspect-[4/3] overflow-hidden bg-tint-sky">
              <div className="size-full transition-transform duration-700 group-hover:scale-110"><BirdPhoto bird={bird} photo={photo} fill className="object-[50%_20%]"/></div>
              <StatusBadge status={bird.status} className="absolute left-2.5 top-2.5 bg-card/90 backdrop-blur"/>
              {(male || female) && <span className={cn('absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full backdrop-blur', male ? 'bg-tint-sky/90 text-primary' : 'bg-tint-coral/90 text-coral')}>
                {male ? <Mars className="size-3.5"/> : <Venus className="size-3.5"/>}
              </span>}
            </div>
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-lg font-semibold">{bird.name || bird.identification}</p>
                {bird.enclosure && <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{bird.enclosure}</span>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{shortSpecies(bird.species)} · {bird.mutation}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="truncate rounded-lg bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary-foreground">{bird.identification}</span>
                {price !== null ? <span className="shrink-0 text-sm font-bold text-primary">{money(price)}</span> : <span className="shrink-0 text-[11px] text-muted-foreground">Sem preço</span>}
              </div>
            </div>
          </motion.button> : <motion.button type="button" layout key={bird.id + shown}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.02, 0.25) } }} exit={{ opacity: 0, x: 10 }}
            onClick={() => onOpen(bird.id)} aria-label={`Abrir ficha de ${bird.name || bird.identification}`}
            className="press flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60">
            <BirdPhoto bird={bird} photo={photo} size={48}/>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{bird.name || bird.identification} <span className="text-xs font-medium text-muted-foreground">{male ? '♂' : female ? '♀' : ''} · {bird.mutation}</span></p>
              <p className="truncate font-mono text-xs text-muted-foreground">{bird.identification}{bird.enclosure ? ' · ' + bird.enclosure : ''}</p>
            </div>
            {price !== null && <span className="hidden text-sm font-bold text-primary sm:block">{money(price)}</span>}
            <StatusBadge status={bird.status}/>
          </motion.button>;
        })}
      </AnimatePresence>
    </motion.div>
  </div>;
}
