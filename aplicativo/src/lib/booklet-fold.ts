import { PDFDocument, PDFTextField, rgb, type PDFFont } from 'pdf-lib';
import type { Scope, State } from '../domain/types';
import { dateLabel } from '../domain/shared';
import { base64ToBytes, sha256 } from '../domain/documents';
import { loadFont } from './exports';
import { deriveBookletFields, printablePhoto, type BookletFieldSpec, type DigitalBookletFields } from './booklet';

export const tutorBookletSections: { title: string; fields: BookletFieldSpec[] }[] = [
  { title: 'Identificação', fields: [
    { key: 'bird_name', label: 'Nome escolhido pelo tutor' },
    { key: 'bird_species', label: 'Espécie' }, { key: 'bird_scientific_name', label: 'Nome científico' },
    { key: 'birth_date', label: 'Nascimento', type: 'date' },
    { key: 'delivery_weight', label: 'Último peso registrado (g)' },
    { key: 'sex_information', label: 'Sexo', type: 'choice', options: [{value:'macho',label:'Macho'}, {value:'femea',label:'Fêmea'}, {value:'desconhecido',label:'Desconhecido'}] },
    { key: 'sex_method_source', label: 'Método de sexagem' }, { key: 'bird_mutation', label: 'Cor / mutação' },
  ] },
];
export const clinicalBookletLimit = 10;
export function currentTutorBookletFields(state: State, scope: Scope, birdId: string): DigitalBookletFields {
  const fields = deriveBookletFields(state, scope, birdId, '', false);
  const bird = state.birds.find(b => b.scope === scope && b.id === birdId);
  const weights = state.health.filter(h => h.scope === scope && h.birdId === birdId && h.weightGrams !== null).sort((a,b) => b.date.localeCompare(a.date));
  return { ...fields, bird_name: bird?.booklet?.fieldOverrides?.bird_name ?? fields.bird_name,
    delivery_weight: weights[0] ? String(weights[0].weightGrams) : '', tutor_name: '', tutor_phone: '' };
}
export function selectedClinicalFields(state: State, scope: Scope, birdId: string, ids: string[]): DigitalBookletFields {
  if (ids.length > clinicalBookletLimit) throw new Error('Selecione até dez registros clínicos para este modelo.');
  const records = ids.map(id => state.health.find(h => h.scope === scope && h.birdId === birdId && h.id === id)).filter(h => h !== undefined).sort((a,b) => a.date.localeCompare(b.date));
  const fields: DigitalBookletFields = {};
  for (let n = 1; n <= clinicalBookletLimit; n++) {
    const record = records[n - 1];
    fields[`clinical_${n}_date`] = record?.date ?? '';
    fields[`clinical_${n}_record`] = record ? [record.kind, record.title, record.notes].filter(Boolean).join(' · ') : '';
    fields[`clinical_${n}_professional`] = record?.professional ?? '';
  }
  return fields;
}
const mapping: Record<string,string> = { nome:'bird_name', data_nascimento:'birth_date', ultimo_peso_g:'delivery_weight', especie:'bird_species', nome_cientifico:'bird_scientific_name', sexo:'sex_information', metodo_sexagem:'sex_method_source', cor_mutacao:'bird_mutation' };
function valueFor(name: string, fields: DigitalBookletFields) {
  // Tutor and observations boxes intentionally remain blank for handwritten completion.
  const row = /^registro_(\d+)_(data|ocorrencia|profissional)$/.exec(name);
  const key = mapping[name] ?? (row ? `clinical_${Number(row[1])}_${({data:'date',ocorrencia:'record',profissional:'professional'} as Record<string,string>)[row[2]]}` : '');
  let value = key ? fields[key] ?? '' : '';
  if ((name === 'data_nascimento' || row?.[2] === 'data') && /^\d{4}-\d{2}-\d{2}$/.test(value)) value = dateLabel(value);
  if (name === 'sexo') value = ({macho:'Macho',femea:'Fêmea',desconhecido:'Desconhecido'} as Record<string,string>)[value] ?? value;
  return value;
}
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (font.widthOfTextAtSize(word, size) > width) throw new Error('Uma palavra é longa demais para o espaço do modelo.');
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next,size) > width) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
export async function exportFoldableBooklet(state: State, scope: Scope, birdId: string, options: { fields?: DigitalBookletFields; includePhoto?: boolean } = {}, resources: {templateBytes?: Uint8Array; fontBytes?: Uint8Array} = {}): Promise<Uint8Array> {
  const bird = state.birds.find(b => b.scope === scope && b.id === birdId);
  if (!bird) throw new Error('Selecione uma ave da base atual.');
  const fields = { ...currentTutorBookletFields(state,scope,birdId), ...options.fields };
  let template = resources.templateBytes;
  if (!template) { const response = await fetch('./templates/Caderneta_Recanto_Simplificada_App.pdf'); if (!response.ok) throw new Error('O modelo da caderneta não pôde ser carregado.'); template = new Uint8Array(await response.arrayBuffer()); }
  const pdf = await PDFDocument.load(template, {updateMetadata:false});
  if (pdf.getPageCount() !== 2) throw new Error('O modelo da caderneta está incompleto.');
  const {default:fontkit} = await import('@pdf-lib/fontkit'); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(resources.fontBytes ?? await loadFont(), {subset:false, features:{liga:false,clig:false}});
  const ink = rgb(.02,.286,.451), form = pdf.getForm();
  for (const field of [...form.getFields()]) {
    if (!(field instanceof PDFTextField)) throw new Error('O modelo contém um campo não reconhecido.');
    const widget = field.acroField.getWidgets()[0];
    if (!widget) throw new Error('Um campo do modelo está incompleto.');
    const page = pdf.getPages().find(p => p.ref === widget.P());
    if (!page) throw new Error('Um campo não pertence a uma página.');
    const name = field.getName(), rect = widget.getRectangle();
    const value = valueFor(name,fields).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim();
    let size = name.includes('_data') ? 8 : 10, lines: string[] = [];
    while (size >= 6) {
      try { lines = wrap(value,font,size,rect.width - 6); if (lines.length * size * 1.25 <= rect.height - 4) break; } catch { /* retry smaller */ }
      size -= .25;
    }
    if (size < 6) throw new Error(`O texto de “${name}” não cabe no modelo. Resuma antes de gerar.`);
    try { font.encodeText(value); } catch { throw new Error(`Retire os símbolos não suportados do campo “${name}”.`); }
    if (value) lines.forEach((line,index) => page.drawText(line,{ x:rect.x+3, y:rect.y+rect.height-3-size-index*size*1.25, size,font,color:ink }));
    form.removeField(field);
  }
  const file = options.includePhoto !== false && bird.photoId ? state.attachments.find(a => a.scope === scope && a.birdId === birdId && a.id === bird.photoId) : undefined;
  if (file) {
    const bytes = base64ToBytes(file.base64);
    if (sha256(bytes) !== file.sha256) throw new Error('A foto está danificada. Escolha outra foto.');
    const ready = await printablePhoto(bytes,file.mime), image = ready.mime === 'image/png' ? await pdf.embedPng(ready.bytes) : await pdf.embedJpg(ready.bytes);
    const rect = {x:454.5,y:204,width:130,height:180};
    const factor = Math.min(rect.width/image.width,rect.height/image.height), page = pdf.getPage(0);
    page.drawRectangle({...rect,color:rgb(1,1,1)});
    page.drawImage(image,{x:rect.x+(rect.width-image.width*factor)/2,y:rect.y+(rect.height-image.height*factor)/2,width:image.width*factor,height:image.height*factor});
  }
  const result = await PDFDocument.create();
  for (const page of await result.copyPages(pdf,[0,1])) result.addPage(page);
  result.setTitle(`Caderneta — ${fields.bird_name || bird.identification}`); result.setAuthor(state.settings.name); result.setCreator('Recanto das Asas');
  return result.save();
}
