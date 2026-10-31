import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ClipboardList, Scale, Sprout, Stethoscope } from 'lucide-react';
import type { HealthEvent, ModuleProps } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import { healthHistoriesForBirds, healthHistoryForBird } from '../domain/breeding';
import { AttachmentPreview } from './DirectAttachments';
import { BirdChip } from '../ui/bits';
import { healthKinds } from './HealthRegistrationForm';
import { RecordDetailsDialog, RecordField as Field } from './RecordDialog';
import WeightChart from './WeightChart';
import { useUiState, writeUiContext, rememberUiRoute, recallUiRoute } from '../lib/ui-context';
type HealthContext={birdId:string|null;kind:string;from:string;to:string};

const includes = (search: string, ...values: (string | null | undefined)[]) => values.join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));

export function HealthEventDetails({ event, state, scope, onClose, onEdit }: ModuleProps & { event: HealthEvent; onClose: () => void; onEdit: (event: HealthEvent) => void }) {
  const bird = state.birds.find(b => b.scope === scope && b.id === event.birdId);
  const files = state.attachments.filter(a => a.scope === scope && event.attachmentIds.includes(a.id));
  return <RecordDetailsDialog title={event.title} onClose={onClose}>
    <dl className="record-details">
      <div><dt>Ave</dt><dd>{bird ? <BirdChip state={state} scope={scope} bird={bird} size={36}/> : birdLabel(bird)}</dd></div><div><dt>Data</dt><dd>{dateLabel(event.date)}</dd></div>
      <div><dt>Tipo</dt><dd>{event.kind}</dd></div><div><dt>Peso registrado</dt><dd>{event.weightGrams === null ? 'Não informado' : `${event.weightGrams.toLocaleString('pt-BR')} g`}</dd></div>
      <div><dt>Profissional</dt><dd>{event.professional || 'Não informado'}</dd></div><div><dt>Autor do registro</dt><dd>{event.author}</dd></div>
    </dl>
    <h3 className="section-title">Observações</h3><p className="preserve-lines">{event.notes || 'Nenhuma observação registrada.'}</p>
    <h3 className="section-title">Fotos e documentos</h3>
    {files.length ? files.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment}/>) : <p className="muted">Nenhum arquivo anexado a este registro.</p>}
    <div className="toolbar modal-actions"><button className="button" onClick={() => { onClose(); onEdit(event); }}>Editar registro</button><button className="button secondary" onClick={onClose}>Voltar ao histórico</button></div>
  </RecordDetailsDialog>;
}

export function HealthTimeline({ records, onOpen }: { records: HealthEvent[]; onOpen: (event: HealthEvent) => void }) {
  if (!records.length) return <p className="empty muted">Nenhum registro de saúde ou manejo.</p>;
  return <ol className="health-timeline" aria-label="Registros de saúde e manejo">{records.map(event => {
    const Icon = event.kind === 'pesagem' ? Scale : ['alimentação', 'desmame', 'independência'].includes(event.kind) ? Sprout : ['consulta', 'exame', 'diagnóstico informado'].includes(event.kind) ? Stethoscope : ['tratamento prescrito', 'procedimento', 'ocorrência'].includes(event.kind) ? Activity : ClipboardList;
    return <li key={event.id} className="health-timeline-entry">
      <span className="health-timeline-marker" aria-hidden="true"><Icon size={19}/></span>
      <div className="health-timeline-content">
        <div className="health-timeline-heading"><strong>{event.title}</strong><time className="health-timeline-date" dateTime={event.date}>{dateLabel(event.date)}</time></div>
        <span className="health-timeline-kind">{event.kind}</span>
        <div className="health-timeline-meta">{event.weightGrams !== null && <strong className="health-timeline-weight">{event.weightGrams.toLocaleString('pt-BR')} g</strong>}<span>{event.professional || event.author}</span><span>{event.attachmentIds.length} {event.attachmentIds.length === 1 ? 'arquivo' : 'arquivos'}</span></div>
        <button className="button secondary health-timeline-action" onClick={() => onOpen(event)} aria-label={`Ver registro: ${event.title}`}>Ver detalhes</button>
      </div>
    </li>;
  })}</ol>;
}

