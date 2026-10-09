import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PDFDocument, PDFName } from 'pdf-lib';
import { bookletDataFromFields, deriveBookletFields, digitalBookletFieldKeys, exportDigitalBooklet } from '../src/lib/booklet';
import { emptyState, type Bird } from '../src/domain/types';
import { bytesToBase64, sha256 } from '../src/domain/documents';

const templateBytes = new Uint8Array(readFileSync(new URL('../public/templates/Caderneta_Recanto_das_Asas_Digital_Vertical.pdf', import.meta.url)));
const fontBytes = new Uint8Array(readFileSync(new URL('../public/fonts/NotoSans-Regular-Static.ttf', import.meta.url)));
const resources = { templateBytes, fontBytes };
function fixture() {
  const state = emptyState();
  const bird: Bird = { id: randomUUID(), scope: 'real', identification: 'RDA-001', name: 'João', species: 'Calopsita', sex: 'macho', mutation: 'Arlequim', certainty: 'observada', carriers: '', origin: 'Nascimento no criatório', notes: 'OBSERVAÇÃO_INTERNA_PRIVADA', birthDate: '2025-01-01', fatherId: null, motherId: null, createdAt: '2025-01-01T12:00:00Z', status: 'disponível', scientificName: 'Nymphicus hollandicus', microchip: '', sexMethod: 'Exame', sexSource: 'Laboratório', visualDescription: 'Penugem amarela', birthEstimated: false, breeder: 'Recanto', supplierId: null, acquiredDate: '2025-01-01', acquisitionCents: 998877, enclosure: 'A1', responsible: 'Administrador', photoId: null, statusHistory: [], booklet: { currentDiet: 'Alimentação registrada pelo criador', rearingType: 'manual' } };
  state.birds.push(bird);
  for (let index = 0; index < 5; index++) state.health.push({ id: `health-${index}`, scope: 'real', birdId: bird.id, date: `2025-02-0${index + 1}`, kind: 'consulta', title: `Pesagem ${index + 1}`, notes: 'CLÍNICA_PRIVADA_NÃO_SELECIONADA', weightGrams: 90 + index, professional: 'Dra. Maria', author: 'Criador', attachmentIds: [] });
  return { state, bird };
}
function text(bytes: Uint8Array) {
  const directory = mkdtempSync(join(tmpdir(), 'rda-digital-booklet-'));
  try { const path = join(directory, 'caderneta.pdf'); writeFileSync(path, bytes); return execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}
async function renderContainsInk(bytes: Uint8Array) {
  const directory = mkdtempSync(join(tmpdir(), 'rda-digital-render-'));
  try {
    const path = join(directory, 'caderneta.pdf'); writeFileSync(path, bytes);
    // Check the filled first-page NAME area, not the pre-existing design title.
    const script = "import fitz,sys;d=fitz.open(sys.argv[1]);p=d[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(190,211,389,241),colorspace=fitz.csGRAY);print(sum(v<180 for v in p.samples))";
    return Number(execFileSync('python', ['-c', script, path], { encoding: 'utf8' }).trim());
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe('caderneta digital no design fornecido', () => {
  it('derives all editable design fields without guessing milestones or exposing private notes', () => {
    const { state, bird } = fixture(), fields = deriveBookletFields(state, 'real', bird.id);
    expect(Object.keys(fields).sort()).toEqual([...digitalBookletFieldKeys].sort());
    expect(fields).toMatchObject({ bird_name: 'João', birth_information: 'confirmada', rearing_information: 'manual', ringing_date: '', tutor_name: '', clinical_1_record: '', weight_1_weight: '92', weight_3_weight: '94' });
    expect(JSON.stringify(fields)).not.toContain('OBSERVAÇÃO_INTERNA_PRIVADA');
    expect(JSON.stringify(fields)).not.toContain('CLÍNICA_PRIVADA_NÃO_SELECIONADA');
    expect(JSON.stringify(fields)).not.toContain('998877');
  });
  it('preserves reviewed fields and explicitly refreshes them from the registration', () => {
    const { state, bird } = fixture(); bird.booklet!.fieldOverrides = { bird_name: 'Nome do tutor', clinical_1_record: 'Registro clínico revisado', unexpected: 'IGNORAR' };
    const fields = deriveBookletFields(state, 'real', bird.id);
    expect(fields.bird_name).toBe('Nome do tutor'); expect(fields.clinical_1_record).toBe('Registro clínico revisado'); expect(fields).not.toHaveProperty('unexpected');
    expect(deriveBookletFields(state, 'real', bird.id, '', false).bird_name).toBe('João');
    const saved = bookletDataFromFields(fields); expect(saved.fieldOverrides?.clinical_1_record).toBe('Registro clínico revisado');
    expect(() => bookletDataFromFields({ ...fields, delivery_weight: 'peso inválido' })).toThrow(/peso/);
  });
  it('keeps future weights automatic while retaining deliberate text corrections', () => {
    const { state, bird } = fixture(); const baseline = deriveBookletFields(state, 'real', bird.id, '', false);
    bird.booklet = { ...bird.booklet, ...bookletDataFromFields({ ...baseline, bird_name: 'Nome revisto' }, baseline) };
    expect(bird.booklet.fieldOverrides).toEqual({ bird_name: 'Nome revisto' });
    state.health.push({ ...state.health[0], id: 'weight-new', date: '2025-03-01', weightGrams: 105, title: 'Peso atualizado' });
    expect(deriveBookletFields(state, 'real', bird.id)).toMatchObject({ bird_name: 'Nome revisto', weight_3_weight: '105', weight_3_date: '2025-03-01' });
  });
  it('generates four vertical pages, real visible accents, no editable widgets and a bounded nonempty PDF', async () => {
    const { state, bird } = fixture(); const fields = { ...deriveBookletFields(state, 'real', bird.id), tutor_name: 'Márcia Gonçalves', medical_observations: 'Observações revisadas: saúde estável.', clinical_1_date: '2025-03-01', clinical_1_record: 'Exame revisado', clinical_1_professional: 'Dra. Maria / CRMV 1234' };
    const bytes = await exportDigitalBooklet(state, 'real', bird.id, { fields }, resources), pdf = await PDFDocument.load(bytes);
    if (process.env.RECANTO_BOOKLET_QA) writeFileSync('/tmp/caderneta-digital-qa.pdf', bytes);
    expect(bytes.length).toBeGreaterThan(1000); expect(bytes.length).toBeLessThan(3 * 1024 * 1024);
    expect(pdf.getPageCount()).toBe(4); expect(pdf.getPage(0).getSize()).toEqual({ width: expect.closeTo(420.9449), height: expect.closeTo(595.2756) }); expect(pdf.getForm().getFields()).toHaveLength(0);
    expect(pdf.catalog.has(PDFName.of('AF'))).toBe(false); expect(new TextDecoder('latin1').decode(bytes)).not.toContain('/EmbeddedFile');
    const extracted = text(bytes); expect(extracted).toContain('João'); expect(extracted).toContain('Márcia Gonçalves'); expect(extracted).toContain('Observações revisadas'); expect(extracted).toContain('01/03/2025'); expect(extracted).not.toContain('CLÍNICA_PRIVADA_NÃO_SELECIONADA');
    expect(await renderContainsInk(bytes)).toBeGreaterThan(100);
  });
  it('refuses overflowing text with a named field instead of clipping or producing empty output', async () => {
    const { state, bird } = fixture();
    await expect(exportDigitalBooklet(state, 'real', bird.id, { fields: { bird_id: 'Identificação longa '.repeat(300) } }, resources)).rejects.toThrow(/Código individual/);
    await expect(exportDigitalBooklet(state, 'real', bird.id, { fields: { medical_observations: 'Registro de observações extensas '.repeat(100) } }, resources)).rejects.toThrow(/Observações médicas/);
  });
  it('places the photo inside the exact template frame and preserves its aspect ratio', async () => {
    const { state, bird } = fixture();
    const directory = mkdtempSync(join(tmpdir(), 'rda-photo-'));
    try {
      const path = join(directory, 'foto.png'); execFileSync('python', ['-c', 'from PIL import Image;import sys;Image.new("RGB",(200,100),(255,0,0)).save(sys.argv[1])', path]);
      const photo = new Uint8Array(readFileSync(path)); bird.photoId = 'photo';
      state.attachments.push({ id: 'photo', scope: 'real', birdId: bird.id, contactId: null, saleId: null, title: 'Foto de João', category: 'Foto', date: '2025-02-01', issuer: '', reference: '', validUntil: '', notes: '', shareWithCustomer: false, fileName: 'foto.png', mime: 'image/png', size: photo.length, base64: bytesToBase64(photo), version: 1, previousId: null, sha256: sha256(photo) });
      const bytes = await exportDigitalBooklet(state, 'real', bird.id, {}, resources); const output = join(directory, 'caderneta.pdf'); writeFileSync(output, bytes);
      if (process.env.RECANTO_BOOKLET_QA) writeFileSync('/tmp/caderneta-digital-foto-qa.pdf', bytes);
      const script = 'import fitz,json,sys;d=fitz.open(sys.argv[1]);p=d[0];r=[i["bbox"] for i in p.get_image_info() if i["width"]==200];print(json.dumps(r))';
      const rectangles: number[][] = JSON.parse(execFileSync('python', ['-c', script, output], { encoding: 'utf8' }));
      expect(rectangles).toHaveLength(1); const [x1, y1, x2, y2] = rectangles[0];
      expect(x1).toBeCloseTo(36.8504, 2); expect(x2).toBeCloseTo(161.5748, 2); expect(y1).toBeGreaterThan(204.0944); expect(y2).toBeLessThan(360.0001); expect((x2 - x1) / (y2 - y1)).toBeCloseTo(2, 3);
      const extracted = text(bytes); expect(extracted).toContain('01/02/2025');
      state.attachments[0].sha256 = '0'.repeat(64); await expect(exportDigitalBooklet(state, 'real', bird.id, {}, resources)).rejects.toThrow(/integridade/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('rejects missing and cross-base birds before loading external resources', async () => {
    const { state, bird } = fixture();
    await expect(exportDigitalBooklet(state, 'demo', bird.id, {}, resources)).rejects.toThrow(/base atual/);
    await expect(exportDigitalBooklet(state, 'real', 'missing', {}, resources)).rejects.toThrow(/base atual/);
  });
});
