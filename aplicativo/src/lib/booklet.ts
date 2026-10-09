import { PDFDocument, PDFTextField, PDFCheckBox, rgb, type PDFFont } from 'pdf-lib';
import type { BirdBookletData, Scope, State } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import { base64ToBytes, sha256 } from '../domain/documents';
import { loadFont } from './exports';
import { imageDimensions } from './attachment-input';

export type DigitalBookletFields = Record<string, string>;
export type DigitalBookletOptions = { fields?: DigitalBookletFields; photoId?: string | null; includePhoto?: boolean };
export type BookletFieldSpec = { key: string; label: string; type?: 'date' | 'textarea' | 'choice'; options?: { value: string; label: string }[] };
const choices = (...items: [string, string][]) => items.map(([value, label]) => ({ value, label }));

/** Every input corresponds to a field in the owner's four-page digital design. */
export const digitalBookletSections: { title: string; fields: BookletFieldSpec[] }[] = [
  { title: 'Identificação', fields: [
    { key: 'bird_name', label: 'Nome da ave' }, { key: 'bird_id', label: 'Código individual' },
    { key: 'bird_ring', label: 'Anilha / identificação' }, { key: 'bird_microchip', label: 'Microchip' },
    { key: 'photo_date', label: 'Data da foto', type: 'date' }, { key: 'bird_species', label: 'Espécie / nome popular' },
    { key: 'bird_scientific_name', label: 'Nome científico' }, { key: 'birth_date', label: 'Nascimento / eclosão', type: 'date' },
    { key: 'birth_information', label: 'Informação sobre a data', type: 'choice', options: choices(['confirmada', 'Confirmada'], ['estimada', 'Estimada'], ['desconhecida', 'Desconhecida']) },
  ] },
  { title: 'Identidade e origem', fields: [
    { key: 'sex_information', label: 'Sexo', type: 'choice', options: choices(['macho', 'Macho'], ['femea', 'Fêmea'], ['desconhecido', 'Desconhecido']) },
    { key: 'sex_method_source', label: 'Fonte / método da sexagem' }, { key: 'sex_report_date', label: 'Data / laudo da sexagem', type: 'date' },
    { key: 'bird_mutation', label: 'Mutação / variedade de cor' },
    { key: 'mutation_information', label: 'Base da informação genética', type: 'choice', options: choices(['observada', 'Observada'], ['informada', 'Informada'], ['confirmada', 'Confirmada']) },
    { key: 'genetic_carriers_source', label: 'Portadores conhecidos / fonte' }, { key: 'visual_marks', label: 'Descrição visual / marcas particulares' },
    { key: 'origin_aviary', label: 'Criatório de nascimento / origem' }, { key: 'father_identity', label: 'Pai biológico (nome / ID)' },
    { key: 'mother_identity', label: 'Mãe biológica (nome / ID)' }, { key: 'clutch_id', label: 'Ninhada / postura de origem' },
    { key: 'origin_document', label: 'Documento de origem / referência' },
  ] },
  { title: 'Desenvolvimento', fields: [
    { key: 'ringing_date', label: 'Data do anilhamento', type: 'date' }, { key: 'nest_exit_date', label: 'Saída do ninho', type: 'date' },
    { key: 'weaning_date', label: 'Desmame concluído', type: 'date' }, { key: 'food_independence_date', label: 'Autonomia alimentar confirmada em', type: 'date' },
    { key: 'rearing_information', label: 'Tipo de criação', type: 'choice', options: choices(['pais', 'Pelos pais'], ['manual', 'Manual'], ['mista', 'Mista'], ['desconhecida', 'Desconhecida']) },
    ...Array.from({ length: 3 }, (_, i) => [
      { key: `weight_${i + 1}_date`, label: `Pesagem ${i + 1} — data`, type: 'date' as const },
      { key: `weight_${i + 1}_weight`, label: `Pesagem ${i + 1} — peso (g)` },
      { key: `weight_${i + 1}_notes`, label: `Pesagem ${i + 1} — observações / fase`, type: 'textarea' as const },
    ]).flat(),
    { key: 'current_diet', label: 'Alimentação atual / rotina', type: 'textarea' },
    { key: 'management_history', label: 'Manejo e histórico relevante', type: 'textarea' },
  ] },
  { title: 'Saúde e contatos', fields: [
    { key: 'medical_observations', label: 'Observações médicas importantes', type: 'textarea' },
    ...Array.from({ length: 2 }, (_, i) => [
      { key: `clinical_${i + 1}_date`, label: `Consulta / exame ${i + 1} — data`, type: 'date' as const },
      { key: `clinical_${i + 1}_record`, label: `Consulta / exame ${i + 1} — registro / conduta`, type: 'textarea' as const },
      { key: `clinical_${i + 1}_professional`, label: `Consulta / exame ${i + 1} — profissional / CRMV` },
    ]).flat(),
    { key: 'delivery_date', label: 'Data da entrega', type: 'date' }, { key: 'delivery_weight', label: 'Peso na entrega (g)' },
    { key: 'tutor_name', label: 'Tutor(a)' }, { key: 'tutor_phone', label: 'Telefone / WhatsApp do tutor' },
    { key: 'breeder_name', label: 'Responsável pelo criatório' }, { key: 'breeder_phone', label: 'Contato do criatório' },
    { key: 'vet_identity', label: 'Veterinário(a) / CRMV' }, { key: 'vet_emergency_phone', label: 'Telefone de emergência' },
  ] },
];
export const digitalBookletFieldKeys = digitalBookletSections.flatMap(section => section.fields.map(field => field.key));
const fieldSpecs = new Map(digitalBookletSections.flatMap(section => section.fields.map(field => [field.key, field] as const)));
const normal = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const joined = (...values: (string | undefined)[]) => values.filter(Boolean).join(' · ');

