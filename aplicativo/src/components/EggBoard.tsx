import type { ReactNode } from 'react';
import type { Egg } from '../domain/types';
import { dateLabel } from '../domain/shared';

export default function EggBoard({ eggs, closed, onEvaluate, onHatch, birdLink }: { eggs: Egg[]; closed: boolean; onEvaluate: (egg: Egg) => void; onHatch: (egg: Egg) => void; birdLink: (id: string | null) => ReactNode }) {
  if (!eggs.length) return <p className="empty muted">Nenhum ovo registrado nesta postura.</p>;
  return <div className="egg-board" aria-label="Ovos individuais da postura">{eggs.map(egg => <section className="card egg-card" key={egg.id} aria-label={`Ovo ${egg.number}`}>
    <div className="egg-status-row"><h3 className="section-title">Ovo {egg.number}</h3><span className="status-badge">Resultado: {egg.status === 'incubando' ? 'em acompanhamento' : egg.status}</span></div>
    <dl className="egg-card-details">
      <div><dt>Postura</dt><dd>{dateLabel(egg.laidDate)}</dd></div>
      <div><dt>Fertilidade</dt><dd>{egg.fertility === 'desconhecida' ? 'Ainda não avaliada' : egg.fertility}</dd></div>
      <div><dt>Início da incubação</dt><dd>{dateLabel(egg.incubationDate)}</dd></div>
      <div><dt>Previsão (estimativa)</dt><dd>{dateLabel(egg.expectedHatchDate)}</dd></div>
      {egg.outcomeDate && <div><dt>Data do resultado</dt><dd>{dateLabel(egg.outcomeDate)}</dd></div>}
      {egg.chickId && <div><dt>Eclosão</dt><dd>{dateLabel(egg.hatchDate)} · {birdLink(egg.chickId)}</dd></div>}
    </dl>
    {(egg.notes || egg.events?.length) ? <details className="record-subsection"><summary>Notas e histórico do ovo</summary>{egg.notes && <p className="preserve-lines">{egg.notes}</p>}{(egg.events?.length ?? 0) > 0 && <ol className="record-history">{egg.events?.slice().sort((a, b) => a.date.localeCompare(b.date)).map((event, index) => <li key={index}>{dateLabel(event.date)} · {event.kind}{event.notes && ` · ${event.notes}`}</li>)}</ol>}</details> : null}
    {!closed && <div className="toolbar"><button className="button secondary" onClick={() => onEvaluate(egg)}>Avaliar ovo</button>{egg.status === 'incubando' && <button className="button" onClick={() => onHatch(egg)}>Confirmar eclosão</button>}</div>}
  </section>)}</div>;
}
