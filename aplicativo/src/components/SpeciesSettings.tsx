import { useState } from 'react';
import type { ModuleProps, Species } from '../domain/types';
import { RecordDialog, RecordField } from './RecordDialog';

const parameter = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? '').trim();
  return value === '' ? null : Number(value);
};

export default function SpeciesSettings({ state, command, notify }: ModuleProps) {
  const [editing, setEditing] = useState<Species | 'new' | null>(null);
  const current = editing && editing !== 'new' ? editing : undefined;
  const catalogue = [...state.settings.speciesCatalog].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const days = (value: number | null) => value == null ? 'Não configurado' : `${value} dias`;
  return <section className="card stack settings-card species-settings">
    <div className="row"><h2 className="section-title">Espécies e parâmetros</h2><button type="button" className="button" onClick={() => setEditing('new')}>Adicionar espécie</button></div>
    <p>Use os nomes existentes e configure somente parâmetros com uma fonte conferida. Campos em branco permanecem não configurados. Espécies de grafia diferente continuam separadas.</p>
    <div className="species-list">{catalogue.map(species => <article className="species-row" key={species.id}>
      <div><strong>{species.name}</strong><small>{species.active ? 'Ativa' : 'Inativa'}{species.aliases.length > 0 && ` · Grafias anteriores: ${species.aliases.join(', ')}`}</small><small>{species.parameterSource || 'Fonte não informada'}</small></div>
      <div><small>Incubação estimada</small><span>{days(species.incubationDays)}</span></div>
      <div><small>Avaliação do ovo</small><span>{days(species.eggCheckDays)}</span></div>
      <div><small>Acompanhamento do filhote</small><span>{days(species.chickFollowupDays)}</span></div>
      <button type="button" className="button secondary" aria-label={`Editar espécie ${species.name}`} onClick={() => setEditing(species)}>Editar</button>
    </article>)}</div>
    {editing && <RecordDialog title={current ? 'Editar espécie e parâmetros' : 'Adicionar espécie'} onClose={() => setEditing(null)} onSave={async form => {
      const result = await command('species.save', { id: current?.id, name: String(form.get('name')), incubationDays: parameter(form, 'incubationDays'), eggCheckDays: parameter(form, 'eggCheckDays'), chickFollowupDays: parameter(form, 'chickFollowupDays'), parameterSource: String(form.get('parameterSource')), active: form.has('active') });
      if (result) notify('Espécie e parâmetros salvos. Identificação e grafias dos registros anteriores preservadas.');
      return result;
    }}>
      <RecordField label="Nome da espécie *"><input name="name" defaultValue={current?.name ?? ''} required maxLength={150}/></RecordField>
      <div className="grid form-grid">{[['incubationDays', 'Incubação estimada (dias)'], ['eggCheckDays', 'Avaliação do ovo após postura (dias)'], ['chickFollowupDays', 'Acompanhamento após eclosão (dias)']].map(([name, label]) => <RecordField label={label} key={name}><input name={name} type="number" min={1} max={365} step={1} defaultValue={current?.[name as 'incubationDays' | 'eggCheckDays' | 'chickFollowupDays'] ?? ''}/></RecordField>)}</div>
      <RecordField label="Fonte dos parâmetros"><textarea name="parameterSource" defaultValue={current?.parameterSource ?? ''} maxLength={10000} placeholder="Referência ou informação conferida pelo criador"/></RecordField>
      <label className="check"><input type="checkbox" name="active" defaultChecked={current?.active ?? true}/>Espécie ativa no catálogo</label>
      <p className="muted">Os prazos organizam o acompanhamento; não são diagnóstico, prescrição ou curva clínica. Nenhum parâmetro é preenchido automaticamente.</p>
    </RecordDialog>}
  </section>;
}
