import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import type { Attachment } from '../domain/types';
import { preparePrincipalPhoto, type PendingAttachment } from '../lib/attachment-input';
import { AttachmentThumbnail } from './DirectAttachments';
import { Button } from '../ui/bits';

export function PrincipalPhotoPicker({ value, onChange, current, onRemove, onBusy }: { value: PendingAttachment[]; onChange: (files: PendingAttachment[]) => void; current?: Attachment; onRemove: () => void; onBusy: (busy: boolean) => void }) {
  const file = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const preview = value.find(f => f.role === 'photo') ?? current;
  async function select(selected?: File) {
    if (!selected) return;
    setBusy(true); onBusy(true); setError('');
    try { onChange(await preparePrincipalPhoto(selected, 'Foto de perfil')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível preparar a foto.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="ui flex flex-col gap-3">
    {preview && <AttachmentThumbnail attachment={preview} maxHeight={160}/>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => file.current?.click()}><ImagePlus/>{preview ? 'Alterar foto' : 'Escolher foto'}</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => camera.current?.click()}><Camera/>Tirar foto</Button>
      {preview && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { onChange([]); onRemove(); }}><Trash2/>Remover foto</Button>}
    </div>
    <input ref={file} type="file" accept="image/jpeg,image/png" aria-label="Foto principal da ave" hidden onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Tirar foto da ave" hidden onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/>
    {busy && <p role="status" className="text-sm text-muted-foreground">Preparando foto…</p>}
    {error && <p role="alert" className="text-sm text-coral">{error}</p>}
  </div>;
}