/** Unknown milestones remain blank; clinical conclusions are never inferred. */
export function deriveBookletFields(state: State, scope: Scope, birdId: string, saleId = '', useSaved = true): DigitalBookletFields {
  const bird = state.birds.find(value => value.id === birdId && value.scope === scope);
  if (!bird) throw new Error('Selecione uma ave da base atual.');
  const extra = bird.booklet || {};
  const parent = (id: string | null) => birdLabel(state.birds.find(value => value.id === id && value.scope === scope));
  const originClutch = state.eggs.find(value => value.scope === scope && value.chickId === bird.id)?.clutchId;
  const sale = state.sales.find(value => value.id === saleId && value.scope === scope && value.items.some(item => item.kind === 'ave' && item.refId === bird.id));
  const tutor = state.contacts.find(value => value.scope === scope && value.id === sale?.contactId);
  const photo = state.attachments.find(value => value.scope === scope && value.id === bird.photoId);
  const fields: DigitalBookletFields = Object.fromEntries(digitalBookletFieldKeys.map(key => [key, '']));
  Object.assign(fields, {
    bird_name: bird.name || 'Desconhecido', bird_id: extra.individualCode || bird.identification, bird_ring: extra.ring || bird.identification,
    bird_microchip: bird.microchip || 'Não informado', photo_date: extra.photoDate || photo?.date || '', bird_species: bird.species,
    bird_scientific_name: bird.scientificName || 'Desconhecido', birth_date: bird.birthDate,
    birth_information: !bird.birthDate ? 'desconhecida' : bird.birthEstimated ? 'estimada' : 'confirmada',
    sex_information: normal(bird.sex) === 'macho' ? 'macho' : normal(bird.sex) === 'femea' ? 'femea' : 'desconhecido',
    sex_method_source: joined(bird.sexMethod, bird.sexSource) || 'Desconhecido', sex_report_date: extra.sexReportDate || '',
    bird_mutation: bird.mutation || 'Desconhecida', mutation_information: normal(bird.certainty).includes('confirm') ? 'confirmada' : normal(bird.certainty).includes('observ') ? 'observada' : 'informada',
    genetic_carriers_source: joined(bird.carriers, extra.carriersSource) || 'Desconhecido', visual_marks: bird.visualDescription || 'Não informada',
    origin_aviary: joined(bird.breeder, bird.origin) || 'Desconhecido', father_identity: parent(bird.fatherId), mother_identity: parent(bird.motherId),
    clutch_id: extra.clutchReference || originClutch || 'Desconhecida', origin_document: extra.originDocument || 'Não informado',
    ringing_date: extra.ringingDate || '', nest_exit_date: extra.nestExitDate || '', weaning_date: extra.weaningDate || '',
    food_independence_date: extra.foodIndependenceDate || '', rearing_information: extra.rearingType || 'desconhecida',
    current_diet: extra.currentDiet || '', management_history: extra.managementHistory || '', medical_observations: extra.medicalObservations || '',
    delivery_date: sale?.deliveryDate || '', delivery_weight: extra.deliveryWeightGrams == null ? '' : String(extra.deliveryWeightGrams),
    tutor_name: extra.tutorName || tutor?.name || '', tutor_phone: extra.tutorPhone || tutor?.phone || '',
    breeder_name: extra.breederName || bird.responsible || state.settings.name, breeder_phone: extra.breederPhone || state.settings.phone,
    vet_identity: extra.vetIdentity || '', vet_emergency_phone: extra.vetEmergencyPhone || '',
  });
  const weights = state.health.filter(value => value.scope === scope && value.birdId === bird.id && value.weightGrams !== null).sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
  weights.forEach((value, index) => Object.assign(fields, { [`weight_${index + 1}_date`]: value.date, [`weight_${index + 1}_weight`]: String(value.weightGrams), [`weight_${index + 1}_notes`]: value.title }));
  // Consultations are added only by an explicit selection/review in the form.
  if (useSaved) for (const [key, value] of Object.entries(extra.fieldOverrides || {})) if (fieldSpecs.has(key) && typeof value === 'string') fields[key] = value;
  return fields;
}

