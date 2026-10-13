import { useEffect, useMemo, useState } from 'react';
import { Activity, ClipboardList, Scale, Sprout, Stethoscope } from 'lucide-react';
import type { HealthEvent, ModuleProps } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import { healthHistoriesForBirds, healthHistoryForBird } from '../domain/breeding';
import { AttachmentPreview } from './DirectAttachments';
import { healthKinds } from './HealthRegistrationForm';
import { RecordDetailsDialog, RecordField as Field } from './RecordDialog';

const includes = (search: string, ...values: (string | null | undefined)[]) => values.join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));

export function HealthEventDetails({ event, state, scope, onClose, onEdit }: ModuleProps & { event: HealthEvent; onClose: () => void; onEdit: (event: HealthEvent) => void }) {
  const bird = state.birds.find(b => b.scope === scope && b.id === event.birdId);
  const files = state.attachments.filter(a => a.scope === scope && event.attachmentIds.includes(a.id));
  return <RecordDetailsDialog title={event.title} onClose={onClose}>
    <dl className="record-details">
      <div><dt>Ave</dt><dd>{birdLabel(bird)}</dd></div><div><dt>Data</dt><dd>{dateLabel(event.date)}</dd></div>
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
  const { state, scope, search, onNew, onEdit } = props;
  const [birdId, setBirdId] = useState<string | null>(null), [eventId, setEventId] = useState<string | null>(null);
  const [kind, setKind] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  useEffect(() => { setBirdId(null); setEventId(null); }, [scope]);
  const birds = useMemo(() => state.birds.filter(b => b.scope === scope), [state.birds, scope]), selected = birds.find(b => b.id === birdId);
  const histories = useMemo(() => healthHistoriesForBirds(state.health, scope), [state.health, scope]);
  const rows = useMemo(() => birds.map(bird => ({ bird, records: (histories.get(bird.id) ?? []).filter(event => (!kind || event.kind === kind) && (!from || event.date >= from) && (!to || event.date <= to) && (includes(search, birdLabel(bird), bird.species) || includes(search, event.title, event.kind, event.notes, event.author, event.professional))) })).filter(row => row.records.length).sort((a, b) => b.records[0].date.localeCompare(a.records[0].date) || birdLabel(a.bird).localeCompare(birdLabel(b.bird), 'pt-BR')), [birds, histories, kind, from, to, search]);
  const selectedRecords = selected ? rows.find(row => row.bird.id === selected.id)?.records ?? [] : [];
  const event = state.health.find(h => h.scope === scope && h.id === eventId);
  return <>
    <section className="card"><div className="grid filters">
      <Field label="Tipo de registro"><select value={kind} onChange={e => setKind(e.target.value)}><option value="">Todos</option>{healthKinds.map(k => <option key={k}>{k}</option>)}</select></Field>
      <Field label="Registros a partir de"><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></Field>
      <Field label="Registros até"><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></Field>
    </div></section>
    {selected ? <section className="card"><div className="row record-header"><h2 className="section-title">Histórico de {birdLabel(selected)}</h2><div className="toolbar"><button className="button secondary" onClick={() => setBirdId(null)}>Voltar às aves com registros</button><button className="button" onClick={() => onNew(selected.id)}>Novo registro para esta ave</button></div></div><p>{selectedRecords.length} registros neste filtro.</p><HealthTimeline records={selectedRecords} onOpen={h => setEventId(h.id)}/></section> : <section className="card"><h2 className="section-title">Aves com registros de saúde e manejo</h2><p className="muted">Abra uma ave para consultar seu histórico. Aves sem registros não aparecem nesta lista.</p>{rows.length ? <div className="table-wrap record-table-wrap"><table><thead><tr><th>Ave</th><th>Registros</th><th>Registro mais recente</th><th>Histórico</th></tr></thead><tbody>{rows.map(({ bird, records }) => <tr key={bird.id}><td><strong>{birdLabel(bird)}</strong><small>{bird.species}</small></td><td>{records.length}</td><td>{dateLabel(records[0].date)}<small>{records[0].title}</small></td><td><button className="button secondary" onClick={() => setBirdId(bird.id)} aria-label={`Ver histórico de ${birdLabel(bird)}`}>Ver histórico</button></td></tr>)}</tbody></table></div> : <p className="empty muted">Nenhuma ave com registros neste filtro. Use Novo registro para cadastrar um manejo, exame ou observação.</p>}</section>}
    {event && <HealthEventDetails {...props} event={event} onClose={() => setEventId(null)} onEdit={onEdit}/>}
  </>;
}

export function BirdHealthHistory(props: ModuleProps & { birdId: string; onEdit: (event: HealthEvent) => void }) {
  const { state, scope, birdId, onEdit } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const records = useMemo(() => healthHistoryForBird(state, scope, birdId), [state.health, scope, birdId]);
  const weights = useMemo(() => records.filter(h => h.weightGrams !== null).slice().reverse(), [records]), last = records.find(h => h.weightGrams !== null);
  const event = records.find(h => h.id === eventId);
  return <>
    {weights.length > 0 && <section className="card"><h3 className="section-title">Evolução do peso</h3><p>Peso mais recente: <strong>{last?.weightGrams?.toLocaleString('pt-BR')} g</strong> · {dateLabel(last?.date)}</p><ol className="record-history">{weights.map(h => <li key={h.id}>{dateLabel(h.date)}: <strong>{h.weightGrams?.toLocaleString('pt-BR')} g</strong> · {h.title}</li>)}</ol></section>}
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
