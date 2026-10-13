import { describe, expect, it } from 'vitest';
import { breedingHandler, healthHistoriesForBirds, healthHistoryForBird, latestBirdWeight } from '../src/domain/breeding';
import { emptyState, type HealthEvent, type Scope, type State } from '../src/domain/types';

function command(state: State, action: string, data: unknown, scope: Scope = 'real') {
  const next = structuredClone(state), result = breedingHandler(next, scope, action, data);
  if (!result?.id) throw new Error(`Missing command result: ${action}`);
  Object.assign(state, next);
  return result.id;
}
function bird(state: State, scope: Scope = 'real', extra: Record<string, unknown> = {}) {
  return command(state, 'saveBird', { identification: `CARE-${state.birds.length}`, species: 'Calopsita', sex: 'indeterminado', mutation: 'Cinza', certainty: 'informada', origin: 'Criatório', ...extra }, scope);
}
function event(state: State, birdId: string, date: string, weightGrams: number | null, scope: Scope = 'real') {
  return command(state, 'saveHealth', { birdId, date, weightGrams, kind: weightGrams === null ? 'exame' : 'pesagem', title: weightGrams === null ? 'Exame informado' : 'Peso registrado', author: 'Criador' }, scope);
}

describe('bird health summaries', () => {
  it('uses the recorded date instead of insertion order and ignores events without a weight', () => {
    const state = emptyState(), birdId = bird(state);
    event(state, birdId, '2024-06-10', 97);
    event(state, birdId, '2024-07-10', null);
    event(state, birdId, '2024-05-10', 93);
    expect(healthHistoryForBird(state, 'real', birdId).map(h => h.date)).toEqual(['2024-07-10', '2024-06-10', '2024-05-10']);
    expect(latestBirdWeight(state, 'real', birdId)).toMatchObject({ date: '2024-06-10', weightGrams: 97 });
    expect(state.health.map(h => h.date)).toEqual(['2024-06-10', '2024-07-10', '2024-05-10']);
  });
  it('chooses the later recorded measurement on the same day and respects bird and scope', () => {
    const state = emptyState(), birdId = bird(state), anotherId = bird(state), demoId = bird(state, 'demo');
    event(state, birdId, '2024-06-10', 96);
    const latestId = event(state, birdId, '2024-06-10', 97);
    event(state, anotherId, '2024-08-10', 105);
    event(state, demoId, '2024-08-10', 150, 'demo');
    expect(latestBirdWeight(state, 'real', birdId)?.id).toBe(latestId);
    expect(healthHistoryForBird(state, 'demo', birdId)).toEqual([]);
    expect(latestBirdWeight(state, 'real', demoId)).toBeUndefined();
  });
  it('groups histories with exactly the existing order, object references and scope isolation without mutating records', () => {
    const state = emptyState();
    for (let index = 0; index < 800; index++) state.health.push({ id: `health-${index}`, scope: index % 7 === 0 ? 'demo' : 'real', birdId: `bird-${index % 13}`, date: `2024-06-${String(1 + ((index * 7) % 28)).padStart(2, '0')}`, kind: index % 3 === 0 ? 'exame' : 'pesagem', title: `Registro ${index}`, notes: '', weightGrams: index % 3 === 0 ? null : 97, professional: '', author: 'Criador', attachmentIds: [] });
    const original = structuredClone(state.health);
    for (const scope of ['real', 'demo'] as const) {
      const grouped = healthHistoriesForBirds(state.health, scope);
      for (let index = 0; index < 13; index++) {
        const existing = healthHistoryForBird(state, scope, `bird-${index}`), records = grouped.get(`bird-${index}`)!;
        expect(records.map(record => record.id)).toEqual(existing.map(record => record.id));
        records.forEach((record, position) => expect(record).toBe(existing[position]));
      }
      expect(grouped.has('bird-without-records')).toBe(false);
    }
    expect(state.health).toEqual(original);
  });
  it('scans a large shared history once instead of rescanning every bird', () => {
    let scopeReads = 0;
    const records = Array.from({ length: 4000 }, (_, index): HealthEvent => ({ id: `record-${index}`, get scope() { scopeReads++; return 'real' as const; }, birdId: `bird-${index % 200}`, date: '2024-06-10', kind: 'pesagem', title: 'Pesagem', notes: '', weightGrams: 97, professional: '', author: 'Criador', attachmentIds: [] }));
    const grouped = healthHistoriesForBirds(records, 'real');
    expect(scopeReads).toBe(records.length);
    expect(grouped.size).toBe(200);
    expect(grouped.get('bird-0')?.map(record => record.id)).toEqual(Array.from({ length: 20 }, (_, index) => `record-${3800 - index * 200}`));
    expect(healthHistoriesForBirds([], 'real').size).toBe(0);
  });
});

