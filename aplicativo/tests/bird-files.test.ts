import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { filesForBird } from '../src/lib/bird-files';
import { emptyState, type Attachment } from '../src/domain/types';

const file = (id: string, extra: Partial<Attachment> = {}): Attachment => ({ id, scope: 'real', birdId: null, contactId: null, saleId: null, title: id, category: 'Exame', date: '2024-01-01', issuer: '', reference: '', validUntil: '', notes: '', shareWithCustomer: false, fileName: `${id}.txt`, mime: 'text/plain', size: 1, get base64(): string { throw new Error('Metadata lookup must not open file contents'); }, version: 1, previousId: null, sha256: 'a'.repeat(64), ...extra });

describe('bird file links for the compact sheet', () => {
  it('preserves direct, principal photo, sexing, health, mutation and multi-bird commercial legacy links without decoding a file', () => {
    const state = emptyState();
    const birdId = applyCommand(state, 'real', 'saveBird', { identification: 'BIRD-FILES', species: 'Calopsita', sex: 'indeterminado', mutation: 'Não informada', certainty: 'informada', origin: 'Não informada' })!;
    const bird = state.birds[0];
    bird.photoId = 'photo';
    bird.sexHistory![0].attachmentId = 'sex';
    state.mutations[0].attachmentId = 'mutation';
    state.health.push({ id: 'health-record', scope: 'real', birdId, date: '2024-01-01', kind: 'exame', title: 'Exame', notes: '', weightGrams: null, professional: '', author: 'Criador', attachmentIds: ['health'] });
    state.sales.push({ id: 'sale-record', scope: 'real', number: 'VENDA-01', contactId: 'contact', date: '2024-01-01', status: 'entregue', items: [{ id: 'item', kind: 'ave', refId: birdId, description: 'Ave', quantity: 1, unitCents: 100 }], discountCents: 0, feeCents: 0, totalCents: 100, notes: '', deliveryDate: '', statusHistory: [] });
    state.attachments = [file('direct', { birdId }), file('photo'), file('sex'), file('mutation'), file('health'), file('sale', { saleId: 'sale-record' }), file('unrelated'), file('other-scope', { scope: 'demo', birdId })];
    const records = filesForBird(state, 'real', birdId);
    expect(records.map(record => record.id)).toEqual(['direct', 'photo', 'sex', 'mutation', 'health', 'sale']);
    records.forEach(record => expect(state.attachments.includes(record)).toBe(true));
    expect(filesForBird(state, 'demo', birdId)).toEqual([]);
    expect(filesForBird(state, 'real', 'missing')).toEqual([]);
  });
});