export default function HealthPanel(props: ModuleProps & { onNew: (birdId?: string) => void; onEdit: (event: HealthEvent) => void }) {
  const { state, scope, search, onNew, onEdit, target, back, uiContext } = props;
  const panel = useRef<HTMLDivElement>(null), hydrated = useRef(false);
  if (!hydrated.current) {
    hydrated.current = true;
    const remembered = recallUiRoute<HealthContext>(uiContext, 'health-routes', target?.request);
    if (remembered) for (const [key, value] of Object.entries(remembered)) writeUiContext(uiContext, `health.${key}`, value);
    else if (target) { writeUiContext(uiContext, 'health.birdId', target.birdId ?? null); if (target.birdId) for (const key of ['kind', 'from', 'to']) writeUiContext(uiContext, `health.${key}`, ''); }
  }
  const [birdId, setBirdId] = useUiState<string | null>(uiContext, 'health.birdId', target?.birdId ?? null), [eventId, setEventId] = useState<string | null>(null);
  const [kind, setKind] = useUiState<string>(uiContext,'health.kind',''), [from, setFrom] = useUiState<string>(uiContext,'health.from',''), [to, setTo] = useUiState<string>(uiContext,'health.to','');
  const [listScroll, setListScroll] = useUiState<number>(uiContext,'health.listScroll',0);
  const returnToBirds = () => { if (target?.birdId && back) back(); else { setBirdId(null); requestAnimationFrame(() => scrollTo(0, listScroll)); } };
  useEffect(() => () => { rememberUiRoute(uiContext, 'health-routes', target?.request, { birdId, kind, from, to }); }, [uiContext, target?.request, birdId, kind, from, to]);
  useEffect(() => {
    const remembered = recallUiRoute<HealthContext>(uiContext, 'health-routes', target?.request);
    if (remembered) { setBirdId(remembered.birdId); setKind(remembered.kind); setFrom(remembered.from); setTo(remembered.to); }
    else if (target) { setBirdId(target.birdId ?? null); if (target.birdId) { setKind(''); setFrom(''); setTo(''); } }
    setEventId(null);
  }, [target?.request]);
  useEffect(() => { const handle = (event: Event) => { if (!panel.current?.getClientRects().length) return; if (eventId) { event.preventDefault(); setEventId(null); } else if (birdId && !target?.birdId) { event.preventDefault(); returnToBirds(); } }; window.addEventListener('recanto:back', handle); return () => window.removeEventListener('recanto:back', handle); }, [birdId, eventId, target?.birdId, listScroll]);
  const birds = useMemo(() => state.birds.filter(b => b.scope === scope), [state.birds, scope]), selected = birds.find(b => b.id === birdId);
  const histories = useMemo(() => healthHistoriesForBirds(state.health, scope), [state.health, scope]);
  const rows = useMemo(() => birds.map(bird => ({ bird, records: (histories.get(bird.id) ?? []).filter(event => (!kind || event.kind === kind) && (!from || event.date >= from) && (!to || event.date <= to) && (includes(search, birdLabel(bird), bird.species) || includes(search, event.title, event.kind, event.notes, event.author, event.professional))) })).filter(row => row.records.length).sort((a, b) => b.records[0].date.localeCompare(a.records[0].date) || birdLabel(a.bird).localeCompare(birdLabel(b.bird), 'pt-BR')), [birds, histories, kind, from, to, search]);
  const selectedRecords = selected ? rows.find(row => row.bird.id === selected.id)?.records ?? [] : [];
  const event = state.health.find(h => h.scope === scope && h.id === eventId);
  return <div ref={panel} className="health-panel">
    <section className="card"><div className="grid filters">
      <Field label="Tipo de registro"><select value={kind} onChange={e => setKind(e.target.value)}><option value="">Todos</option>{healthKinds.map(k => <option key={k}>{k}</option>)}</select></Field>
      <Field label="Registros a partir de"><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></Field>
      <Field label="Registros até"><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></Field>
    </div></section>
    {selected ? <section className="card"><div className="row record-header"><h2 className="section-title"><BirdChip state={props.state} scope={props.scope} bird={selected} size={40} sub="Histórico de saúde e manejo"/></h2><div className="toolbar"><button className="button secondary" onClick={returnToBirds}>{target?.birdId && back ? 'Voltar ao contexto anterior' : 'Voltar às aves com registros'}</button><button className="button" onClick={() => onNew(selected.id)}>Novo registro para esta ave</button></div></div><p>{selectedRecords.length} registros neste filtro.</p><HealthTimeline records={selectedRecords} onOpen={h => setEventId(h.id)}/></section> : <section className="card"><h2 className="section-title">Aves com registros de saúde e manejo</h2><p className="muted">Abra uma ave para consultar seu histórico. Aves sem registros não aparecem nesta lista.</p>{rows.length ? <div className="table-wrap record-table-wrap"><table><thead><tr><th>Ave</th><th>Registros</th><th>Registro mais recente</th><th>Histórico</th></tr></thead><tbody>{rows.map(({ bird, records }) => <tr key={bird.id}><td><BirdChip state={props.state} scope={props.scope} bird={bird} size={36} sub={bird.species}/></td><td>{records.length}</td><td>{dateLabel(records[0].date)}<small>{records[0].title}</small></td><td><button className="button secondary" onClick={() => { setListScroll(scrollY); setBirdId(bird.id); scrollTo(0, 0); }} aria-label={`Ver histórico de ${birdLabel(bird)}`}>Ver histórico</button></td></tr>)}</tbody></table></div> : <p className="empty muted">Nenhuma ave com registros neste filtro. Use Novo registro para cadastrar um manejo, exame ou observação.</p>}</section>}
    {event && <HealthEventDetails {...props} event={event} onClose={() => setEventId(null)} onEdit={onEdit}/>}
  </div>;
}

