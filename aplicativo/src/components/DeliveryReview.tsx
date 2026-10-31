import { useState } from 'react';
import type { ModuleProps, Sale } from '../domain/types';
import { billOutstanding, deliveryCandidates, salePaid } from '../domain/commercial';
import { birdLabel, dateLabel, money } from '../domain/shared';
import { AttachmentPreview } from './DirectAttachments';
import { BirdChip } from '../ui/bits';
import { downloadBytes, zipFiles } from '../lib/exports';
import { deliverySelectionKey, prepareDeliveryFiles, type DeliverySelection } from '../lib/delivery-files';

type Props = Pick<ModuleProps, 'state' | 'scope' | 'navigate'> & { sale: Sale; selected: DeliverySelection[]; onChange: (selected: DeliverySelection[]) => void; onBusyChange?: (busy: boolean) => void; delivered?: boolean; disabled?: boolean };

export default function DeliveryReview({ state, scope, sale, selected, onChange, onBusyChange, navigate, delivered = false, disabled = false }: Props) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState('');
  const contact = state.contacts.find(record => record.id === sale.contactId && record.scope === scope);
  const birds = sale.items.filter(item => item.kind === 'ave' && item.refId).map(item => state.birds.find(record => record.scope === scope && record.id === item.refId)).filter(record => !!record);
  const remaining = state.bills.filter(record => record.scope === scope && record.saleId === sale.id && record.direction === 'receber').reduce((sum, record) => sum + billOutstanding(state, scope, record), 0);
  const candidates = delivered ? (sale.deliveryManifest ?? []).map(reference => { const record = reference.type === 'attachment' ? state.attachments.find(record => record.id === reference.id && record.scope === scope) : state.documents.find(record => record.id === reference.id && record.scope === scope); return { ...reference, title: record?.title ?? reference.fileName, size: record?.size ?? 0 }; }) : deliveryCandidates(state, scope, sale.id);
  const chosen = delivered ? candidates.map(reference => ({ type: reference.type, id: reference.id })) : selected;
  const source = (() => { const entry = candidates.find(record => deliverySelectionKey(record) === preview); if (!entry) return null; if (entry.type === 'attachment') return state.attachments.find(record => record.scope === scope && record.id === entry.id) ?? null; const document = state.documents.find(record => record.scope === scope && record.id === entry.id); return document ? { ...document, date: document.createdAt.slice(0, 10), contactId: null, category: document.kind, issuer: state.settings.name, reference: '', validUntil: '', notes: '', shareWithCustomer: true, version: 1, previousId: null } : null; })();
  function toggle(reference: DeliverySelection, checked: boolean) {
    const key = deliverySelectionKey(reference);
    const next = checked ? [...selected.filter(item => deliverySelectionKey(item) !== key), reference] : selected.filter(item => deliverySelectionKey(item) !== key);
    if (next.length > 20) { setError('Selecione até 20 arquivos para esta entrega.'); return; }
    const bytes = candidates.filter(record => next.some(item => deliverySelectionKey(item) === deliverySelectionKey(record))).reduce((sum, record) => sum + record.size, 0);
    if (bytes > 40 * 1024 * 1024) { setError('Selecione até 40 MB por entrega. Os demais originais continuam disponíveis individualmente.'); return; }
    setError(''); onChange(next);
  }
  async function download() {
    if (busy || disabled) return;
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const files = await prepareDeliveryFiles(state, scope, sale.id, chosen, delivered);
      await downloadBytes(await zipFiles(files), `Entrega_${sale.number.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`, 'application/zip');
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível preparar os arquivos. A seleção foi mantida.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <section className="card record-form-section delivery-review" aria-label={delivered ? 'Arquivos da entrega registrada' : 'Revisão da entrega'}>
    <h3>{delivered ? 'Entrega registrada e arquivos originais' : 'Revisão da entrega'}</h3>
    <dl className="delivery-summary"><div><dt>Cliente</dt><dd>{contact?.name ?? 'Não informado'}{contact?.phone && <small>{contact.phone}</small>}</dd></div><div><dt>Aves</dt><dd>{birds.length ? birds.map(record => <span key={record.id} className="block py-0.5"><BirdChip state={state} scope={scope} bird={record} size={34} sub={record.species}/></span>) : 'Esta operação não contém aves.'}</dd></div><div><dt>Recebido líquido</dt><dd>{money(salePaid(state, scope, sale.id))}</dd></div><div><dt>Em aberto</dt><dd>{money(remaining)}</dd></div><div><dt>Entrega</dt><dd>{sale.deliveryDate ? dateLabel(sale.deliveryDate) : 'Ainda não registrada'}</dd></div></dl>
    {!delivered && <p className="notice">Confirmar a entrega preserva as parcelas e os pagamentos. Saldo pendente continua a receber.</p>}
    {navigate && <div className="row action-row">{birds.map(record => <button type="button" className="button" key={record.id} disabled={busy || disabled} onClick={() => navigate({ view: 'booklet', saleId: sale.id, birdId: record.id })}>Caderneta · {birdLabel(record)}</button>)}<button type="button" className="button" disabled={busy || disabled} onClick={() => navigate({ view: 'documents', saleId: sale.id, filter: 'Recibo de pagamento' })}>Revisar recibo</button><button type="button" className="button" disabled={busy || disabled} onClick={() => navigate({ view: 'documents', saleId: sale.id, filter: 'Termo de entrega' })}>Revisar termo de entrega</button></div>}
    <h4>{delivered ? 'Seleção preservada no momento da entrega' : 'Arquivos para o tutor'}</h4>
    <p className="muted">Cadernetas, recibos, termos e anexos autorizados para entrega. Custos, margens, relatórios gerenciais e anotações internas ficam fora do pacote. Recibos e termos próprios não são documentos fiscais ou oficiais.</p>
    <div className="delivery-file-list">{candidates.map(record => { const key = deliverySelectionKey(record); return <article className="delivery-file-row" key={key}>{delivered ? <strong>{record.title}</strong> : <label className="check"><input type="checkbox" checked={selected.some(item => deliverySelectionKey(item) === key)} disabled={busy || disabled} onChange={event => toggle({ type: record.type, id: record.id }, event.target.checked)}/><span>{record.title}</span></label>}<small>{record.fileName}</small><button type="button" className="button compact" disabled={busy || disabled} onClick={() => setPreview(preview === key ? '' : key)}>{preview === key ? 'Ocultar prévia' : 'Ver original'}</button></article>; })}</div>
    {!candidates.length && <p className="muted">{delivered ? 'Esta entrega não tem seleção de arquivos registrada. As versões emitidas continuam na central Documentos.' : 'Nenhum arquivo autorizado para entrega está vinculado a esta operação. Você pode emitir a caderneta ou revisar documentos pelos botões acima.'}</p>}
    {source && <AttachmentPreview attachment={source}/>}<div className="row action-row"><button type="button" className="button" disabled={busy || disabled || !chosen.length} onClick={() => void download()}>{busy ? 'Preparando arquivos…' : 'Baixar arquivos selecionados'}</button><span className="muted">{chosen.length} arquivos {delivered ? 'na versão entregue' : 'selecionados'}</span></div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
