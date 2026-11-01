import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { emptyState } from '../src/domain/types';
import { applyCommand } from '../src/domain/engine';
import { currentTutorBookletFields, selectedClinicalFields, exportFoldableBooklet } from '../src/lib/booklet-fold';

const resources = {
  templateBytes: new Uint8Array(readFileSync('public/templates/Caderneta_Recanto_Simplificada_App.pdf')),
  fontBytes: new Uint8Array(readFileSync('public/fonts/NotoSans-Regular-Static.ttf')),
};
function fixture() {
  const state = emptyState();
  const id = applyCommand(state, 'real', 'saveBird', { certainty:'observada', origin:'Não informada', identification: 'INTERNO-999', name: 'João', species: 'Calopsita', sex: 'macho', status: 'disponível', birthDate: '2025-01-01', scientificName: 'Nymphicus hollandicus', mutation: 'Arlequim' });
  if (typeof id !== 'string') throw new Error('Ave não criada');
  applyCommand(state, 'real', 'saveHealth', { title:'Registro', author:'Criatório', birdId:id, date:'2025-02-01', kind:'peso', weightGrams:90 });
  applyCommand(state, 'real', 'saveHealth', { title:'Registro', author:'Criatório', birdId:id, date:'2025-03-01', kind:'peso', weightGrams:105 });
  const clinicalId = applyCommand(state, 'real', 'saveHealth', { title:'Registro', author:'Criatório', birdId:id, date:'2025-03-02', kind:'consulta', notes:'Consulta selecionada' });
  if (typeof clinicalId !== 'string') throw new Error('Consulta não criada');
  return {state,id,clinicalId};
}
describe('modelo provisório da caderneta', () => {
  it('uses the most recent recorded weight, not the old delivery weight', () => {
    const {state,id} = fixture(); state.birds[0].booklet = {deliveryWeightGrams:80};
    expect(currentTutorBookletFields(state,'real',id).delivery_weight).toBe('105');
  });
  it('only copies explicitly selected clinical records for this bird', () => {
    const {state,id,clinicalId} = fixture();
    expect(selectedClinicalFields(state,'real',id,[]).clinical_1_record).toBe('');
    expect(selectedClinicalFields(state,'real',id,[clinicalId]).clinical_1_record).toContain('Consulta selecionada');
    expect(selectedClinicalFields(state,'demo',id,[clinicalId]).clinical_1_record).toBe('');
  });
  it('leaves tutor details blank and excludes ring and operational history', async () => {
    const {state,id,clinicalId} = fixture();
    const bytes = await exportFoldableBooklet(state,'real',id,{fields:{...selectedClinicalFields(state,'real',id,[clinicalId]),tutor_name:'TUTOR_PRIVADO',bird_ring:'INTERNO-999',current_diet:'ALIMENTAÇÃO_INTERNA'}},resources);
    writeFileSync('/tmp/caderneta-provisoria-qa.pdf',bytes);
    const text = execFileSync('pdftotext',['-layout','/tmp/caderneta-provisoria-qa.pdf','-'],{encoding:'utf8'});
    expect(text).toContain('João'); expect(text).toContain('105'); expect(text).toContain('Consulta selecionada');
    expect(text).not.toContain('TUTOR_PRIVADO'); expect(text).not.toContain('INTERNO-999'); expect(text).not.toContain('ALIMENTAÇÃO_INTERNA');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2); expect(pdf.getForm().getFields()).toHaveLength(0);
  });
});