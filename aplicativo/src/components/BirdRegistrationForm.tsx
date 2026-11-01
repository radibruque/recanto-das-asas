import { useState, type InvalidEvent } from 'react';
import type { Bird, ModuleProps } from '../domain/types';
import { birdLabel, today } from '../domain/shared';
import { formCatalogs } from '../domain/form-catalogs';
import { enclosureOptions } from '../domain/enclosures';
import { birdStatusOptions } from '../domain/breeding';
import { PrincipalPhotoPicker } from './PrincipalPhotoPicker';
import type { PendingAttachment } from './DirectAttachments';
import { RecordDialog, RecordField as Field } from './RecordDialog';
import DateInput from './DateInput';

const value = (form: FormData, name: string) => String(form.get(name) ?? '');
const nullable = (form: FormData, name: string) => value(form, name) || null;

export default function BirdRegistrationForm({ bird: b, state, scope, command, onClose }: ModuleProps & { bird?: Bird; onClose: () => void }) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [removedPhoto, setRemovedPhoto] = useState(false);
  const [origin, setOrigin] = useState(b?.origin ?? 'Não informada');
  const [mutation, setMutation] = useState(b?.mutation ?? 'Não informada');
  const catalogs = formCatalogs(state);
  const birds = state.birds.filter(bird => bird.scope === scope);
  const photo = state.attachments.find(a => a.scope === scope && a.id === b?.photoId);
  const parentOptions = (sex: Bird['sex']) => <><option value="">Não informado</option>{birds.filter(bird => bird.id !== b?.id && bird.sex === sex).map(bird => <option key={bird.id} value={bird.id}>{birdLabel(bird)}</option>)}</>;
  const dateInput = (name: string, defaultValue: string, required = false) => <DateInput name={name} defaultValue={defaultValue} required={required} max={today()}/>;
  async function save(form: FormData) {
    const principalPhoto = pending.find(file => file.role === 'photo');
    const data = {
      id: b?.id, identification: value(form, 'identification'), name: value(form, 'name'), species: value(form, 'species'), scientificName: b?.scientificName ?? '',
      sex: value(form, 'sex'), sexMethod: value(form, 'sexMethod') === 'Não informado' ? '' : value(form, 'sexMethod'), sexSource: value(form, 'sexSource'), sexDate: value(form, 'sexDate'), sexNotes: '',
      mutation: value(form, 'mutation'), certainty: value(form, 'certainty') || 'informada', carriers: value(form, 'carriers'), mutationSource: 'Informação registrada pelo criador', mutationDate: value(form, 'mutationDate'), mutationNotes: '',
      visualDescription: b?.visualDescription ?? '', microchip: b?.microchip ?? '', birthDate: value(form, 'birthDate'), birthEstimated: form.has('birthEstimated'), fatherId: nullable(form, 'fatherId'), motherId: nullable(form, 'motherId'),
      origin: value(form, 'origin'), breeder: form.has('breeder') ? value(form, 'breeder') : b?.breeder ?? '', supplierId: form.has('supplierId') ? nullable(form, 'supplierId') : b?.supplierId ?? null, acquiredDate: form.has('acquiredDate') ? value(form, 'acquiredDate') : b?.acquiredDate ?? '', acquisitionMethod: form.has('acquisitionMethod') ? value(form, 'acquisitionMethod') : b?.acquisitionMethod ?? '', acquisitionCents: b?.acquisitionCents ?? 0, priceCents: b?.priceCents,
      enclosure: value(form, 'enclosure'), responsible: b?.responsible ?? '', status: value(form, 'status'), statusDate: today(), statusReason: 'Situação atualizada no cadastro da ave', custodyDate: today(), custodyReason: 'Recinto ou responsável atualizado no cadastro da ave', photoId: removedPhoto ? null : b?.photoId ?? null, notes: value(form, 'notes'),
      booklet: {
        ...b?.booklet,
        ...(principalPhoto ? { photoDate: principalPhoto.date } : {}),
        individualCode: b?.booklet?.individualCode ?? '', ring: b?.booklet?.ring ?? '', clutchReference: value(form, 'clutchReference'),
        ringingDate: value(form, 'ringingDate'), nestExitDate: value(form, 'nestExitDate'), weaningDate: value(form, 'weaningDate'), foodIndependenceDate: value(form, 'foodIndependenceDate'), rearingType: value(form, 'rearingType'), currentDiet: value(form, 'currentDiet'),
      },
    };
    return command('save.withAttachments', { action: 'saveBird', data, attachments: pending });
  }
  function revealInvalid(event: InvalidEvent<HTMLDivElement>) {
    let section = event.target instanceof HTMLElement ? event.target.closest('details') : null;
    while (section) { section.open = true; section = section.parentElement?.closest('details') ?? null; }
  }
  const knownSpecies = [...new Set([...state.settings.speciesCatalog.filter(species => species.active).map(species => species.name), ...(b?.species ? [b.species] : [])])];
  return <RecordDialog title={b ? 'Editar ave' : 'Cadastrar ave'} onClose={onClose} onSave={save} preparing={preparing}>
    <div className="bird-registration-sections" onInvalidCapture={revealInvalid}>
    <fieldset className="record-form-section bird-registration-basics"><legend>Dados principais</legend><div className="grid form-grid">
      <Field label="Identificação ou anilha *"><input name="identification" defaultValue={b?.identification} required maxLength={150}/></Field>
      <Field label="Espécie *"><select name="species" defaultValue={b?.species ?? ''} required><option value="">Selecione</option>{knownSpecies.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Sexo *"><select name="sex" defaultValue={b?.sex ?? 'indeterminado'}><option value="indeterminado">Indeterminado</option><option value="macho">Macho</option><option value="fêmea">Fêmea</option></select></Field>
      <Field label="Origem *"><select name="origin" value={origin} onChange={e => setOrigin(e.target.value)} required>{[...new Set(['Não informada', 'Reprodução', 'Aquisição', ...(b?.origin ? [b.origin] : [])])].map(o => <option key={o}>{o}</option>)}</select></Field>
      <Field label="Situação"><select name="status" defaultValue={b?.status ?? 'manejo'}>{birdStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Nome"><input name="name" defaultValue={b?.name}/></Field>
      <Field label="Nascimento">{dateInput('birthDate', b?.birthDate ?? '')}</Field>
      <label className="field check-field"><span>Nascimento estimado</span><input name="birthEstimated" type="checkbox" defaultChecked={b?.birthEstimated}/></label>
    </div><p className="muted">Use a identificação real ou provisória que você conhece. Sexo desconhecido é permitido; complete os detalhes da ficha depois.</p></fieldset>
    <fieldset className="record-form-section"><legend>Foto da ave</legend>
      <PrincipalPhotoPicker value={pending} onChange={setPending} current={removedPhoto ? undefined : photo} onRemove={() => setRemovedPhoto(true)} onBusy={setPreparing}/>
    </fieldset>
    <details className="record-form-section"><summary>Genética, sexagem e fontes</summary><div className="grid form-grid">
      <Field label="Método da sexagem"><select name="sexMethod" defaultValue={b?.sexMethod || 'Não informado'}>{[...new Set([...catalogs.sexMethods, ...(b?.sexMethod ? [b.sexMethod] : [])])].map(m => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Fonte ou profissional"><input name="sexSource" defaultValue={b?.sexSource}/></Field>
      <Field label="Data do registro de sexagem">{dateInput('sexDate', today(), true)}</Field>
      <Field label="Mutação declarada *"><select name="mutation" value={mutation} onChange={e => setMutation(e.target.value)} required>{[...new Set(['Não informada', ...catalogs.mutations, ...(b?.mutation ? [b.mutation] : [])])].map(m => <option key={m}>{m}</option>)}</select></Field>
      {mutation !== 'Não informada' && mutation.trim() && <Field label="Condição da informação"><select name="certainty" defaultValue={b?.certainty ?? 'informada'}><option value="observada">Observada</option><option value="informada">Informada</option><option value="confirmada">Confirmada</option></select></Field>}
      <Field label="Portadores declarados"><input name="carriers" defaultValue={b?.carriers}/></Field>
      <Field label="Data do registro">{dateInput('mutationDate', today(), true)}</Field>
    </div><p className="muted">Correções preservam o histórico. As informações de mutação e portadores são declaradas, sem inferência automática. </p></details>
    <details className="record-form-section"><summary>Parentesco</summary><div className="grid form-grid">

      <Field label="Pai"><select name="fatherId" defaultValue={b?.fatherId ?? ''}>{parentOptions('macho')}</select></Field>
      <Field label="Mãe"><select name="motherId" defaultValue={b?.motherId ?? ''}>{parentOptions('fêmea')}</select></Field>
    </div></details>
    {origin === 'Aquisição' && <details open className="record-form-section"><summary>Procedência e aquisição</summary><div className="grid form-grid">
      <Field label="Criador de origem"><input name="breeder" defaultValue={b?.breeder}/></Field>
      <Field label="Fornecedor"><select name="supplierId" defaultValue={b?.supplierId ?? ''}><option value="">Não informado</option>{state.contacts.filter(c => c.scope === scope && c.kind === 'fornecedor').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Data de aquisição">{dateInput('acquiredDate', b?.acquiredDate ?? '')}</Field>
      <Field label="Forma de aquisição"><input name="acquisitionMethod" defaultValue={b?.acquisitionMethod}/></Field>
    </div></details>}
    <details className="record-form-section"><summary>Desenvolvimento e alimentação para a caderneta</summary><div className="grid form-grid">
      <Field label="Referência da ninhada"><input name="clutchReference" defaultValue={b?.booklet?.clutchReference}/></Field>
      <Field label="Data do anilhamento">{dateInput('ringingDate', b?.booklet?.ringingDate ?? '')}</Field>
      <Field label="Saída do ninho">{dateInput('nestExitDate', b?.booklet?.nestExitDate ?? '')}</Field>
      <Field label="Desmame">{dateInput('weaningDate', b?.booklet?.weaningDate ?? '')}</Field>
      <Field label="Autonomia alimentar">{dateInput('foodIndependenceDate', b?.booklet?.foodIndependenceDate ?? '')}</Field>
      <Field label="Tipo de criação"><select name="rearingType" defaultValue={b?.booklet?.rearingType ?? 'desconhecida'}><option value="desconhecida">Não informado</option><option value="pais">Pelos pais</option><option value="manual">Manual</option><option value="mista">Mista</option></select></Field>
      <Field label="Alimentação atual"><textarea name="currentDiet" defaultValue={b?.booklet?.currentDiet}/></Field>
    </div></details>
    <details className="record-form-section"><summary>Recinto e observações</summary><div className="grid form-grid">
      <Field label="Recinto"><select name="enclosure" defaultValue={b?.enclosure ?? ''}><option value="">Não informado</option>{enclosureOptions(state, scope).filter(e => !['manutenção', 'fora de uso'].includes(e.status) || e.name === b?.enclosure).map(e => <option key={e.id} value={e.name}>{e.name}</option>)}</select></Field>
      <Field label="Observações"><textarea name="notes" defaultValue={b?.notes}/></Field>
    </div></details>
    </div>
  </RecordDialog>;
}
