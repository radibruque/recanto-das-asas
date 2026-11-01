import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Enclosure, ModuleProps } from '../domain/types';
import { enclosureBirds, enclosureOptions, enclosureStatuses } from '../domain/enclosures';
import { birdLabel } from '../domain/shared';
import { Button } from '../ui/bits';
import { RecordDialog, RecordField } from '../components/RecordDialog';
import { AttachmentThumbnail } from '../components/DirectAttachments';
export default function Enclosures({ state, scope, command, notify, navigate, search }: ModuleProps) {
 const [editing, setEditing] = useState<Enclosure | 'new' | null>(null), [deleting, setDeleting] = useState<Enclosure | null>(null);
 const old = editing && editing !== 'new' ? editing : undefined;
 return <section className="ui space-y-5"><div className="flex justify-end"><Button onClick={() => setEditing('new')}><Plus/>Novo recinto</Button></div>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{enclosureOptions(state, scope).filter(e => e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(e => {
 const birds = enclosureBirds(state, scope, e.name);
 return <article key={e.id} className="rounded-lg bg-card p-4 ring-1 ring-border"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{e.name}</h2><p className="text-sm text-muted-foreground">{e.status} · {birds.length} aves</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`Editar ${e.name}`} title="Editar recinto" onClick={() => setEditing(e)}><Pencil/></Button><Button variant="ghost" size="sm" aria-label={`Excluir ${e.name}`} title="Excluir recinto" onClick={() => setDeleting(e)}><Trash2/></Button></div></div>
 <div className="mt-3 divide-y divide-border">{birds.map(b => { const photo = state.attachments.find(a => a.id === b.photoId && a.scope === scope); return <Button key={b.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2" onClick={() => navigate?.({ view: 'birds', birdId: b.id })}>{photo && <span className="size-10 shrink-0 overflow-hidden rounded-lg"><AttachmentThumbnail attachment={photo} maxHeight={40}/></span>}<span className="text-left">{birdLabel(b)}</span></Button>; })}</div></article>;
 })}</div>
 {!enclosureOptions(state, scope).length && <p className="text-sm text-muted-foreground">Nenhum recinto cadastrado.</p>}
 {editing && <RecordDialog title={old ? 'Editar recinto' : 'Novo recinto'} onClose={() => setEditing(null)} onSave={async form => { const result = await command('enclosure.save', { id: old?.id, name: String(form.get('name')), status: String(form.get('status')) }); setEditing(null); notify('Recinto salvo.'); return result; }}><div className="grid form-grid"><RecordField label="Nome *"><input name="name" defaultValue={old?.name} required maxLength={150}/></RecordField><RecordField label="Situação"><select name="status" defaultValue={old?.status ?? 'disponível'}>{enclosureStatuses.map(s => <option key={s}>{s}</option>)}</select></RecordField></div></RecordDialog>}
 {deleting && <RecordDialog title="Excluir recinto" onClose={() => setDeleting(null)} onSave={async () => { const result = await command('enclosure.delete', { name: deleting.name }); setDeleting(null); notify('Recinto excluído.'); return result; }}><p>Excluir <strong>{deleting.name}</strong>?</p>{enclosureBirds(state, scope, deleting.name).length > 0 && <p className="error">Mova todas as aves para outro recinto antes de excluir este.</p>}</RecordDialog>}
 </section>;
}
