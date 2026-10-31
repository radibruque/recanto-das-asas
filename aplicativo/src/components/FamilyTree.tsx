import { motion } from 'motion/react';
import type { Attachment, Bird } from '../domain/types';
import { BirdPhoto, shortSpecies } from '../ui/bits';
import { cn } from '../ui/cn';

type Props = { bird: Bird; birds: Bird[]; photos: Map<string, Attachment>; onOpen: (id: string) => void };

function Node({ bird, label, photos, onOpen, delay, main = false }: { bird?: Bird; label: string; photos: Map<string, Attachment>; onOpen: (id: string) => void; delay: number; main?: boolean }) {
  return <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }} className="min-w-0">
    {bird ? <button type="button" onClick={() => onOpen(bird.id)} className={cn('press flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left ring-1', main ? 'bg-ink text-ink-foreground ring-ink shadow-float' : 'bg-card ring-border shadow-soft')}>
      <BirdPhoto bird={bird} photo={bird.photoId ? photos.get(bird.photoId) : undefined} size={main ? 48 : 38}/>
      <span className="min-w-0">
        <span className={cn('block text-[10px] font-bold uppercase tracking-widest', main ? 'text-sun' : 'text-teal')}>{label}</span>
        <span className="block truncate text-sm font-semibold">{bird.name || bird.identification}</span>
        <span className={cn('block truncate text-[11px]', main ? 'text-ink-muted' : 'text-muted-foreground')}>{bird.identification} · {shortSpecies(bird.species)}</span>
      </span>
    </button> : <div className="flex h-full min-h-[62px] flex-col justify-center rounded-2xl border border-dashed border-border px-3 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">Não informado</span>
    </div>}
  </motion.div>;
}

/** Bird → parents → grandparents, appearing in sequence. Gaps mean unknown information. */
export default function FamilyTree({ bird, birds, photos, onOpen }: Props) {
  const find = (id: string | null | undefined) => id ? birds.find(b => b.id === id) : undefined;
  const father = find(bird.fatherId), mother = find(bird.motherId);
  return <div className="ui flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Node label="Avô paterno" bird={find(father?.fatherId)} photos={photos} onOpen={onOpen} delay={0.35}/>
      <Node label="Avó paterna" bird={find(father?.motherId)} photos={photos} onOpen={onOpen} delay={0.4}/>
      <Node label="Avô materno" bird={find(mother?.fatherId)} photos={photos} onOpen={onOpen} delay={0.45}/>
      <Node label="Avó materna" bird={find(mother?.motherId)} photos={photos} onOpen={onOpen} delay={0.5}/>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Node label="Pai" bird={father} photos={photos} onOpen={onOpen} delay={0.18}/>
      <Node label="Mãe" bird={mother} photos={photos} onOpen={onOpen} delay={0.24}/>
    </div>
    <div className="mx-auto w-full max-w-sm"><Node label="Esta ave" bird={bird} photos={photos} onOpen={onOpen} delay={0} main/></div>
  </div>;
}
