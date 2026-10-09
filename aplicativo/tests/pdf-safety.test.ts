import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { deflateSync } from 'node:zlib';
import { assertPassivePdf } from '../src/lib/pdf-safety';
import { emptyState } from '../src/domain/types';
import { applyCommand } from '../src/domain/engine';
import { exportDigitalBooklet } from '../src/lib/booklet';
import { issuedPayload } from '../src/lib/exports';

describe('PDF object verification',()=>{
 it('caps decompression before allocating an oversized object stream',()=>{
  const compressed=deflateSync(Buffer.alloc(5*1024*1024,32));
  const bytes=Buffer.concat([Buffer.from(`%PDF-1.7\n1 0 obj << /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${compressed.length} >> stream\n`),compressed,Buffer.from('\nendstream endobj\n%%EOF')]);
  expect(()=>assertPassivePdf(bytes)).toThrow(/muito complexo/);
 });
 it('allows incidental /JS in image/content streams and ordinary literal text',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();
  pdf.context.register(pdf.context.stream(new TextEncoder().encode('Image bytes /JS (incidental), 5 0 obj /EmbeddedFile, endobj'),{Type:'XObject',Subtype:'Image'}));
  pdf.setTitle('Text mentioning /JavaScript is not an action');
  const passive=await pdf.save();expect(()=>assertPassivePdf(passive)).not.toThrow();
 });
 for(const compressed of [true,false])it(`rejects real JavaScript dictionaries with compressed objects=${compressed}`,async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addJavaScript('action','app.alert("script")');
  const bytes=await pdf.save({useObjectStreams:compressed});
  expect(()=>assertPassivePdf(bytes)).toThrow(/ações ativas/);
 });
 it('rejects embedded files while accepting ordinary compressed PDF objects',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();
  const passive=await pdf.save();expect(()=>assertPassivePdf(passive)).not.toThrow();
  await pdf.attach(new TextEncoder().encode('metadata'),'credentials.json');
  const embedded=await pdf.save();expect(()=>assertPassivePdf(embedded)).toThrow(/incorporados/);
 });
 it('rejects escaped active-action names and malformed object streams',()=>{
  const raw=new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog /J#53 (alert) >> endobj\n%%EOF');
  expect(()=>assertPassivePdf(raw)).toThrow(/ações ativas/);
  const bad=new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /ObjStm /N 1 /First 100 /Length 3 >> stream\nabc\nendstream endobj\n%%EOF');
  expect(()=>assertPassivePdf(bad)).toThrow(/PDF inválido|Estrutura/);
 });
 it('issues the digital design successfully after dropping the original credentials attachment',async()=>{
  const state=emptyState();const birdId=applyCommand(state,'real','saveBird',{identification:'PDF-001',name:'João',species:'Calopsita',sex:'macho',mutation:'Cinza',certainty:'informada',origin:'Cadastro'})!;
  const bytes=await exportDigitalBooklet(state,'real',birdId,{includePhoto:false},{
   templateBytes:new Uint8Array(readFileSync(new URL('../public/templates/Caderneta_Recanto_das_Asas_Digital_Vertical.pdf',import.meta.url))),
   fontBytes:new Uint8Array(readFileSync(new URL('../public/fonts/NotoSans-Regular-Static.ttf',import.meta.url))),
  });
  expect(()=>assertPassivePdf(bytes)).not.toThrow();
  applyCommand(state,'real','document.issue',{...issuedPayload(bytes,'caderneta.pdf','application/pdf'),birdId,saleId:null,kind:'Caderneta digital',title:'Caderneta João'});
  expect(state.documents).toHaveLength(1);expect(state.documents[0].size).toBe(bytes.length);
 });
});
