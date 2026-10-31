import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Attachment, Bird } from '../domain/types';
import { dateLabel } from '../domain/shared';
import type { DigitalBookletFields } from '../lib/booklet';
import { tutorBookletSections } from '../lib/booklet-fold';
import { BirdPhoto } from '../ui/bits';
import { cn } from '../ui/cn';

const label = (key: string, value: string) => tutorBookletSections.flatMap(s => s.fields).find(f => f.key === key)?.options?.find(o => o.value === value)?.label ?? value;
const v = (f: DigitalBookletFields, key: string, date = false) => { const x = (f[key] ?? '').trim(); if (!x) return '—'; return date && /^\d{4}-\d{2}-\d{2}$/.test(x) ? dateLabel(x) : label(key, x); };

function Row({ title, value, wide }: { title: string; value: string; wide?: boolean }) {
  return <div className={cn('rounded-xl bg-secondary px-3 py-2', wide && 'col-span-2')}>
    <p className="text-[9px] font-bold uppercase tracking-widest text-teal">{title}</p>
    <p className="whitespace-pre-line text-xs font-semibold">{value}</p>
  </div>;
}

/** Live preview of the folded booklet: turn the pages like the printed one. */
export default function BookletPreview({ bird, photo, fields, organization }: { bird: Bird; photo?: Attachment; fields: DigitalBookletFields; organization: string }) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (n: number) => { setDir(n > page ? 1 : -1); setPage(n); };
  const pages = [
    { title: 'Capa', body: <div className="flex h-full flex-col items-center justify-between rounded-2xl bg-feather p-5 text-center text-ink-foreground">
      <img src="/brand/logo-vertical-branco.svg" alt="Recanto das Asas" className="h-20 w-auto"/>
      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sun">Caderneta do pet</p>
        <BirdPhoto bird={bird} photo={photo} size={110} className="rounded-3xl ring-4 ring-ink-foreground/20"/>
        <p className="font-display text-2xl font-semibold">{v(fields, 'bird_name')}</p>
        <p className="text-xs text-ink-muted">{v(fields, 'bird_species')}</p>
      </div>
      <p className="text-[11px] text-ink-muted">Anilha {v(fields, 'bird_ring')} · {organization}</p>
    </div> },
    { title: 'Identificação', body: <div className="grid grid-cols-2 gap-2">
      <Row title="Nome" value={v(fields, 'bird_name')}/><Row title="Anilha" value={v(fields, 'bird_ring')}/>
      <Row title="Espécie" value={v(fields, 'bird_species')} wide/>
      <Row title="Nascimento" value={`${v(fields, 'birth_date', true)} (${v(fields, 'birth_information').toLowerCase()})`}/><Row title="Sexo" value={v(fields, 'sex_information')}/>
      <Row title="Cor / mutação" value={v(fields, 'bird_mutation')}/><Row title="Microchip" value={v(fields, 'bird_microchip')}/>
      <Row title="Marcas particulares" value={v(fields, 'visual_marks')} wide/>
    </div> },
    { title: 'Cuidados e saúde', body: <div className="grid grid-cols-2 gap-2">
      <Row title="Criação" value={v(fields, 'rearing_information')}/>
      <Row title="Pesagens" value={[1, 2, 3].map(n => fields[`weight_${n}_weight`] ? `${v(fields, `weight_${n}_date`, true)}: ${fields[`weight_${n}_weight`]} g` : '').filter(Boolean).join('\n') || '—'}/>
      <Row title="Alimentação e rotina" value={v(fields, 'current_diet')} wide/>
      <Row title="Recomendações ao tutor" value={v(fields, 'management_history')} wide/>
      <Row title="Observações de saúde" value={v(fields, 'medical_observations')} wide/>
    </div> },
    { title: 'Entrega e contatos', body: <div className="grid grid-cols-2 gap-2">
      <Row title="Entrega" value={v(fields, 'delivery_date', true)}/><Row title="Peso na entrega" value={fields.delivery_weight ? `${fields.delivery_weight} g` : '—'}/>
      <Row title="Tutor(a)" value={v(fields, 'tutor_name')}/><Row title="Telefone" value={v(fields, 'tutor_phone')}/>
      <Row title="Criatório" value={`${v(fields, 'breeder_name')}\n${v(fields, 'breeder_phone')}`}/><Row title="Veterinário(a)" value={`${v(fields, 'vet_identity')}\n${v(fields, 'vet_emergency_phone')}`}/>
      <Row title="Pais" value={`Pai: ${v(fields, 'father_identity')}\nMãe: ${v(fields, 'mother_identity')}`} wide/>
    </div> },
  ];
  return <div className="ui flex flex-col items-center gap-3">
    <div className="relative w-full max-w-sm [perspective:1400px]">
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={page} custom={dir}
          initial={{ rotateY: dir > 0 ? 70 : -70, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: dir > 0 ? -70 : 70, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} style={{ transformOrigin: dir > 0 ? 'left center' : 'right center' }}
          className="aspect-[1/1.41] w-full overflow-hidden rounded-3xl bg-card p-4 shadow-float ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{pages[page]!.title}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{page + 1}/4</span>
          </div>
          <div className="h-[calc(100%-2rem)] overflow-y-auto">{pages[page]!.body}</div>
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => go(page - 1)} className="press grid size-10 place-items-center rounded-xl bg-secondary"><ChevronLeft className="size-4"/></button>
      <div className="flex gap-1.5">{pages.map((p, i) => <button type="button" key={p.title} aria-label={p.title} onClick={() => go(i)} className={cn('h-2 rounded-full transition-all', i === page ? 'w-6 bg-ink' : 'w-2 bg-border')}/>)}</div>
      <button type="button" aria-label="Próxima página" disabled={page === 3} onClick={() => go(page + 1)} className="press grid size-10 place-items-center rounded-xl bg-secondary"><ChevronRight className="size-4"/></button>
    </div>
  </div>;
}
