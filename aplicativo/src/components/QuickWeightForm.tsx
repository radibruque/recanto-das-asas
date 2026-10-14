import type { ModuleProps } from '../domain/types';
import { birdLabel, today } from '../domain/shared';
import { RecordDialog, RecordField as Field } from './RecordDialog';

export default function QuickWeightForm({ state, scope, command, birdId, onClose }: ModuleProps & { birdId: string; onClose: () => void }) {
  const bird = state.birds.find(record => record.scope === scope && record.id === birdId);
  if (!bird) return null;
  async function save(form: FormData) {
    return command('saveHealth', { birdId, kind: 'pesagem', title: 'Pesagem', date: String(form.get('date') ?? ''), weightGrams: Number(form.get('weightGrams')), notes: String(form.get('notes') ?? ''), author: 'Proprietário', professional: '', attachmentIds: [] });
  }
  return <RecordDialog title="Registrar peso" onClose={onClose} onSave={save}>
    <p className="quick-weight-bird"><strong>{birdLabel(bird)}</strong> · {bird.species}</p>
    <div className="grid form-grid">
      <Field label="Peso (gramas) *"><input name="weightGrams" type="number" inputMode="decimal" min="0.001" max="100000" step="any" required autoFocus/></Field>
      <Field label="Data da pesagem *"><input name="date" type="date" defaultValue={today()} required min={bird.birthDate || undefined} max={today()}/></Field>
    </div>
    <details className="record-form-section"><summary>Observações da pesagem</summary><Field label="Observações"><textarea name="notes"/></Field></details>
    <p className="muted">Ave e unidade já definidas. Esta pesagem aparece no mesmo histórico de Saúde e manejo.</p>
  </RecordDialog>;
}
