import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { Scope, State } from '../domain/types';
import { dateLabel } from '../domain/shared';
import { base64ToBytes, sha256 } from '../domain/documents';
import { loadFont } from './exports';
import { deriveBookletFields, printablePhoto, type BookletFieldSpec, type DigitalBookletFields } from './booklet';

const choices = (...items: [string, string][]) => items.map(([value, label]) => ({ value, label }));

/** Only what a tutor needs, in the order of the folded booklet (capa, identificação, cuidados, contatos). */
export const tutorBookletSections: { title: string; fields: BookletFieldSpec[] }[] = [
  { title: 'Identificação', fields: [
    { key: 'bird_name', label: 'Nome da ave' }, { key: 'bird_species', label: 'Espécie' }, { key: 'bird_scientific_name', label: 'Nome científico' },
    { key: 'bird_ring', label: 'Anilha' }, { key: 'bird_microchip', label: 'Microchip' },
    { key: 'birth_date', label: 'Nascimento', type: 'date' },
    { key: 'birth_information', label: 'Data de nascimento', type: 'choice', options: choices(['confirmada', 'Confirmada'], ['estimada', 'Estimada'], ['desconhecida', 'Desconhecida']) },
    { key: 'sex_information', label: 'Sexo', type: 'choice', options: choices(['macho', 'Macho'], ['femea', 'Fêmea'], ['desconhecido', 'Ainda não definido']) },
    { key: 'sex_method_source', label: 'Como o sexo foi definido' }, { key: 'bird_mutation', label: 'Cor / mutação' },
    { key: 'visual_marks', label: 'Marcas particulares' },
  ] },
  { title: 'Cuidados e saúde', fields: [
    { key: 'rearing_information', label: 'Criação', type: 'choice', options: choices(['pais', 'Pelos pais'], ['manual', 'Na mão'], ['mista', 'Mista'], ['desconhecida', 'Não informada']) },
    { key: 'current_diet', label: 'Alimentação e rotina', type: 'textarea' },
    { key: 'management_history', label: 'Recomendações ao tutor', type: 'textarea' },
    { key: 'medical_observations', label: 'Observações de saúde', type: 'textarea' },
    ...Array.from({ length: 2 }, (_, i) => [
      { key: `clinical_${i + 1}_date`, label: `Consulta / exame ${i + 1} — data`, type: 'date' as const },
      { key: `clinical_${i + 1}_record`, label: `Consulta / exame ${i + 1} — resultado`, type: 'textarea' as const },
      { key: `clinical_${i + 1}_professional`, label: `Consulta / exame ${i + 1} — veterinário(a)` },
    ]).flat(),
    ...Array.from({ length: 3 }, (_, i) => [
      { key: `weight_${i + 1}_date`, label: `Pesagem ${i + 1} — data`, type: 'date' as const },
      { key: `weight_${i + 1}_weight`, label: `Pesagem ${i + 1} — peso (g)` },
    ]).flat(),
  ] },
  { title: 'Entrega e contatos', fields: [
    { key: 'delivery_date', label: 'Data da entrega', type: 'date' }, { key: 'delivery_weight', label: 'Peso na entrega (g)' },
    { key: 'tutor_name', label: 'Tutor(a)' }, { key: 'tutor_phone', label: 'Telefone do tutor' },
    { key: 'origin_aviary', label: 'Criatório de origem' }, { key: 'father_identity', label: 'Pai' }, { key: 'mother_identity', label: 'Mãe' },
    { key: 'breeder_name', label: 'Responsável pelo criatório' }, { key: 'breeder_phone', label: 'Contato do criatório' },
    { key: 'vet_identity', label: 'Veterinário(a) / CRMV' }, { key: 'vet_emergency_phone', label: 'Telefone de emergência' },
  ] },
];