export function bookletDataFromFields(fields: DigitalBookletFields, baseline?: DigitalBookletFields): BirdBookletData {
  const value = (key: string) => fields[key]?.trim() || '';
  const numericWeight = value('delivery_weight').replace(',', '.');
  if (numericWeight && (!Number.isFinite(Number(numericWeight)) || Number(numericWeight) <= 0)) throw new Error('Informe um peso na entrega maior que zero, ou deixe o campo vazio.');
  return {
    individualCode: value('bird_id'), ring: value('bird_ring'), photoDate: value('photo_date'), sexReportDate: value('sex_report_date'),
    originDocument: value('origin_document'), clutchReference: value('clutch_id'), ringingDate: value('ringing_date'), nestExitDate: value('nest_exit_date'),
    weaningDate: value('weaning_date'), foodIndependenceDate: value('food_independence_date'), rearingType: value('rearing_information') as BirdBookletData['rearingType'],
    currentDiet: value('current_diet'), managementHistory: value('management_history'), medicalObservations: value('medical_observations'),
    deliveryWeightGrams: numericWeight ? Number(numericWeight) : null, tutorName: value('tutor_name'), tutorPhone: value('tutor_phone'),
    breederName: value('breeder_name'), breederPhone: value('breeder_phone'), vetIdentity: value('vet_identity'), vetEmergencyPhone: value('vet_emergency_phone'),
    // Unedited automatic values stay live: a later weighing or changed name
    // appears on the next emission instead of being frozen by a previous PDF.
    fieldOverrides: Object.fromEntries(digitalBookletFieldKeys.filter(key => !baseline || value(key) !== (baseline[key]?.trim() || '')).map(key => [key, value(key)])),
  };
}

const checkboxMapping: Record<string, [string, string]> = {
  birth_known: ['birth_information', 'confirmada'], birth_estimated: ['birth_information', 'estimada'], birth_unknown: ['birth_information', 'desconhecida'],
  sex_male: ['sex_information', 'macho'], sex_female: ['sex_information', 'femea'], sex_unknown: ['sex_information', 'desconhecido'],
  mutation_observed: ['mutation_information', 'observada'], mutation_informed: ['mutation_information', 'informada'], mutation_confirmed: ['mutation_information', 'confirmada'],
  rearing_parents: ['rearing_information', 'pais'], rearing_manual: ['rearing_information', 'manual'], rearing_mixed: ['rearing_information', 'mista'], rearing_unknown: ['rearing_information', 'desconhecida'],
};
export const bookletPhotoRectangle = { x: 36.8504, y: 235.2756, width: 124.7244, height: 155.9055 };

function cleanText(value: string, label: string, font: PDFFont): string {
  const text = value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\r\n/g, '\n').trim();
  if (text.length > 4096) throw new Error(`O campo “${label}” excede o limite. Resuma o conteúdo antes de emitir.`);
  try { font.encodeText(text); } catch { throw new Error(`O campo “${label}” contém símbolos não disponíveis na fonte. Use texto sem emojis.`); }
  return text;
}
function wrapText(value: string, font: PDFFont, size: number, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      // Long references are split by character, never silently clipped.
      const segments: string[] = []; let segment = '';
      for (const character of word) { if (segment && font.widthOfTextAtSize(segment + character, size) > width) { segments.push(segment); segment = ''; } segment += character; }
      if (segment) segments.push(segment);
      for (const part of segments) { if (line && font.widthOfTextAtSize(`${line} ${part}`, size) > width) { result.push(line); line = part; } else line = line ? `${line} ${part}` : part; }
    }
    result.push(line);
  }
  return result;
}

