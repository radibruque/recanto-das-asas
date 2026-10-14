import { useState } from 'react';
import type { ModuleProps } from '../domain/types';
import { birdLabel } from '../domain/shared';
import { AttachmentPicker, type PendingAttachment } from './DirectAttachments';
import { RecordDialog } from './RecordDialog';

export default function BirdFilesForm({ state, scope, command, birdId, onClose }: ModuleProps & { birdId: string; onClose: () => void }) {
  const [pending, setPending] = useState<PendingAttachment[]>([]), [preparing, setPreparing] = useState(false);
  const bird = state.birds.find(record => record.scope === scope && record.id === birdId);
  if (!bird) return null;
  async function save() {
    if (!pending.length) throw new Error('Selecione pelo menos um arquivo para anexar.');
    return command('attachment.addBatch', { birdId, attachments: pending });
  }
  return <RecordDialog title="Anexar à ave" onClose={onClose} onSave={save} preparing={preparing}>
    <p><strong>{birdLabel(bird)}</strong></p>
    <AttachmentPicker value={pending} onChange={setPending} onBusyChange={setPreparing} category="Arquivo da ave"/>
    <p className="muted">Os arquivos ficam ligados a esta ave e disponíveis em Documentos. O cadastro e os históricos anteriores são preservados.</p>
  </RecordDialog>;
}
