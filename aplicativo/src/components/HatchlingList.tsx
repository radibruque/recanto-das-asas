import { useMemo } from 'react';
import type { ModuleProps } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import BirdCollection from './BirdCollection';
import { useUiState } from '../lib/ui-context';

export default function HatchlingList({ state, scope, search, onOpen, navigate, uiContext }: ModuleProps & { onOpen: (birdId: string) => void }) {
  const [presentOnly, setPresentOnly] = useUiState<boolean>(uiContext,'hatchlings.presentOnly',true);
  const birds = useMemo(() => state.birds.filter(bird => bird.scope === scope), [state.birds, scope]);
  const eggs = useMemo(() => state.eggs.filter(egg => egg.scope === scope && egg.chickId), [state.eggs, scope]);
  const hatchlingIds = useMemo(() => new Set(eggs.map(egg => egg.chickId)), [eggs]);
  const records = birds.filter(bird => (hatchlingIds.has(bird.id) || bird.status === 'filhote' || bird.statusHistory.some(entry => entry.status === 'filhote')) && (!presentOnly || !['vendido', 'doado', 'transferido', 'falecido'].includes(bird.status)) && `${birdLabel(bird)} ${bird.species} ${bird.mutation}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section className="hatchling-list">
    <div className="toolbar quick-filters" aria-label="Filtros de filhotes"><button className="button secondary" aria-pressed={presentOnly} onClick={() => setPresentOnly(true)}>Presentes</button><button className="button secondary" aria-pressed={!presentOnly} onClick={() => setPresentOnly(false)}>Histórico completo</button></div>
    <p className="muted">Filhotes vinculados às eclosões e aves cadastradas com situação filhote. Os cadastros e vínculos são os mesmos do plantel.</p>
    <BirdCollection birds={records} state={state} scope={scope} onOpen={onOpen}/>
    {records.some(bird => hatchlingIds.has(bird.id)) && <details className="card record-subsection"><summary>Origem nas posturas</summary>{records.map(bird => { const egg = eggs.find(record => record.chickId === bird.id); if (!egg) return null; const clutch = state.clutches.find(record => record.scope === scope && record.id === egg.clutchId), pair = state.pairs.find(record => record.scope === scope && record.id === clutch?.pairId); return <div className="hatchling-origin" key={bird.id}><strong>{birdLabel(bird)}</strong><span>{dateLabel(egg.hatchDate)} · {pair?.name || 'Casal'} · Ovo {egg.number}</span><button className="button secondary" onClick={() => navigate?.({ view: 'breeding', clutchId: egg.clutchId })}>Abrir postura</button></div>; })}</details>}
  </section>;
}
