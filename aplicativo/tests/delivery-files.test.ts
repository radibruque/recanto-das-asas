import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { applyCommand } from '../src/domain/engine';
import { deliveryCandidates } from '../src/domain/commercial';
import { bytesToBase64, sha256 } from '../src/domain/documents';
import { today } from '../src/domain/shared';
import { emptyState } from '../src/domain/types';
import { prepareDeliveryFiles } from '../src/lib/delivery-files';
import { zipFiles } from '../src/lib/exports';

const scope = 'demo' as const, date = today();
async function fixture() {
  const state = emptyState();
  const birdId = applyCommand(state, scope, 'saveBird', { identification: 'FICTICIA-ENTREGA', species: 'Calopsita', sex: 'indeterminado', mutation: 'Teste', certainty: 'informada', origin: 'Teste isolado', status: 'disponível' })!;
  const contactId = applyCommand(state, scope, 'contact.save', { kind: 'cliente', name: 'Tutor fictício isolado' })!;
  const saleId = applyCommand(state, scope, 'sale.save', { contactId, date, status: 'vendida', notes: 'CUSTO-INTERNO-FICTICIO-NAO-EXPORTAR', items: [{ kind: 'ave', refId: birdId, description: 'Ave de teste', quantity: 1, unitCents: 100000 }], installments: [{ dueDate: date, amountCents: 100000 }] })!;
  const add = (title: string, shared = true, linked = true) => {
    const bytes = new TextEncoder().encode(`Conteúdo público isolado: ${title}`);
    const attachmentId = applyCommand(state, scope, 'attachment.add', { title, category: 'Teste', date, notes: 'ANOTACAO-INTERNA-NAO-EXPORTAR', shareWithCustomer: shared, saleId: linked ? saleId : null, fileName: 'arquivo.txt', mime: 'text/plain', size: bytes.length, base64: bytesToBase64(bytes), sha256: sha256(bytes) })!;
    return { attachmentId, bytes };
  };
  const publicOne = add('Documento público A'), publicTwo = add('Documento público B');
  const privateFile = add('Documento privado', false), unlinked = add('Documento de outra operação', true, false);
  const pdf = await PDFDocument.create(); pdf.addPage([120, 120]); const pdfBytes = await pdf.save();
  const issue = (kind: string) => applyCommand(state, scope, 'document.issue', { birdId, saleId, title: kind, kind, fileName: `${kind.replaceAll(' ', '_')}.pdf`, mime: 'application/pdf', size: pdfBytes.length, base64: bytesToBase64(pdfBytes), sha256: sha256(pdfBytes) })!;
  const bookletId = issue('Caderneta digital'), receiptId = issue('Recibo de pagamento'), internalId = issue('Relatório');
  return { state, saleId, publicOne, publicTwo, privateFile, unlinked, bookletId, receiptId, internalId, issue };
}

describe('revisão e recuperação dos originais de uma entrega', () => {
  it('busca somente metadados de arquivos autorizados e documentos do tutor', async () => {
    const { state, saleId, publicOne, privateFile, unlinked, bookletId, receiptId, internalId } = await fixture();
    for (const record of [...state.attachments, ...state.documents]) Object.defineProperty(record, 'base64', { get: () => { throw new Error('O conteúdo completo não deve ser lido para listar.'); } });
    const candidates = deliveryCandidates(state, scope, saleId);
    expect(candidates.some(record => record.id === publicOne.attachmentId)).toBe(true);
    expect(candidates.some(record => record.id === bookletId)).toBe(true);
    expect(candidates.some(record => record.id === receiptId)).toBe(true);
    for (const recordId of [privateFile.attachmentId, unlinked.attachmentId, internalId]) expect(candidates.some(record => record.id === recordId)).toBe(false);
  });
  it('preserva bytes originais, evita colisão de nomes e não inclui notas internas no ZIP', async () => {
    const { state, saleId, publicOne, publicTwo } = await fixture();
    const files = await prepareDeliveryFiles(state, scope, saleId, [{ type: 'attachment', id: publicOne.attachmentId }, { type: 'attachment', id: publicTwo.attachmentId }]);
    expect(files.map(record => record.name)).toEqual(['01_arquivo.txt', '02_arquivo.txt']);
    const zip = await JSZip.loadAsync(await zipFiles(files));
    expect(Object.keys(zip.files)).toHaveLength(2);
    expect(await zip.file('01_arquivo.txt')!.async('uint8array')).toEqual(publicOne.bytes);
    expect(await zip.file('02_arquivo.txt')!.async('uint8array')).toEqual(publicTwo.bytes);
    expect(await zip.file('01_arquivo.txt')!.async('string')).not.toContain('INTERNO');
  });
  it('rejeita arquivo privado, duplicado e conteúdo corrompido antes de preparar o pacote', async () => {
    const { state, saleId, publicOne, privateFile } = await fixture();
    await expect(prepareDeliveryFiles(state, scope, saleId, [{ type: 'attachment', id: privateFile.attachmentId }])).rejects.toThrow(/seleção/);
    await expect(prepareDeliveryFiles(state, scope, saleId, [{ type: 'attachment', id: publicOne.attachmentId }, { type: 'attachment', id: publicOne.attachmentId }])).rejects.toThrow(/mais de uma vez/);
    state.attachments.find(record => record.id === publicOne.attachmentId)!.base64 = bytesToBase64(new TextEncoder().encode('Arquivo alterado indevidamente.'));
    await expect(prepareDeliveryFiles(state, scope, saleId, [{ type: 'attachment', id: publicOne.attachmentId }])).rejects.toThrow(/integridade/);
  });
  it('recupera a seleção exata da entrega mesmo após nova emissão e edição da autorização atual', async () => {
    const { state, saleId, publicOne, bookletId, issue } = await fixture();
    const files = [{ type: 'attachment' as const, id: publicOne.attachmentId }, { type: 'document' as const, id: bookletId }];
    applyCommand(state, scope, 'sale.transition', { id: saleId, status: 'entregue', date, reason: 'Entrega fictícia', deliveryFiles: files });
    const originalManifest = structuredClone(state.sales[0].deliveryManifest);
    state.attachments.find(record => record.id === publicOne.attachmentId)!.shareWithCustomer = false;
    const laterBooklet = issue('Caderneta digital');
    const originals = await prepareDeliveryFiles(state, scope, saleId, files, true);
    expect(originals).toHaveLength(2);
    expect(originals[0].bytes).toEqual(publicOne.bytes);
    expect(state.sales[0].deliveryManifest).toEqual(originalManifest);
    await expect(prepareDeliveryFiles(state, scope, saleId, [{ type: 'document', id: laterBooklet }], true)).rejects.toThrow(/seleção/);
    applyCommand(state, scope, 'sale.transition', { id: saleId, status: 'devolvida', date, reason: 'Devolução fictícia sem recebimento anterior' });
    expect((await prepareDeliveryFiles(state, scope, saleId, files, true))[0].bytes).toEqual(publicOne.bytes);
    expect(state.sales[0].deliveryManifest).toEqual(originalManifest);
  });
  it('limita o pacote antes de decodificar anexos grandes', async () => {
    const { state, saleId, publicOne } = await fixture();
    const record = state.attachments.find(record => record.id === publicOne.attachmentId)!;
    record.size = 41 * 1024 * 1024;
    Object.defineProperty(record, 'base64', { get: () => { throw new Error('Não deve decodificar conteúdo antes do limite.'); } });
    await expect(prepareDeliveryFiles(state, scope, saleId, [{ type: 'attachment', id: record.id }])).rejects.toThrow(/40 MB/);
  });
});