/** Shrink old large images before decoding/embedding where the browser permits it. */
async function printablePhoto(bytes: Uint8Array, mime: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const dimensions = imageDimensions(bytes, mime);
  if (!dimensions || !dimensions.width || !dimensions.height) throw new Error('Não foi possível reconhecer a foto da ave. Anexe outra imagem.');
  if (dimensions.width > 20000 || dimensions.height > 20000 || dimensions.width * dimensions.height > 64_000_000) throw new Error('A foto tem resolução muito alta. Anexe uma foto menor antes de emitir.');
  if (Math.max(dimensions.width, dimensions.height) <= 1280) return { bytes, mime };
  if (typeof document === 'undefined') throw new Error('Prepare uma foto com até 1280 pixels antes de emitir neste ambiente.');
  const ratio = Math.min(1, 1280 / Math.max(dimensions.width, dimensions.height));
  const width = Math.max(1, Math.round(dimensions.width * ratio)), height = Math.max(1, Math.round(dimensions.height * ratio));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a foto para a caderneta.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  try {
    if (typeof createImageBitmap === 'function') {
      const image = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
      try { context.drawImage(image, 0, 0, width, height); } finally { image.close(); }
    } else {
      if (dimensions.width * dimensions.height > 20_000_000) throw new Error('Neste aparelho, escolha uma foto com até 20 megapixels.');
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image(); image.src = url;
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível preparar a foto da ave.')); });
        context.drawImage(image, 0, 0, width, height);
      } finally { URL.revokeObjectURL(url); }
    }
    const reduced = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível preparar a foto da ave.')), 'image/jpeg', .88));
    return { bytes: new Uint8Array(await reduced.arrayBuffer()), mime: 'image/jpeg' };
  } finally { canvas.width = 1; canvas.height = 1; }
}

