import { Plus, X } from 'lucide-react';
import type { Bird } from '../domain/types';
import { Button, PillSelect, SegmentedTabs, shortSpecies } from '../ui/bits';

export type Population = 'present' | 'available' | 'reserved' | 'history' | 'all';

const uniq = (list: string[]) => [...new Set(list.map(v => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Simple bird filter: where the bird is (tabs) + 4 essential pills. */
export default function BirdFilters({ birds, population, onPopulation, species, onSpecies, sex, onSex, mutation, onMutation, enclosure, onEnclosure, onClear, hasExtra, shown, total, onCreate }: {
  birds: Bird[]; population: Population; onPopulation: (p: Population) => void;
  species: string; onSpecies: (v: string) => void; sex: string; onSex: (v: string) => void;
  mutation: string; onMutation: (v: string) => void; enclosure: string; onEnclosure: (v: string) => void;
  onClear: () => void; hasExtra: boolean; shown: number; total: number; onCreate: () => void;
}) {
  const enclosures = uniq(birds.map(b => b.enclosure));
  const active = !!(species || sex || mutation || enclosure || hasExtra);
  return <div className="ui flex flex-col gap-3">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <SegmentedTabs size="sm" value={population} onChange={onPopulation} className="max-w-full"
        options={[{ value: 'present', label: 'No plantel' }, { value: 'available', label: 'Disponíveis' }, { value: 'reserved', label: 'Reservadas' }, { value: 'history', label: 'Fora do plantel' }, { value: 'all', label: 'Todas' }]}/>
      <Button variant="brand" size="sm" onClick={onCreate} className="h-9"><Plus/><span className="hidden sm:inline">Cadastrar ave</span><span className="sm:hidden">Nova</span></Button>
    </div>
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <PillSelect label="Espécie" value={species} onChange={onSpecies} options={uniq(birds.map(b => b.species)).map(s => ({ value: s, label: shortSpecies(s) }))}/>
      <PillSelect label="Sexo" value={sex} onChange={onSex} options={[{ value: 'macho', label: 'Macho' }, { value: 'fêmea', label: 'Fêmea' }, { value: 'indeterminado', label: 'Indefinido' }]}/>
      <PillSelect label="Mutação" value={mutation} onChange={onMutation} options={uniq(birds.map(b => b.mutation)).map(m => ({ value: m, label: m }))}/>
      {enclosures.length > 0 && <PillSelect label="Recinto" value={enclosure} onChange={onEnclosure} options={enclosures.map(e => ({ value: e, label: e }))}/>}
      {active && <button type="button" onClick={onClear} className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-coral hover:bg-tint-coral"><X className="size-3.5"/>Limpar</button>}
    </div>
  </div>;
}