const ink = rgb(0.043, 0.133, 0.212), navy = rgb(0.02, 0.286, 0.451), teal = rgb(0.027, 0.561, 0.659), sun = rgb(0.984, 0.78, 0.196);
const mist = rgb(0.953, 0.965, 0.976), muted = rgb(0.4, 0.47, 0.53), line = rgb(0.86, 0.89, 0.92), white = rgb(1, 1, 1);
const W = 841.89, H = 595.28, P = W / 2;

const choiceLabel = (key: string, value: string) => tutorBookletSections.flatMap(s => s.fields).find(f => f.key === key)?.options?.find(o => o.value === value)?.label ?? value;
const show = (fields: DigitalBookletFields, key: string, type?: string) => { const v = (fields[key] ?? '').trim(); if (!v) return '—'; if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dateLabel(v); return choiceLabel(key, v); };

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const attempt = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) <= width) { current = attempt; continue; }
      if (current) out.push(current);
      let chunk = '';
      for (const ch of word) { if (font.widthOfTextAtSize(chunk + ch, size) > width) { out.push(chunk); chunk = ''; } chunk += ch; }
      current = chunk;
    }
    out.push(current);
  }
  return out;
}

type Ctx = { page: PDFPage; font: PDFFont; title: PDFFont };
function header(c: Ctx, x: number, label: string, number: string) {
  c.page.drawRectangle({ x: x + 24, y: H - 74, width: P - 48, height: 46, color: navy, opacity: 1 });
  c.page.drawText(label, { x: x + 40, y: H - 57, size: 17, font: c.title, color: white });
  c.page.drawText(number, { x: x + P - 58, y: H - 56, size: 10, font: c.font, color: sun });
}
/** Label/value rows in two columns; long text wraps and shrinks, never gets cut silently. */
function rows(c: Ctx, x: number, top: number, items: { label: string; value: string; wide?: boolean }[]) {
  let y = top; const colW = (P - 64) / 2; let col = 0; let rowHeight = 0;
  for (const item of items) {
    const width = item.wide ? P - 72 : colW - 8;
    if (item.wide && col === 1) { y -= rowHeight; col = 0; rowHeight = 0; }
    let size = 9.5; let lines = wrap(item.value, c.font, size, width - 16);
    while (lines.length > 6 && size > 6.5) { size -= 0.5; lines = wrap(item.value, c.font, size, width - 16); }
    if (lines.length > 6) throw new Error(`O texto de “${item.label}” não cabe na caderneta. Resuma um pouco antes de gerar.`);
    const h = 22 + lines.length * size * 1.3;
    const bx = x + 32 + (item.wide ? 0 : col * colW);
    c.page.drawRectangle({ x: bx, y: y - h, width, height: h, color: mist, borderColor: line, borderWidth: 0.6 });
    c.page.drawText(item.label.toUpperCase(), { x: bx + 8, y: y - 12, size: 6.5, font: c.font, color: teal });
    lines.forEach((l, i) => c.page.drawText(l, { x: bx + 8, y: y - 24 - i * size * 1.3, size, font: c.font, color: ink }));
    if (item.wide) { y -= h + 6; col = 0; rowHeight = 0; continue; }
    rowHeight = Math.max(rowHeight, h + 6);
    if (col === 1) { y -= rowHeight; col = 0; rowHeight = 0; } else col = 1;
  }
  if (col === 1) y -= rowHeight;
  if (y < 40) throw new Error('As informações não cabem na caderneta. Resuma os textos maiores antes de gerar.');
  return y;
}
function foldGuide(page: PDFPage, font: PDFFont) {
  for (let y = 12; y < H - 12; y += 10) page.drawLine({ start: { x: P, y }, end: { x: P, y: y + 4 }, thickness: 0.4, color: line });
  page.drawText('dobre aqui', { x: P + 4, y: 10, size: 5.5, font, color: muted });
}

async function fetchBytes(path: string) { const r = await fetch(path); if (!r.ok) throw new Error('Um arquivo da identidade visual não pôde ser carregado.'); return new Uint8Array(await r.arrayBuffer()); }

