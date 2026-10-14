import { deliveryCandidates } from '../domain/commercial';
import { base64ToBytes, sha256 } from '../domain/documents';
import type { Scope, State } from '../domain/types';

export type DeliverySelection = { type: 'attachment' | 'document'; id: string };
export const deliverySelectionKey = (value: DeliverySelection) => `${value.type}:${value.id}`;

/** Resolve bytes only for the explicitly selected originals, never for search/list metadata. */
export async function prepareDeliveryFiles(state: State, scope: Scope, saleId: string, selected: DeliverySelection[], delivered = false) {
  const sale = state.sales.find(record => record.id === saleId && record.scope === scope);
  if (!sale) throw new Error('Operação não encontrada nesta base.');
  if (!selected.length) throw new Error('Selecione ao menos um arquivo para baixar.');
  if (selected.length > 20) throw new Error('Selecione até 20 arquivos por pacote.');
  const candidates = delivered ? sale.deliveryManifest ?? [] : deliveryCandidates(state, scope, saleId);
  const eligible = new Map(candidates.map(record => [deliverySelectionKey(record), record]));
  const used = new Set<string>();
  const sources = selected.map(reference => {
    const key = deliverySelectionKey(reference);
    if (used.has(key)) throw new Error('Um arquivo foi selecionado mais de uma vez.');
    used.add(key);
    const expected = eligible.get(key);
    const source = reference.type === 'attachment' ? state.attachments.find(record => record.scope === scope && record.id === reference.id) : state.documents.find(record => record.scope === scope && record.id === reference.id);
    if (!expected || !source || expected.sha256 !== source.sha256 || expected.fileName !== source.fileName) throw new Error('A seleção não corresponde aos originais disponíveis. Revise os arquivos da entrega.');
    return source;
  });
  if (sources.reduce((sum, record) => sum + record.size, 0) > 40 * 1024 * 1024) throw new Error('Este pacote ultrapassa 40 MB. Baixe em grupos menores ou use os originais individuais.');
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const [index, source] of sources.entries()) {
    const bytes = base64ToBytes(source.base64);
    // WebCrypto avoids synchronous hashing of large files on the Android UI thread.
    const digest = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)), byte => byte.toString(16).padStart(2, '0')).join('') : sha256(bytes);
    if (bytes.length !== source.size || digest !== source.sha256) throw new Error(`O arquivo ${source.fileName} não passou na verificação de integridade. Nenhum pacote foi baixado.`);
    const name = source.fileName.replace(/[\u0000-\u001f/\\]/g, '_');
    files.push({ name: `${String(index + 1).padStart(2, '0')}_${name}`, bytes });
  }
  return files;
}