export function BirdHealthHistory(props: ModuleProps & { birdId: string; onEdit: (event: HealthEvent) => void }) {
  const { state, scope, birdId, onEdit } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const records = useMemo(() => healthHistoryForBird(state, scope, birdId), [state.health, scope, birdId]);
  const weights = useMemo(() => records.filter(h => h.weightGrams !== null).slice().reverse(), [records]), last = records.find(h => h.weightGrams !== null);
  const event = records.find(h => h.id === eventId);
  return <>
    <section className="card"><h3 className="section-title">Evolução do peso</h3>{last && <p>Peso mais recente: <strong>{last.weightGrams?.toLocaleString('pt-BR')} g</strong> · {dateLabel(last.date)}</p>}<WeightChart records={weights}/>{weights.length > 0 && <><h4 className="subsection-title">Pesagens registradas</h4><ol className="record-history weight-records" aria-label="Lista de pesagens">{weights.map(h => <li key={h.id}><span><time dateTime={h.date}>{dateLabel(h.date)}</time> · <strong>{h.weightGrams?.toLocaleString('pt-BR')} g</strong><small>{h.title}</small></span><button className="button secondary" onClick={() => setEventId(h.id)} aria-label={`Ver pesagem de ${dateLabel(h.date)}: ${h.weightGrams?.toLocaleString('pt-BR')} g`}>Detalhes</button></li>)}</ol></>}</section>
    <section className="card"><h3 className="section-title">Histórico de saúde e manejo</h3><HealthTimeline records={records} onOpen={h => setEventId(h.id)}/></section>
    {event && <HealthEventDetails {...props} event={event} onClose={() => setEventId(null)} onEdit={onEdit}/>}
  </>;
}

export function BirdRecentHealthHistory(props: ModuleProps & { birdId: string; onEdit: (event: HealthEvent) => void; onViewAll: () => void; limit?: number }) {
  const { state, scope, birdId, onEdit, onViewAll, limit = 4 } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const records = useMemo(() => healthHistoryForBird(state, scope, birdId), [state.health, scope, birdId]);
  const event = records.find(record => record.id === eventId);
  return <>
    <section className="card bird-recent-health">
      <div className="row record-header"><h3 className="section-title">Histórico recente</h3><button className="button secondary" onClick={onViewAll}>Ver todo o histórico</button></div>
      <HealthTimeline records={records.slice(0, limit)} onOpen={record => setEventId(record.id)}/>
    </section>
    {event && <HealthEventDetails {...props} event={event} onClose={() => setEventId(null)} onEdit={onEdit}/>}
  </>;
}
