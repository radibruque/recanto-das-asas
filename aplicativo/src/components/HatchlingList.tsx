import { useMemo } from 'react';
import type { ModuleProps } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import BirdCollection from './BirdCollection';
import { useUiState } from '../lib/ui-context';
import { SegmentedTabs } from '../ui/bits';

/** Berçário: chicks as the same photo cards as Aves, with the clutch they came from. */
export default function HatchlingList({ state, scope, search, onOpen, uiContext }: ModuleProps & { onOpen: (birdId: string) => void }) {
  const [presentOnly, setPresentOnly] = useUiState<boolean>(uiContext, 'hatchlings.presentOnly', true);
  const birds = useMemo(() => state.birds.filter(bird => bird.scope === scope), [state.birds, scope]);
  const eggs = useMemo(() => state.eggs.filter(egg => egg.scope === scope && egg.chickId), [state.eggs, scope]);
  const hatchlingIds = useMemo(() => new Set(eggs.map(egg => egg.chickId)), [eggs]);
  const records = birds.filter(bird => (hatchlingIds.has(bird.id) || bird.status === 'filhote' || bird.statusHistory.some(entry => entry.status === 'filhote')) && (!presentOnly || !['vendido', 'doado', 'transferido', 'falecido'].includes(bird.status)) && `${birdLabel(bird)} ${bird.species} ${bird.mutation}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const origin = (birdId: string) => {
    const egg = eggs.find(e => e.chickId === birdId); if (!egg) return undefined;
    const clutch = state.clutches.find(c => c.scope === scope && c.id === egg.clutchId), pair = state.pairs.find(p => p.scope === scope && p.id === clutch?.pairId);
    return `${pair?.name ?? 'Casal'} · ovo ${egg.number} · ${dateLabel(egg.hatchDate)}`;
  };
  return <section className="ui flex flex-col gap-3">
    <SegmentedTabs size="sm" value={presentOnly ? 'present' : 'all'} onChange={v => setPresentOnly(v === 'present')} options={[{ value: 'present', label: 'No berçário' }, { value: 'all', label: 'Todos os filhotes' }]}/>
    <BirdCollection birds={records} state={state} scope={scope} onOpen={onOpen} caption={b => origin(b.id)}/>
  </section>;
}
