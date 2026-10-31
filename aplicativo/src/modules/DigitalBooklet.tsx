import { useUiState } from '../lib/ui-context';
import { useEffect, useMemo, useState } from 'react';
import type { Attachment, IssuedDocument, ModuleProps, State } from '../domain/types';
import { birdLabel, dateLabel, today } from '../domain/shared';
import { base64ToBytes, sha256 } from '../domain/documents';
import { bookletDataFromFields, deriveBookletFields, type DigitalBookletFields } from '../lib/booklet';
import { exportFoldableBooklet, tutorBookletSections } from '../lib/booklet-fold';
import BookletPreview from '../components/BookletPreview';
import { downloadBytes, issuedPayload } from '../lib/exports';
import { AttachmentPicker, AttachmentThumbnail, type PendingAttachment } from '../components/DirectAttachments';
import { RecordDetailsDialog } from '../components/RecordDialog';

const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir. Seus dados foram preservados.';
const safeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 70) || 'ave';

export default function DigitalBooklet({ state, scope, command, notify, search, target, uiContext }: ModuleProps) {
  const [birdId, setBirdId] = useUiState(uiContext,'booklet:birdId',''), [saleId, setSaleId] = useUiState(uiContext,'booklet:saleId',''), [fields, setFields] = useUiState<DigitalBookletFields>(uiContext,'booklet:fields',{});
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]), [includePhoto, setIncludePhoto] = useUiState(uiContext,'booklet:includePhoto',true);
  const [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false), [error, setError] = useState('');
  const [historyBirdId, setHistoryBirdId] = useUiState(uiContext,'booklet:historyBirdId',''), [selectedClinical, setSelectedClinical] = useUiState<string[]>(uiContext,'booklet:selectedClinical',[]);
  const birds = state.birds.filter(value => value.scope === scope);
  const bird = birds.find(value => value.id === birdId);
  const sales = state.sales.filter(value => value.scope === scope && value.items.some(item => item.kind === 'ave' && item.refId === birdId));
  const currentPhoto = state.attachments.find(value => value.scope === scope && value.id === bird?.photoId);
  const clinical = state.health.filter(value => value.scope === scope && value.birdId === birdId && !['peso', 'pesagem', 'manejo'].includes(value.kind.toLocaleLowerCase('pt-BR'))).sort((a, b) => b.date.localeCompare(a.date));
  const issued = useMemo(() => state.documents.filter(value => value.scope === scope && value.birdId && /^caderneta/i.test(value.kind)), [state.documents, scope]);
  const historicBirds = birds.filter(value => issued.some(document => document.birdId === value.id) && `${birdLabel(value)} ${value.species}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const history = issued.filter(value => value.birdId === historyBirdId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const historyBird = birds.find(value => value.id === historyBirdId);



  useEffect(()=>{
    if(target?.birdId){setBirdId(target.birdId);setSaleId(target.saleId??'');setFields(deriveBookletFields(state,scope,target.birdId,target.saleId));setAttachments([]);setSelectedClinical([]);setError('');}
    if(target?.issuedDocumentId){const original=issued.find(d=>d.id===target.issuedDocumentId);if(original?.birdId)setHistoryBirdId(original.birdId);}
  },[target?.request]);

  function chooseBird(id: string) {
    setBirdId(id); setSaleId(''); setSelectedClinical([]); setAttachments([]); setError('');
    setFields(id ? deriveBookletFields(state, scope, id) : {});
  }
  function chooseSale(id: string) {
    setSaleId(id);
    if (!birdId) return;
    const derived = deriveBookletFields(state, scope, birdId, id, false);
    setFields(value => ({ ...value, delivery_date: derived.delivery_date, tutor_name: derived.tutor_name, tutor_phone: derived.tutor_phone }));
  }
  function chooseClinical(id: string, checked: boolean) {
    const next = checked ? [...selectedClinical, id] : selectedClinical.filter(value => value !== id);
    if (next.length > 2) { setError('O modelo possui duas linhas para consultas e exames. Selecione até dois registros; o histórico completo continua em Saúde e manejo.'); return; }
    setError(''); setSelectedClinical(next);
    setFields(value => {
      const updated = { ...value };
      for (let row = 1; row <= 2; row++) { updated[`clinical_${row}_date`] = ''; updated[`clinical_${row}_record`] = ''; updated[`clinical_${row}_professional`] = ''; }
      next.map(recordId => clinical.find(record => record.id === recordId)!).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)).forEach((record, index) => {
        updated[`clinical_${index + 1}_date`] = record.date;
        updated[`clinical_${index + 1}_record`] = [record.title, record.notes].filter(Boolean).join(' · ');
        updated[`clinical_${index + 1}_professional`] = record.professional;
      });
      return updated;
    });
  }
  async function run(action: () => Promise<void>) {
    if (busy || preparing) return;
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  async function saveData() {
    if (!bird) throw new Error('Selecione uma ave.');
    const booklet = { ...bird.booklet, ...bookletDataFromFields(fields, deriveBookletFields(state, scope, bird.id, saleId, false)) };
    const id = await command(attachments.length ? 'save.withAttachments' : 'bird.booklet', attachments.length ? { action: 'bird.booklet', data: { id: bird.id, booklet }, attachments } : { id: bird.id, booklet });
    if (!id) throw new Error('Não foi possível salvar os dados da caderneta. Os campos e arquivos selecionados foram mantidos.');
    setAttachments([]);
  }
  async function emit() {
    if (!bird) throw new Error('Selecione uma ave.');
    const booklet = { ...bird.booklet, ...bookletDataFromFields(fields, deriveBookletFields(state, scope, bird.id, saleId, false)) };
    const selectedPhoto = [...attachments].reverse().find(value => value.role === 'photo');
    const previewPhoto: Attachment | undefined = selectedPhoto ? { ...selectedPhoto, id: '__booklet_pending_photo__', scope, birdId: bird.id, contactId: null, saleId: null, version: 1, previousId: null } : undefined;
    const previewState: State = { ...state, birds: state.birds.map(value => value.id === bird.id ? { ...value, booklet, photoId: previewPhoto?.id || value.photoId } : value), attachments: previewPhoto ? [...state.attachments, previewPhoto] : state.attachments };
    // Finish and validate the PDF before storing anything or opening Android's
    // file picker. A generation error can never leave a zero-byte export.
    const bytes = await exportFoldableBooklet(previewState, scope, bird.id, { fields, includePhoto });
    const name = `caderneta_${safeName(bird.identification)}_${scope}_${today()}.pdf`;
    await saveData();
    const id = await command('document.issue', { ...issuedPayload(bytes, name, 'application/pdf'), kind: 'Caderneta do pet', title: `Caderneta do pet ${birdLabel(bird)}`, birdId: bird.id, saleId: saleId || null });
    if (!id) throw new Error('O PDF foi gerado, mas não foi arquivado. Seus dados foram preservados; tente emitir novamente.');

    notify('Caderneta gerada. Imprima frente e verso e dobre ao meio. Uma cópia ficou nos documentos da ave.');
    try { await downloadBytes(bytes, name, 'application/pdf'); }
    catch (failure) { throw new Error(`A caderneta já está no histórico da ave. O salvamento no aparelho não foi concluído: ${message(failure)} Abra a ficha da ave, aba Documentos e fotos, para baixar de novo.`); }
  }
  async function recover(document: IssuedDocument, view: boolean) {
    const bytes = base64ToBytes(document.base64);
    if (!bytes.length || sha256(bytes) !== document.sha256) throw new Error('A integridade deste documento não pôde ser confirmada.');
    if (view) { const { viewFileBytes } = await import('../lib/exports'); await viewFileBytes(bytes, document.fileName, document.mime); }
    else await downloadBytes(bytes, document.fileName, document.mime);
  }

  return <>
    {error && <p role="alert" className="error">{error}</p>}
    {busy && <p role="status">Processando caderneta… aguarde.</p>}
    <section className="card booklet-editor">
      <h3 className="section-title">Caderneta da ave</h3>
      <p>Uma folha A4 impressa frente e verso e dobrada ao meio: capa, identificação, cuidados e contatos. Só o que o tutor precisa saber.</p>
      <div className="form-grid">
        <label>Ave<select disabled={busy || preparing} value={birdId} onChange={event => chooseBird(event.target.value)}><option value="">Selecione uma ave</option>{birds.map(value => <option key={value.id} value={value.id}>{birdLabel(value)}</option>)}</select></label>
        <label>Vínculo com venda / entrega<select disabled={!bird || busy || preparing} value={saleId} onChange={event => chooseSale(event.target.value)}><option value="">Sem vínculo</option>{sales.map(value => <option key={value.id} value={value.id}>{value.number} · {dateLabel(value.date)}</option>)}</select></label>
      </div>
      {bird && <>
        <p>Custos de aquisição, contatos do fornecedor e observações internas da ave ficam fora deste documento. Os dados adicionais salvos aqui também ficam na ficha da ave e na sincronização.</p>
        <div className="toolbar"><button type="button" className="button secondary" disabled={busy || preparing} onClick={() => { setFields(deriveBookletFields(state, scope, bird.id, saleId, false)); setSelectedClinical([]); }}>Atualizar dados do cadastro</button></div>
        <fieldset className="record-form-section" disabled={busy}>
          <legend>Foto e documentos da caderneta</legend>
          {currentPhoto && <><p>Foto cadastrada da ave:</p><AttachmentThumbnail attachment={currentPhoto} maxHeight={200} /></>}
          <label className="check"><input type="checkbox" checked={includePhoto} onChange={event => setIncludePhoto(event.target.checked)} />Incluir a foto no espaço do modelo</label>
          <p>A foto será encaixada por inteiro, sem distorção, dentro da moldura de identificação. Os demais anexos ficam no acervo da ave.</p>
          <AttachmentPicker value={attachments} onChange={value => { setAttachments(value); const photo = [...value].reverse().find(file => file.role === 'photo'); if (photo) setFields(current => ({ ...current, photo_date: photo.date })); }} category="Caderneta / identificação" allowPhoto disabled={busy} onBusyChange={setPreparing} />
        </fieldset>
        {clinical.length > 0 && <details className="record-form-section"><summary>Copiar consultas ou exames registrados</summary><p>Selecione até dois registros e revise o texto nos campos de Saúde e contatos. Esta seleção não cria prescrições nem altera o histórico clínico.</p>{clinical.map(record => <label className="check" key={record.id}><input type="checkbox" disabled={busy} checked={selectedClinical.includes(record.id)} onChange={event => chooseClinical(record.id, event.target.checked)} />{dateLabel(record.date)} · {record.kind} · {record.title}</label>)}</details>}
        <BookletPreview bird={bird} photo={currentPhoto} fields={fields} organization={state.settings.name}/>
        {tutorBookletSections.map((section, index) => <details className="record-form-section booklet-page" key={section.title} open={index === 0}>
          <summary>Páginas {index + 2} — {section.title}</summary>
          <div className="form-grid">{section.fields.map(field => <label key={field.key}>{field.label}
            {field.type === 'choice' ? <select disabled={busy} value={fields[field.key] || ''} onChange={event => setFields(value => ({ ...value, [field.key]: event.target.value }))}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : field.type === 'textarea' ? <textarea disabled={busy} rows={3} maxLength={4096} value={fields[field.key] || ''} onChange={event => setFields(value => ({ ...value, [field.key]: event.target.value }))} />
                : <input disabled={busy} type={field.type === 'date' ? 'date' : 'text'} maxLength={4096} value={fields[field.key] || ''} onChange={event => setFields(value => ({ ...value, [field.key]: event.target.value }))} />}
          </label>)}</div>
        </details>)}
        <p className="muted">As pesagens trazem as três últimas registradas. Campos sem informação ficam com um traço. Se algum texto não couber, o app avisa antes de gerar.</p>
        <div className="toolbar"><button className="button secondary" disabled={busy || preparing} onClick={() => void run(async () => { await saveData(); notify('Dados da caderneta e anexos salvos na ave.'); })}>Salvar dados da caderneta</button><button className="button" disabled={busy || preparing} onClick={() => void run(emit)}>Gerar caderneta para imprimir</button></div>
      </>}
    </section>
    {historyBird && <RecordDetailsDialog title={`Cadernetas — ${birdLabel(historyBird)}`} onClose={() => setHistoryBirdId('')}>
      <p>Cada emissão preserva seu PDF original. Atualizar os dados da ave não modifica as versões anteriores.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {history.map(document => <article key={document.id} className="card document-card"><h3 className="section-title">{document.title}</h3><p>{new Date(document.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {(document.size / 1024).toFixed(1)} KB</p><p>{document.fileName}</p><div className="toolbar"><button className="button secondary" disabled={busy} onClick={() => void run(() => recover(document, true))}>Visualizar</button><button className="button" disabled={busy} onClick={() => void run(() => recover(document, false))}>Baixar original</button></div></article>)}
    </RecordDetailsDialog>}
  </>;
}
