import { useState, type InvalidEvent } from 'react';
import type { Bird, ModuleProps } from '../domain/types';
import { birdLabel, moneyInput, parseMoney, speciesOptions, today } from '../domain/shared';
import { birdStatusOptions } from '../domain/breeding';
import { AttachmentPicker, AttachmentThumbnail } from './DirectAttachments';
import type { PendingAttachment } from './DirectAttachments';
import { RecordDialog, RecordField as Field } from './RecordDialog';

const value = (form: FormData, name: string) => String(form.get(name) ?? '');
const nullable = (form: FormData, name: string) => value(form, name) || null;

export default function BirdRegistrationForm({ bird: b, state, scope, command, onClose }: ModuleProps & { bird?: Bird; onClose: () => void }) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const birds = state.birds.filter(bird => bird.scope === scope);
  const photo = state.attachments.find(a => a.scope === scope && a.id === b?.photoId);
  const parentOptions = (sex: Bird['sex']) => <><option value="">Não informado</option>{birds.filter(bird => bird.id !== b?.id && bird.sex === sex).map(bird => <option key={bird.id} value={bird.id}>{birdLabel(bird)}</option>)}</>;
  const dateInput = (name: string, defaultValue: string, required = false) => <input type="date" name={name} defaultValue={defaultValue} required={required} max={today()}/>;
  async function save(form: FormData) {
    const principalPhoto = pending.find(file => file.role === 'photo');
    const data = {
      id: b?.id, identification: value(form, 'identification'), name: value(form, 'name'), species: value(form, 'species'), scientificName: value(form, 'scientificName'),
      sex: value(form, 'sex'), sexMethod: value(form, 'sexMethod'), sexSource: value(form, 'sexSource'), sexDate: value(form, 'sexDate'), sexNotes: value(form, 'sexNotes'),
      mutation: value(form, 'mutation'), certainty: value(form, 'certainty'), carriers: value(form, 'carriers'), mutationSource: value(form, 'mutationSource'), mutationDate: value(form, 'mutationDate'), mutationNotes: value(form, 'mutationNotes'),
      visualDescription: value(form, 'visualDescription'), microchip: value(form, 'microchip'), birthDate: value(form, 'birthDate'), birthEstimated: form.has('birthEstimated'), fatherId: nullable(form, 'fatherId'), motherId: nullable(form, 'motherId'),
      origin: value(form, 'origin'), breeder: value(form, 'breeder'), supplierId: nullable(form, 'supplierId'), acquiredDate: value(form, 'acquiredDate'), acquisitionMethod: value(form, 'acquisitionMethod'), acquisitionCents: parseMoney(value(form, 'acquisitionValue') || '0'), priceCents: value(form, 'priceValue') ? parseMoney(value(form, 'priceValue')) : undefined,
      enclosure: value(form, 'enclosure'), responsible: value(form, 'responsible'), status: value(form, 'status'), statusDate: today(), statusReason: 'Situação atualizada no cadastro da ave', custodyDate: today(), custodyReason: 'Recinto ou responsável atualizado no cadastro da ave', photoId: b?.photoId ?? null, notes: value(form, 'notes'),
      booklet: {
        ...b?.booklet,
        ...(principalPhoto ? { photoDate: principalPhoto.date } : {}),
        individualCode: value(form, 'individualCode'), ring: value(form, 'ring'), clutchReference: value(form, 'clutchReference'),
        ringingDate: value(form, 'ringingDate'), nestExitDate: value(form, 'nestExitDate'), weaningDate: value(form, 'weaningDate'), foodIndependenceDate: value(form, 'foodIndependenceDate'), rearingType: value(form, 'rearingType'), currentDiet: value(form, 'currentDiet'),
      },
    };
    return command('save.withAttachments', { action: 'saveBird', data, attachments: pending });
  }
  function revealInvalid(event: InvalidEvent<HTMLDivElement>) {
    let section = event.target instanceof HTMLElement ? event.target.closest('details') : null;
    while (section) { section.open = true; section = section.parentElement?.closest('details') ?? null; }
  }
  const knownSpecies = [...new Set([...speciesOptions, ...state.settings.speciesCatalog.filter(species => species.active).flatMap(species => [species.name, ...species.aliases]), ...birds.map(bird => bird.species)])];
  return <RecordDialog title={b ? 'Editar ave' : 'Cadastrar ave'} onClose={onClose} onSave={save} preparing={preparing}>
    <div className="bird-registration-sections" onInvalidCapture={revealInvalid}>
    <fieldset className="record-form-section bird-registration-basics"><legend>Dados principais</legend><div className="grid form-grid">
      <Field label="Identificação ou anilha *"><input name="identification" defaultValue={b?.identification} required maxLength={150}/></Field>
      <Field label="Espécie *"><input list="species-options" name="species" defaultValue={b?.species} required maxLength={150}/><datalist id="species-options">{knownSpecies.map(s => <option key={s} value={s}/>)}</datalist></Field>
      <Field label="Sexo *"><select name="sex" defaultValue={b?.sex ?? 'indeterminado'}><option value="indeterminado">Indeterminado</option><option value="macho">Macho</option><option value="fêmea">Fêmea</option></select></Field>
      <Field label="Origem *"><input name="origin" defaultValue={b?.origin ?? 'Não informada'} required/></Field>
      <Field label="Situação"><select name="status" defaultValue={b?.status ?? 'manejo'}>{birdStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Nome"><input name="name" defaultValue={b?.name}/></Field>
    </div><p className="muted">Use a identificação real ou provisória que você conhece. Sexo desconhecido é permitido; complete os detalhes da ficha depois.</p></fieldset>
    <details className="record-form-section"><summary>Foto e documentos da ave (opcional)</summary>
      {photo && <div className="bird-registration-photo"><p>Foto atual</p><AttachmentThumbnail attachment={photo} maxHeight={180}/></div>}
      <AttachmentPicker value={pending} onChange={setPending} onBusyChange={setPreparing} allowPhoto category="Cadastro de ave"/>
      <p className="muted">Envie fotos, comprovantes de origem e laudos aqui. A foto marcada como principal será usada na ficha e na caderneta.</p>
    </details>
    <details className="record-form-section"><summary>Genética, sexagem e fontes</summary><div className="grid form-grid">
      <Field label="Método da sexagem"><input name="sexMethod" defaultValue={b?.sexMethod}/></Field>
      <Field label="Fonte ou profissional"><input name="sexSource" defaultValue={b?.sexSource}/></Field>
      <Field label="Data do registro de sexagem">{dateInput('sexDate', today(), true)}</Field>
      <Field label="Observação da sexagem"><input name="sexNotes"/></Field>
      <Field label="Mutação declarada *"><input name="mutation" defaultValue={b?.mutation ?? 'Não informada'} required/></Field>
      <Field label="Condição da informação"><select name="certainty" defaultValue={b?.certainty ?? 'informada'}><option value="observada">Observada</option><option value="informada">Informada</option><option value="confirmada">Confirmada</option></select></Field>
      <Field label="Portadores declarados"><input name="carriers" defaultValue={b?.carriers}/></Field>
      <Field label="Fonte da informação"><input name="mutationSource"/></Field>
      <Field label="Data do registro">{dateInput('mutationDate', today(), true)}</Field>
      <Field label="Observações da informação"><input name="mutationNotes"/></Field>
      <Field label="Descrição visual"><textarea name="visualDescription" defaultValue={b?.visualDescription}/></Field>
    </div><p className="muted">Correções preservam o histórico. As informações de mutação e portadores são declaradas, sem inferência automática. Anexe laudos diretamente em Foto e documentos da ave.</p></details>
    <details className="record-form-section"><summary>Nascimento e parentesco</summary><div className="grid form-grid">
      <Field label="Nascimento">{dateInput('birthDate', b?.birthDate ?? '')}</Field>
      <label className="field check-field"><span>Nascimento estimado</span><input name="birthEstimated" type="checkbox" defaultChecked={b?.birthEstimated}/></label>
      <Field label="Pai"><select name="fatherId" defaultValue={b?.fatherId ?? ''}>{parentOptions('macho')}</select></Field>
      <Field label="Mãe"><select name="motherId" defaultValue={b?.motherId ?? ''}>{parentOptions('fêmea')}</select></Field>
    </div></details>
    <details className="record-form-section"><summary>Procedência e aquisição</summary><div className="grid form-grid">
      <Field label="Criador de origem"><input name="breeder" defaultValue={b?.breeder}/></Field>
      <Field label="Fornecedor"><select name="supplierId" defaultValue={b?.supplierId ?? ''}><option value="">Não informado</option>{state.contacts.filter(c => c.scope === scope && c.kind === 'fornecedor').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Data de aquisição">{dateInput('acquiredDate', b?.acquiredDate ?? '')}</Field>
      <Field label="Forma de aquisição"><input name="acquisitionMethod" defaultValue={b?.acquisitionMethod}/></Field>
      <Field label="Valor da aquisição (R$)"><input name="acquisitionValue" inputMode="decimal" defaultValue={moneyInput(b?.acquisitionCents ?? 0)}/></Field><Field label="Preço de venda (R$, opcional)"><input name="priceValue" inputMode="decimal" defaultValue={b?.priceCents ? moneyInput(b.priceCents) : ''} placeholder="Aparece no cartão da ave"/></Field>
    </div></details>
    <details className="record-form-section"><summary>Identificação complementar e caderneta</summary><div className="grid form-grid">
      <Field label="Nome científico"><input name="scientificName" defaultValue={b?.scientificName}/></Field>
      <Field label="Microchip"><input name="microchip" defaultValue={b?.microchip}/></Field>
      <Field label="Código individual para a caderneta"><input name="individualCode" defaultValue={b?.booklet?.individualCode}/></Field>
      <Field label="Anilha para a caderneta"><input name="ring" defaultValue={b?.booklet?.ring}/></Field>
    </div></details>
    <details className="record-form-section"><summary>Desenvolvimento e alimentação para a caderneta</summary><div className="grid form-grid">
      <Field label="Referência da ninhada"><input name="clutchReference" defaultValue={b?.booklet?.clutchReference}/></Field>
      <Field label="Data do anilhamento">{dateInput('ringingDate', b?.booklet?.ringingDate ?? '')}</Field>
      <Field label="Saída do ninho">{dateInput('nestExitDate', b?.booklet?.nestExitDate ?? '')}</Field>
      <Field label="Desmame">{dateInput('weaningDate', b?.booklet?.weaningDate ?? '')}</Field>
      <Field label="Autonomia alimentar">{dateInput('foodIndependenceDate', b?.booklet?.foodIndependenceDate ?? '')}</Field>
      <Field label="Tipo de criação"><select name="rearingType" defaultValue={b?.booklet?.rearingType ?? 'desconhecida'}><option value="desconhecida">Não informado</option><option value="pais">Pelos pais</option><option value="manual">Manual</option><option value="mista">Mista</option></select></Field>
      <Field label="Alimentação atual"><textarea name="currentDiet" defaultValue={b?.booklet?.currentDiet}/></Field>
    </div></details>
    <details className="record-form-section"><summary>Recinto, responsável e observações</summary><div className="grid form-grid">
      <Field label="Recinto"><input name="enclosure" defaultValue={b?.enclosure}/></Field>
      <Field label="Responsável atual"><input name="responsible" defaultValue={b?.responsible}/></Field>
      <Field label="Observações"><textarea name="notes" defaultValue={b?.notes}/></Field>
    </div></details>
    </div>
  </RecordDialog>;
}