describe('booklet data is part of the bird registration', () => {
  it('preserves old bird fields and omitted booklet fields in an isolated booklet update', () => {
    const state = emptyState(), birdId = bird(state, 'real', { booklet: { individualCode: 'PET-001', tutorName: 'Tutora', currentDiet: 'Ração informada', weaningDate: '2024-01-10' } });
    const before = structuredClone(state.birds[0]);
    command(state, 'bird.booklet', { id: birdId, booklet: { tutorPhone: '11 90000-0000' } });
    expect(state.birds[0]).toEqual({ ...before, booklet: { ...before.booklet, tutorPhone: '11 90000-0000' } });
    command(state, 'saveBird', { id: birdId, name: 'Sol', booklet: { ring: 'AN-123' } });
    expect(state.birds[0].booklet).toMatchObject({ individualCode: 'PET-001', tutorName: 'Tutora', currentDiet: 'Ração informada', weaningDate: '2024-01-10', ring: 'AN-123', tutorPhone: '11 90000-0000' });
    command(state, 'saveBird', { id: birdId, name: 'Sol atualizado' });
    expect(state.birds[0].booklet?.ring).toBe('AN-123');
  });
  it('rejects malformed metadata and scoped changes without losing the original registration', () => {
    const state = emptyState(), birdId = bird(state), before = structuredClone(state);
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: { weaningDate: '2024-02-30' } })).toThrow(/Data inválida/);
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: { rearingType: 'unknown' } })).toThrow();
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: { deliveryWeightGrams: Infinity } })).toThrow();
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: { tutorName: 'Outro espaço' } }, 'demo')).toThrow(/Ave não encontrada/);
    expect(state).toEqual(before);
  });
  it('requires the main photo to be an image belonging to this bird', () => {
    const state = emptyState(), birdId = bird(state), otherId = bird(state);
    const base = { scope: 'real' as const, contactId: null, saleId: null, title: 'Foto', category: 'Cadastro', date: '2024-01-01', issuer: '', reference: '', validUntil: '', notes: '', shareWithCustomer: false, fileName: 'foto.png', mime: 'image/png', size: 1, base64: 'AA==', version: 1, previousId: null, sha256: 'fixture' };
    state.attachments.push({ ...base, id: 'MY-PHOTO', birdId }, { ...base, id: 'OTHER-PHOTO', birdId: otherId }, { ...base, id: 'MY-PDF', birdId, mime: 'application/pdf' });
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: {}, photoId: 'OTHER-PHOTO' })).toThrow(/pertencer à ave/);
    expect(() => command(state, 'bird.booklet', { id: birdId, booklet: {}, photoId: 'MY-PDF' })).toThrow(/arquivo de imagem/);
    command(state, 'bird.booklet', { id: birdId, booklet: { photoDate: '2024-01-01' }, photoId: 'MY-PHOTO' });
    expect(state.birds[0].photoId).toBe('MY-PHOTO');
  });
});

describe('agenda reminder details', () => {
  it('preserves a saved reminder when updating a legacy task payload and supports explicitly clearing its time', () => {
    const state = emptyState(), birdId = bird(state);
    const id = command(state, 'saveTask', { birdId, title: 'Pesagem', dueDate: '2024-01-01', reminderTime: '08:30', reminderMinutes: 60 });
    command(state, 'saveTask', { id, birdId, title: 'Pesagem corrigida', dueDate: '2024-01-02' });
    expect(state.tasks[0]).toMatchObject({ reminderTime: '08:30', reminderMinutes: 60 });
    command(state, 'saveTask', { id, birdId, title: 'Pesagem corrigida', dueDate: '2024-01-02', reminderTime: '', reminderMinutes: 0 });
    expect(state.tasks[0]).toMatchObject({ reminderTime: '', reminderMinutes: 0 });
  });
  it('rejects invalid time and reminder intervals', () => {
    const state = emptyState(), data = { title: 'Limpeza', dueDate: '2024-01-01' };
    for (const reminderTime of ['25:00', '08:61', '8:30', '10:00:00']) expect(() => command(state, 'saveTask', { ...data, reminderTime })).toThrow();
    expect(() => command(state, 'saveTask', { ...data, reminderTime: '09:00', reminderMinutes: 7 })).toThrow();
    expect(state.tasks).toEqual([]);
  });
});