/**
 * Folded booklet: one A4 sheet printed on both sides, folded in half.
 * Page 1 (outside): contacts (back cover) | front cover. Page 2 (inside): identification | care.
 */
export async function exportFoldableBooklet(state: State, scope: Scope, birdId: string, options: { fields?: DigitalBookletFields; includePhoto?: boolean } = {}): Promise<Uint8Array> {
  const bird = state.birds.find(b => b.scope === scope && b.id === birdId);
  if (!bird) throw new Error('Selecione uma ave da base atual.');
  const fields = { ...deriveBookletFields(state, scope, birdId), ...options.fields };
  const pdf = await PDFDocument.create();
  const { default: fontkit } = await import('@pdf-lib/fontkit'); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFont(), { subset: false, features: { liga: false, clig: false } });
  const title = await pdf.embedFont(await fetchBytes('/fonts/Fraunces.ttf'), { subset: true }).catch(() => font);
  pdf.setTitle(`Caderneta — ${fields.bird_name || bird.identification}`); pdf.setProducer('Recanto das Asas'); pdf.setCreator('Recanto das Asas');
  let logo: PDFImage | null = null;
  try { logo = await pdf.embedPng(await fetchBytes('/artes/01_Principal/Logo_Colorida_Transparente_1254px.png')); } catch { logo = null; }
  let photo: PDFImage | null = null;
  const photoFile = options.includePhoto !== false && bird.photoId ? state.attachments.find(a => a.scope === scope && a.id === bird.photoId) : undefined;
  if (photoFile) {
    const raw = base64ToBytes(photoFile.base64);
    if (sha256(raw) !== photoFile.sha256) throw new Error('A foto principal está danificada. Anexe a foto de novo.');
    const ready = await printablePhoto(raw, photoFile.mime);
    photo = ready.mime === 'image/png' ? await pdf.embedPng(ready.bytes) : await pdf.embedJpg(ready.bytes);
  }

  // ---- Outside: back cover (left) + front cover (right)
  const outside = pdf.addPage([W, H]);
  const o: Ctx = { page: outside, font, title };
  outside.drawRectangle({ x: P, y: 0, width: P, height: H, color: navy });
  outside.drawRectangle({ x: P, y: 0, width: P, height: 150, color: ink, opacity: 0.55 });
  if (logo) { const s = logo.scale(150 / logo.width); outside.drawRectangle({ x: P + (P - 190) / 2, y: H - 205, width: 190, height: 170, color: white }); outside.drawImage(logo, { x: P + (P - s.width) / 2, y: H - 195, width: s.width, height: s.height }); }
  outside.drawText('CADERNETA DO PET', { x: P + 40, y: H - 238, size: 10, font, color: sun });
  outside.drawText(fields.bird_name || bird.identification, { x: P + 40, y: H - 270, size: 26, font: title, color: white });
  outside.drawText(`${show(fields, 'bird_species')}`.slice(0, 70), { x: P + 40, y: H - 290, size: 10, font, color: white });
  const frame = { x: P + 40, y: 170, w: P - 80, h: 120 };
  if (photo) {
    const ratio = Math.min(frame.w / photo.width, frame.h / photo.height);
    const w = photo.width * ratio, h = photo.height * ratio;
    outside.drawRectangle({ x: frame.x + (frame.w - w) / 2 - 3, y: frame.y + (frame.h - h) / 2 - 3, width: w + 6, height: h + 6, color: white });
    outside.drawImage(photo, { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2, width: w, height: h });
  } else outside.drawRectangle({ x: frame.x, y: frame.y, width: frame.w, height: frame.h, borderColor: white, borderWidth: 0.8, borderDashArray: [4, 4] });
  outside.drawText(`Anilha ${show(fields, 'bird_ring')}`, { x: P + 40, y: 120, size: 11, font, color: white });
  outside.drawText(`Nascimento ${show(fields, 'birth_date', 'date')}`, { x: P + 40, y: 102, size: 11, font, color: white });
  outside.drawText(state.settings.name || 'Recanto das Asas', { x: P + 40, y: 40, size: 9, font, color: sun });

  header(o, 0, 'Entrega e contatos', '4');
  rows(o, 0, H - 90, [
    { label: 'Data da entrega', value: show(fields, 'delivery_date', 'date') }, { label: 'Peso na entrega', value: fields.delivery_weight ? `${fields.delivery_weight} g` : '—' },
    { label: 'Tutor(a)', value: show(fields, 'tutor_name') }, { label: 'Telefone do tutor', value: show(fields, 'tutor_phone') },
    { label: 'Criatório de origem', value: show(fields, 'origin_aviary'), wide: true },
    { label: 'Pai', value: show(fields, 'father_identity') }, { label: 'Mãe', value: show(fields, 'mother_identity') },
    { label: 'Responsável pelo criatório', value: show(fields, 'breeder_name') }, { label: 'Contato do criatório', value: show(fields, 'breeder_phone') },
    { label: 'Veterinário(a) / CRMV', value: show(fields, 'vet_identity') }, { label: 'Emergência', value: show(fields, 'vet_emergency_phone') },
  ]);
  outside.drawText('Em caso de dúvida sobre a saúde da ave, procure um veterinário de aves.', { x: 32, y: 30, size: 7.5, font, color: muted });
  foldGuide(outside, font);

  // ---- Inside: identification (left) + care (right)
  const inside = pdf.addPage([W, H]);
  const i: Ctx = { page: inside, font, title };
  header(i, 0, 'Identificação', '2');
  rows(i, 0, H - 90, [
    { label: 'Nome', value: show(fields, 'bird_name') }, { label: 'Anilha', value: show(fields, 'bird_ring') },
    { label: 'Espécie', value: show(fields, 'bird_species'), wide: true },
    { label: 'Nome científico', value: show(fields, 'bird_scientific_name') }, { label: 'Microchip', value: show(fields, 'bird_microchip') },
    { label: 'Nascimento', value: `${show(fields, 'birth_date', 'date')} (${show(fields, 'birth_information').toLowerCase()})` }, { label: 'Sexo', value: show(fields, 'sex_information') },
    { label: 'Como o sexo foi definido', value: show(fields, 'sex_method_source') }, { label: 'Cor / mutação', value: show(fields, 'bird_mutation') },
    { label: 'Marcas particulares', value: show(fields, 'visual_marks'), wide: true },
  ]);
  header(i, P, 'Cuidados e saúde', '3');
  const weights = [1, 2, 3].map(n => fields[`weight_${n}_weight`] ? `${show(fields, `weight_${n}_date`, 'date')}: ${fields[`weight_${n}_weight`]} g` : '').filter(Boolean).join('   ·   ');
  const clinical = [1, 2].map(n => fields[`clinical_${n}_record`] || fields[`clinical_${n}_date`] ? `${show(fields, `clinical_${n}_date`, 'date')} — ${fields[`clinical_${n}_record`] || ''}${fields[`clinical_${n}_professional`] ? ` (${fields[`clinical_${n}_professional`]})` : ''}` : '').filter(Boolean).join('\n');
  rows(i, P, H - 90, [
    { label: 'Criação', value: show(fields, 'rearing_information') }, { label: 'Pesagens', value: weights || '—' },
    { label: 'Alimentação e rotina', value: show(fields, 'current_diet'), wide: true },
    { label: 'Recomendações ao tutor', value: show(fields, 'management_history'), wide: true },
    { label: 'Observações de saúde', value: show(fields, 'medical_observations'), wide: true },
    { label: 'Consultas e exames', value: clinical || '—', wide: true },
  ]);
  foldGuide(inside, font);
  inside.drawText('Imprima frente e verso (virar pela borda curta) e dobre ao meio.', { x: 32, y: 14, size: 6, font, color: muted });
  return pdf.save();
}