export async function exportDigitalBooklet(state: State, scope: Scope, birdId: string, options: DigitalBookletOptions = {}, resources: { templateBytes?: Uint8Array; fontBytes?: Uint8Array } = {}): Promise<Uint8Array> {
  const bird = state.birds.find(value => value.scope === scope && value.id === birdId);
  if (!bird) throw new Error('Selecione uma ave da base atual.');
  const fields = { ...deriveBookletFields(state, scope, birdId), ...options.fields };
  const templateBytes = resources.templateBytes || await fetch('/templates/Caderneta_Recanto_das_Asas_Digital_Vertical.pdf').then(async response => { if (!response.ok) throw new Error('O modelo da caderneta não pôde ser carregado.'); return new Uint8Array(await response.arrayBuffer()); });
  if (!templateBytes?.length) throw new Error('O modelo digital da caderneta está vazio.');
  const pdf = await PDFDocument.load(templateBytes, { updateMetadata: false });
  if (pdf.getPageCount() !== 4) throw new Error('O modelo digital da caderneta está incompleto.');
  const { default: fontkit } = await import('@pdf-lib/fontkit'); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(resources.fontBytes || await loadFont(), { subset: false, features: { liga: false, clig: false } });
  const form = pdf.getForm();
  const ink = rgb(.141176, .231373, .282353);
  // Drawing directly avoids font-dependent widget appearances and leaves a
  // compact, immutable digital PDF. The original borders/design stay intact.
  for (const field of [...form.getFields()]) {
    const name = field.getName(); const widgets = field.acroField.getWidgets();
    const widget = widgets[0]; if (!widget) throw new Error('Um campo do modelo está incompleto.');
    const pageRef = widget.P(); const page = pdf.getPages().find(value => value.ref === pageRef);
    if (!page) throw new Error('Um campo do modelo não está vinculado à página.');
    const rect = widget.getRectangle();
    if (field instanceof PDFTextField) {
      const spec = fieldSpecs.get(name); if (!spec) throw new Error(`Campo desconhecido no modelo: ${name}.`);
      const rawValue = fields[name] || '';
      const value = cleanText(spec.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? dateLabel(rawValue) : rawValue, spec.label, font);
      let size = name === 'bird_name' ? 11 : 9; let lines: string[] = [];
      const width = rect.width - 4, height = rect.height - 3;
      while (size >= 6) { lines = wrapText(value, font, size, width); if (lines.length * size * 1.3 <= height && lines.every(line => font.widthOfTextAtSize(line, size) <= width)) break; size -= .25; }
      if (size < 6) throw new Error(`O campo “${spec.label}” não cabe no espaço da caderneta. Resuma o texto antes de emitir; o conteúdo não será cortado.`);
      if (value) lines.forEach((line, index) => page.drawText(line, { x: rect.x + 2, y: rect.y + rect.height - 1.5 - size - index * size * 1.3, size, font, color: ink }));
    } else if (field instanceof PDFCheckBox) {
      const mapping = checkboxMapping[name]; if (!mapping) throw new Error(`Opção desconhecida no modelo: ${name}.`);
      if (fields[mapping[0]] === mapping[1]) {
        page.drawLine({ start: { x: rect.x + 1.5, y: rect.y + rect.height / 2 }, end: { x: rect.x + rect.width * .42, y: rect.y + 1.5 }, thickness: .9, color: ink });
        page.drawLine({ start: { x: rect.x + rect.width * .42, y: rect.y + 1.5 }, end: { x: rect.x + rect.width - 1.2, y: rect.y + rect.height - 1.3 }, thickness: .9, color: ink });
      }
    }
    form.removeField(field);
  }
  const photoId = options.photoId === undefined ? bird.photoId : options.photoId;
  if (options.includePhoto !== false && photoId) {
    const photo = state.attachments.find(value => value.id === photoId && value.scope === scope && value.birdId === bird.id);
    if (!photo || !['image/png', 'image/jpeg'].includes(photo.mime)) throw new Error('A foto da ave não está disponível. Selecione outra foto ou emita sem foto.');
    const original = base64ToBytes(photo.base64); if (sha256(original) !== photo.sha256) throw new Error('A integridade da foto não pôde ser confirmada. Anexe a foto novamente.');
    const prepared = await printablePhoto(original, photo.mime);
    const image = prepared.mime === 'image/png' ? await pdf.embedPng(prepared.bytes) : await pdf.embedJpg(prepared.bytes);
    if (image.width <= 0 || image.height <= 0 || image.width * image.height > 64_000_000) throw new Error('A foto é grande demais para a caderneta. Anexe uma foto menor.');
    const rect = bookletPhotoRectangle, page = pdf.getPage(0), factor = Math.min(rect.width / image.width, rect.height / image.height);
    page.drawRectangle({ ...rect, color: rgb(1, 1, 1) });
    page.drawImage(image, { x: rect.x + (rect.width - image.width * factor) / 2, y: rect.y + (rect.height - image.height * factor) / 2, width: image.width * factor, height: image.height * factor });
    // Restore the four blue photo guides, keeping the photograph inside them.
    const guideColor = rgb(.160784, .666667, .917647), length = 11.3386;
    for (const dx of [0, rect.width]) for (const dy of [0, rect.height]) {
      const x = rect.x + dx, y = rect.y + dy;
      page.drawLine({ start: { x, y }, end: { x: x + (dx ? -length : length), y }, thickness: .65, color: guideColor });
      page.drawLine({ start: { x, y }, end: { x, y: y + (dy ? -length : length) }, thickness: .65, color: guideColor });
    }
  }
  if (scope === 'demo') pdf.getPages().forEach(page => page.drawText('DEMONSTRAÇÃO', { x: 292, y: 574, font, size: 7, color: ink }));
  // Copy only completed pages into a fresh document. The owner's original
  // design contains a C2PA credentials attachment in the catalogue; that
  // metadata must not be inherited by an app-issued document. This also drops
  // discarded form objects rather than serialising every original object.
  const result = await PDFDocument.create();
  for (const page of await result.copyPages(pdf, [0, 1, 2, 3])) result.addPage(page);
  result.setTitle(`Caderneta digital — ${bird.name || bird.identification}`); result.setAuthor(state.settings.name); result.setCreator('Recanto das Asas'); result.setProducer('Recanto das Asas');
  const bytes = await result.save({ useObjectStreams: true });
  if (bytes.length < 1000 || bytes.length > 8 * 1024 * 1024) throw new Error('O PDF excedeu o tamanho seguro de emissão. Anexe uma foto menor.');
  return bytes;
}
