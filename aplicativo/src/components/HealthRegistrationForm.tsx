import { useState } from 'react';
import type { HealthEvent, ModuleProps } from '../domain/types';
import { birdLabel, today } from '../domain/shared';
import { formCatalogs } from '../domain/form-catalogs';
import { AttachmentPicker, AttachmentPreview } from './DirectAttachments';
import type { PendingAttachment } from './DirectAttachments';
import { RecordDialog, RecordField as Field } from './RecordDialog';

const value = (form: FormData, name: string) => String(form.get(name) ?? '');
export const healthKinds = ['pesagem','alimentação','anilhamento','desmame','independência','consulta','exame','diagnóstico informado','tratamento prescrito','procedimento','ocorrência','acompanhamento'];

export default function HealthRegistrationForm({ state, scope, command, event, birdId, onClose }: ModuleProps & { event?: HealthEvent; birdId?: string; onClose: () => void }) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const birds = state.birds.filter(b => b.scope === scope);
  const fixedBird = event?.birdId ?? birdId;
  const linked = state.attachments.filter(a => a.scope === scope && event?.attachmentIds.includes(a.id));
  async function save(form: FormData) {
    return command('save.withAttachments', { action: 'saveHealth', attachments: pending, data: {
      id: event?.id, birdId: fixedBird ?? value(form, 'birdId'), date: value(form, 'date'), kind: value(form, 'kind'), title: value(form, 'kind'), notes: value(form, 'notes'), weightGrams: event?.weightGrams ?? null, professional: event?.professional ?? '', author: event?.author ?? 'Proprietário', attachmentIds: event?.attachmentIds ?? [],
    } });
  }
  return <RecordDialog title={event ? 'Editar registro de manejo' : 'Registrar saúde ou manejo'} onClose={onClose} onSave={save} preparing={preparing}>
    <div className="grid form-grid">
      <Field label="Ave *"><select name="birdId" defaultValue={fixedBird ?? ''} required disabled={!!fixedBird}><option value="">Selecione</option>{birds.map(b => <option key={b.id} value={b.id}>{birdLabel(b)}</option>)}</select></Field>
      <Field label="Data *"><input type="date" name="date" defaultValue={event?.date ?? today()} required max={today()}/></Field>
      <Field label="Tipo"><select name="kind" defaultValue={event?.kind ?? formCatalogs(state).healthKinds[0]}>{[...new Set([...formCatalogs(state).healthKinds.filter(kind => kind !== 'pesagem'), ...(event?.kind ? [event.kind] : [])])].map(kind => <option key={kind}>{kind}</option>)}</select></Field>
      <Field label="Observações"><textarea name="notes" defaultValue={event?.notes}/></Field>
    </div>
    <fieldset className="record-form-section"><legend>Fotos e documentos deste registro</legend>
      {linked.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment}/>)}
      <AttachmentPicker value={pending} onChange={setPending} onBusyChange={setPreparing} category="Saúde e manejo"/>
      <p className="muted">Anexe o exame, laudo ou foto diretamente aqui. Os arquivos ficam ligados a este registro e à ave, disponíveis também em Documentos.</p>
    </fieldset>
    <p className="muted">Registre informações do criador ou profissional. O sistema não gera prescrições clínicas.</p>
  </RecordDialog>;
}
