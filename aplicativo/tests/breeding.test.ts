import { describe, expect, it } from 'vitest';
import { breedingHandler } from '../src/domain/breeding';
import { emptyState, type Bird, type Scope, type State } from '../src/domain/types';
import { today } from '../src/domain/shared';

const species = 'Calopsita (Nymphicus hollandicus)';
const otherSpecies = 'Agapornis roseicollis';

function command(state: State, action: string, data: unknown, scope: Scope = 'real'): string {
  // Production storage commits a cloned state only after a command succeeds.
  const next = structuredClone(state);
  const result = breedingHandler(next, scope, action, data);
  if (!result?.id) throw new Error(`Command ${action} did not return a record ID`);
  Object.assign(state, next);
  return result.id;
}

function addBird(state: State, overrides: Record<string, unknown> = {}, scope: Scope = 'real'): string {
  return command(state, 'saveBird', {
    identification: `RA-${state.birds.length + 1}`,
    species,
    sex: 'indeterminado',
    mutation: 'Silvestre',
    certainty: 'observada',
    origin: 'Criatório de origem informado',
    birthDate: '2020-01-01',
    status: 'manejo',
    statusDate: '2024-01-01',
    sexDate: '2024-01-01',
    mutationDate: '2024-01-01',
    ...overrides,
  }, scope);
}

function getBird(state: State, id: string): Bird {
  const bird = state.birds.find(record => record.id === id);
  if (!bird) throw new Error(`Missing fixture bird ${id}`);
  return bird;
}

function pairFixture(state = emptyState(), scope: Scope = 'real') {
  const maleId = addBird(state, { sex: 'macho', sexSource: 'Laudo de sexagem', sexMethod: 'DNA' }, scope);
  const femaleId = addBird(state, { sex: 'fêmea', sexSource: 'Laudo de sexagem', sexMethod: 'DNA' }, scope);
  const pairId = command(state, 'createPair', {
    name: 'Casal 01', maleId, femaleId, startDate: '2024-01-01', enclosure: 'Viveiro 1',
  }, scope);
  return { state, scope, maleId, femaleId, pairId };
}

function clutchFixture(state = emptyState(), scope: Scope = 'real') {
  const pair = pairFixture(state, scope);
  const clutchId = command(state, 'createClutch', { pairId: pair.pairId, startDate: '2024-01-10' }, scope);
  return { ...pair, clutchId };
}

function eggFixture(state = emptyState(), scope: Scope = 'real') {
  const clutch = clutchFixture(state, scope);
  const eggId = command(state, 'createEgg', {
    clutchId: clutch.clutchId, laidDate: '2024-01-11', incubationDate: '2024-01-12',
  }, scope);
  return { ...clutch, eggId };
}

function hatch(state: State, eggId: string, scope: Scope = 'real', overrides: Record<string, unknown> = {}) {
  return command(state, 'hatchEgg', {
    eggId, hatchDate: '2024-02-01', identification: 'FILHOTE-001', name: 'Sol', mutation: 'Silvestre',
    ...overrides,
  }, scope);
}

function tomorrow() {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe('bird registration and histories', () => {
  it('normalizes identification and prevents case-insensitive, whitespace duplicates within one scope', () => {
    const state = emptyState();
    const first = addBird(state, { identification: '  ÁGUIA-01  ' });
    expect(getBird(state, first).identification).toBe('ÁGUIA-01');
    expect(() => addBird(state, { identification: ' águia-01 ' })).toThrow(/identificação já/);
    expect(state.birds).toHaveLength(1);
    expect(state.mutations).toHaveLength(1);
    command(state, 'saveBird', { id: first, name: 'Nome corrigido', identification: 'ÁGUIA-01' });
    expect(getBird(state, first).name).toBe('Nome corrigido');
    expect(state.birds).toHaveLength(1);
  });

  it('prevents duplicate microchips without rejecting absent microchips', () => {
    const state = emptyState();
    addBird(state, { microchip: '  CHip-001  ' });
    expect(() => addBird(state, { microchip: 'chip-001' })).toThrow(/microchip já/);
    addBird(state);
    addBird(state);
    expect(state.birds).toHaveLength(3);
  });

  it('keeps real and demonstration identification and histories independent', () => {
    const state = emptyState();
    const realId = addBird(state, { identification: 'MESMA-01', microchip: 'CHIP-01' });
    const demoId = addBird(state, { identification: 'MESMA-01', microchip: 'CHIP-01' }, 'demo');
    command(state, 'saveBird', { id: demoId, mutation: 'Lutino', mutationSource: 'Criador' }, 'demo');
    expect(getBird(state, realId).mutation).toBe('Silvestre');
    expect(getBird(state, demoId).mutation).toBe('Lutino');
    expect(state.mutations.filter(entry => entry.birdId === realId)).toHaveLength(1);
    expect(state.mutations.filter(entry => entry.birdId === demoId)).toHaveLength(2);
    expect(() => command(state, 'saveBird', { id: realId, name: 'Alteração indevida' }, 'demo')).toThrow(/Ave não encontrada/);
    expect(() => command(state, 'deleteBird', { id: realId }, 'demo')).toThrow(/Ave não encontrada/);
  });

  it.each([
    ['birthDate', '2024-02-30'],
    ['acquiredDate', '2024-13-01'],
    ['statusDate', '2024-02-30'],
    ['sexDate', '2024-02-30'],
    ['mutationDate', '2024-02-30'],
  ])('rejects invalid calendar dates in %s', (field, value) => {
    expect(() => addBird(emptyState(), { [field]: value })).toThrow(/Data inválida/);
  });

  it.each(['birthDate', 'acquiredDate', 'statusDate', 'sexDate', 'mutationDate'])('rejects future actual dates in %s', field => {
    expect(() => addBird(emptyState(), { [field]: tomorrow() })).toThrow(/futuro/);
  });

  it('rejects acquisition before birth', () => {
    expect(() => addBird(emptyState(), { acquiredDate: '2019-12-31' })).toThrow(/aquisição não pode anteceder/);
  });

  it('requires the source of a sex correction and preserves each previous result', () => {
    const state = emptyState();
    const birdId = addBird(state);
    expect(() => command(state, 'saveBird', { id: birdId, sex: 'macho', sexMethod: 'DNA' })).toThrow(/fonte da correção/);
    command(state, 'saveBird', { id: birdId, sex: 'macho', sexMethod: 'DNA', sexSource: 'Laboratório A', sexDate: '2024-02-01', sexNotes: 'Resultado do exame' });
    command(state, 'saveBird', { id: birdId, sex: 'fêmea', sexMethod: 'DNA', sexSource: 'Laboratório B', sexDate: '2024-03-01', sexNotes: 'Laudo corrigido' });
    const bird = getBird(state, birdId);
    expect(bird.sex).toBe('fêmea');
    expect(bird.sexSource).toBe('Laboratório B');
    expect(bird.sexHistory).toEqual([
      expect.objectContaining({ sex: 'indeterminado', date: '2024-01-01', source: '' }),
      expect.objectContaining({ sex: 'macho', date: '2024-02-01', method: 'DNA', source: 'Laboratório A', notes: 'Resultado do exame' }),
      expect.objectContaining({ sex: 'fêmea', date: '2024-03-01', source: 'Laboratório B', notes: 'Laudo corrigido' }),
    ]);
    command(state, 'saveBird', { id: birdId, name: 'Nome alterado' });
    expect(getBird(state, birdId).sexHistory).toHaveLength(3);
  });

  it('records a correction of sex source even when the sex itself is unchanged', () => {
    const state = emptyState();
    const birdId = addBird(state, { sex: 'macho', sexMethod: 'DNA', sexSource: 'Laudo original' });
    command(state, 'saveBird', { id: birdId, sexSource: 'Laudo retificado', sexDate: '2024-02-01' });
    expect(getBird(state, birdId).sexHistory?.map(entry => entry.source)).toEqual(['Laudo original', 'Laudo retificado']);
    expect(() => command(state, 'saveBird', { id: birdId, sexSource: '' })).toThrow(/fonte da correção/);
  });

  it('preserves previous mutation, certainty, carriers and source after correction', () => {
    const state = emptyState();
    const birdId = addBird(state, { mutationSource: 'Observação visual' });
    command(state, 'saveBird', { id: birdId, mutation: 'Lutino', certainty: 'confirmada', carriers: 'Arlequim', mutationSource: 'Laudo', mutationDate: '2024-02-01', mutationNotes: 'Informação corrigida' });
    const history = state.mutations.filter(entry => entry.birdId === birdId);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ mutation: 'Silvestre', certainty: 'observada', source: 'Observação visual' });
    expect(history[1]).toMatchObject({ mutation: 'Lutino', certainty: 'confirmada', carriers: 'Arlequim', source: 'Laudo', date: '2024-02-01', notes: 'Informação corrigida' });
  });

  it('requires a source for a correction of mutation, certainty or declared carriers', () => {
    const state = emptyState();
    const birdId = addBird(state);
    for (const correction of [{ mutation: 'Lutino' }, { certainty: 'confirmada' }, { carriers: 'Arlequim' }]) {
      expect(() => command(state, 'saveBird', { id: birdId, ...correction })).toThrow(/fonte/i);
    }
    expect(state.mutations).toHaveLength(1);
  });

  it.each(['statusDate', 'sexDate', 'mutationDate'])('rejects an initial %s before birth', field => {
    expect(() => addBird(emptyState(), { [field]: '2019-12-31' })).toThrow(/anteceder o nascimento/);
  });

  it('rejects sex and mutation correction dates before their previous event', () => {
    const state = emptyState();
    const birdId = addBird(state);
    expect(() => command(state, 'saveBird', { id: birdId, sex: 'macho', sexSource: 'Laudo', sexDate: '2023-12-31' })).toThrow(/último registro de sexagem/);
    expect(() => command(state, 'saveBird', { id: birdId, mutation: 'Lutino', mutationSource: 'Laudo', mutationDate: '2023-12-31' })).toThrow(/último registro de mutação/);
  });

  it('rejects changing birth to after existing bird histories and health events', () => {
    const state = emptyState();
    const birdId = addBird(state);
    command(state, 'saveHealth', { birdId, date: '2024-02-01', kind: 'consulta', title: 'Consulta informada', author: 'Criador' });
    expect(() => command(state, 'saveBird', { id: birdId, birthDate: '2024-03-01' })).toThrow(/nascimento|histórico|registro/i);
    expect(getBird(state, birdId).birthDate).toBe('2020-01-01');
  });

  it('requires a reason, chronological date and post-birth date for status changes', () => {
    const state = emptyState();
    const birdId = addBird(state);
    expect(() => command(state, 'saveBird', { id: birdId, status: 'disponível' })).toThrow(/motivo/);
    expect(() => command(state, 'saveBird', { id: birdId, status: 'disponível', statusDate: '2023-12-31', statusReason: 'Pronto' })).toThrow(/último evento/);
    command(state, 'saveBird', { id: birdId, status: 'disponível', statusDate: '2024-02-01', statusReason: 'Avaliação concluída' });
    expect(getBird(state, birdId).statusHistory).toEqual([
      { date: '2024-01-01', status: 'manejo', reason: 'Cadastro inicial' },
      { date: '2024-02-01', status: 'disponível', reason: 'Avaliação concluída' },
    ]);
  });
});

describe('genealogy and linked bird corrections', () => {
  it('prevents self-parenting and indirect cycles', () => {
    const state = emptyState();
    const fatherId = addBird(state, { sex: 'macho', birthDate: '' });
    const sonId = addBird(state, { sex: 'macho', birthDate: '', fatherId });
    const grandsonId = addBird(state, { sex: 'macho', birthDate: '', fatherId: sonId });
    expect(() => command(state, 'saveBird', { id: fatherId, fatherId })).toThrow(/próprio ancestral/);
    expect(() => command(state, 'saveBird', { id: fatherId, fatherId: grandsonId })).toThrow(/ciclo de parentesco/);
    expect(getBird(state, fatherId).fatherId).toBeNull();
  });

  it('validates parental sex, species, birth order and scope', () => {
    const state = emptyState();
    const femaleId = addBird(state, { sex: 'fêmea' });
    const otherMaleId = addBird(state, { sex: 'macho', species: otherSpecies });
    const demoMaleId = addBird(state, { sex: 'macho' }, 'demo');
    const maleId = addBird(state, { sex: 'macho' });
    expect(() => addBird(state, { birthDate: '2021-01-01', fatherId: femaleId })).toThrow(/pai precisa/);
    expect(() => addBird(state, { birthDate: '2021-01-01', motherId: maleId })).toThrow(/mãe precisa/);
    expect(() => addBird(state, { birthDate: '2021-01-01', fatherId: otherMaleId })).toThrow(/mesma espécie/);
    expect(() => addBird(state, { birthDate: '2021-01-01', fatherId: demoMaleId })).toThrow(/Ave não encontrada/);
    expect(() => addBird(state, { birthDate: '2020-01-01', fatherId: maleId })).toThrow(/posterior ao dos pais/);
  });

  it('blocks sex, species and birth corrections that invalidate descendants', () => {
    const state = emptyState();
    const fatherId = addBird(state, { sex: 'macho', sexSource: 'Laudo' });
    addBird(state, { birthDate: '2021-01-01', fatherId });
    expect(() => command(state, 'saveBird', { id: fatherId, sex: 'fêmea', sexSource: 'Correção' })).toThrow(/papel parental/);
    expect(() => command(state, 'saveBird', { id: fatherId, species: otherSpecies })).toThrow(/descendentes/);
    expect(() => command(state, 'saveBird', { id: fatherId, birthDate: '2021-01-01' })).toThrow(/anteceder o dos descendentes/);
  });

  it('blocks sex and species corrections that conflict with registered pairs', () => {
    const { state, maleId } = pairFixture();
    expect(() => command(state, 'saveBird', { id: maleId, sex: 'fêmea', sexSource: 'Novo laudo' })).toThrow(/papel registrado no casal/);
    expect(() => command(state, 'saveBird', { id: maleId, species: otherSpecies })).toThrow(/espécie conflita/);
    expect(() => command(state, 'saveBird', { id: maleId, birthDate: '2024-02-01' })).toThrow(/posterior à formação/);
  });

  it('requires closing an active pair before making its birds unavailable', () => {
    const { state, maleId, pairId } = pairFixture();
    expect(() => command(state, 'saveBird', { id: maleId, status: 'vendido', statusDate: '2024-02-01', statusReason: 'Venda' })).toThrow(/Encerre o casal ativo/);
    command(state, 'closePair', { id: pairId, endDate: '2024-01-31' });
    command(state, 'saveBird', { id: maleId, status: 'vendido', statusDate: '2024-02-01', statusReason: 'Venda' });
    expect(getBird(state, maleId).status).toBe('vendido');
  });
});

describe('pair formation', () => {
  it('requires explicit acknowledgement of known parentage and records it', () => {
    const state = emptyState();
    const fatherId = addBird(state, { sex: 'macho' });
    const maleId = addBird(state, { sex: 'macho', birthDate: '2021-01-01', fatherId });
    const femaleId = addBird(state, { sex: 'fêmea', birthDate: '2021-02-01', fatherId });
    const data = { name: 'Irmãos', maleId, femaleId, startDate: '2024-01-01' };
    expect(() => command(state, 'createPair', data)).toThrow(/parentesco conhecido/);
    const pairId = command(state, 'createPair', { ...data, acknowledgeRelated: true });
    expect(state.pairs.find(pair => pair.id === pairId)?.relatedAcknowledged).toBe(true);
  });

  it.each(['reservado', 'vendido', 'doado', 'transferido', 'falecido'])('rejects a bird whose status is %s', status => {
    const state = emptyState();
    const maleId = addBird(state, { sex: 'macho', status });
    const femaleId = addBird(state, { sex: 'fêmea' });
    expect(() => command(state, 'createPair', { name: 'Inválido', maleId, femaleId, startDate: '2024-01-01' })).toThrow(/não está disponível/);
  });

  it('rejects same-bird pairs, unknown sex, reversed sex and distinct species', () => {
    const state = emptyState();
    const maleId = addBird(state, { sex: 'macho' });
    const femaleId = addBird(state, { sex: 'fêmea' });
    const unknownId = addBird(state);
    const otherFemaleId = addBird(state, { sex: 'fêmea', species: otherSpecies });
    for (const birds of [
      { maleId, femaleId: maleId }, { maleId: unknownId, femaleId }, { maleId: femaleId, femaleId: maleId },
    ]) {
      expect(() => command(state, 'createPair', { name: 'Inválido', startDate: '2024-01-01', ...birds })).toThrow(/macho e uma fêmea distintos/);
    }
    expect(() => command(state, 'createPair', { name: 'Inválido', maleId, femaleId: otherFemaleId, startDate: '2024-01-01' })).toThrow(/mesma espécie/);
  });

  it('prevents overlapping active pairs but allows a new pair after closure', () => {
    const { state, maleId, pairId } = pairFixture();
    const anotherFemaleId = addBird(state, { sex: 'fêmea' });
    const data = { name: 'Casal 02', maleId, femaleId: anotherFemaleId, startDate: '2024-02-01' };
    expect(() => command(state, 'createPair', data)).toThrow(/casal ativo/);
    command(state, 'closePair', { id: pairId, endDate: '2024-01-31' });
    command(state, 'createPair', data);
    expect(state.pairs.filter(pair => !pair.endDate)).toHaveLength(1);
  });

  it('rejects formation before birth and future or invalid formation dates', () => {
    const state = emptyState();
    const maleId = addBird(state, { sex: 'macho' });
    const femaleId = addBird(state, { sex: 'fêmea' });
    const data = { name: 'Inválido', maleId, femaleId };
    expect(() => command(state, 'createPair', { ...data, startDate: '2019-12-31' })).toThrow(/anteceder o nascimento/);
    expect(() => command(state, 'createPair', { ...data, startDate: tomorrow() })).toThrow(/futuro/);
    expect(() => command(state, 'createPair', { ...data, startDate: '2024-02-30' })).toThrow(/Data inválida/);
  });
});

describe('clutch and egg chronology', () => {
  it('rejects postures before pair formation or concurrent open postures', () => {
    const { state, pairId } = pairFixture();
    expect(() => command(state, 'createClutch', { pairId, startDate: '2023-12-31' })).toThrow(/anteceder a formação/);
    command(state, 'createClutch', { pairId, startDate: '2024-01-10' });
    expect(() => command(state, 'createClutch', { pairId, startDate: '2024-02-01' })).toThrow(/postura aberta/);
  });

  it('rejects postures in closed pairs', () => {
    const { state, pairId } = pairFixture();
    command(state, 'closePair', { id: pairId, endDate: '2024-01-31' });
    expect(() => command(state, 'createClutch', { pairId, startDate: '2024-02-01' })).toThrow(/casal está encerrado/);
  });

  it('validates egg laying, incubation and expected hatching date order', () => {
    const { state, clutchId } = clutchFixture();
    expect(() => command(state, 'createEgg', { clutchId, laidDate: '2024-01-09' })).toThrow(/anteceder o início/);
    expect(() => command(state, 'createEgg', { clutchId, laidDate: '2024-01-11', incubationDate: '2024-01-10' })).toThrow(/incubação não pode anteceder/);
    expect(() => command(state, 'createEgg', { clutchId, laidDate: '2024-01-11', expectedHatchDate: '2024-01-10' })).toThrow(/previsão não pode anteceder/);
    expect(() => command(state, 'createEgg', { clutchId, laidDate: '2024-01-11', incubationDate: '2024-01-12', expectedHatchDate: '2024-01-11' })).toThrow(/previsão não pode anteceder/);
    expect(() => command(state, 'createEgg', { clutchId, laidDate: tomorrow() })).toThrow(/futuro/);
    const eggId = command(state, 'createEgg', { clutchId, laidDate: '2024-01-11', expectedHatchDate: tomorrow() });
    expect(state.eggs.find(egg => egg.id === eggId)?.expectedHatchDate).toBe(tomorrow());
  });

  it('computes configured estimates from incubation and keeps numbering per clutch and scope', () => {
    const state = emptyState();
    state.settings.speciesEstimates[species] = 22;
    Object.assign(state.settings.speciesCatalog.find(entry=>entry.name===species)!,{incubationDays:22,parameterSource:'Parâmetro fictício isolado do teste'});
    const { clutchId } = clutchFixture(state);
    command(state, 'createEgg', { clutchId, laidDate: '2024-01-11', incubationDate: '2024-01-12' });
    command(state, 'createEgg', { clutchId, laidDate: '2024-01-12', expectedHatchDate: '2024-02-10' });
    const demo = clutchFixture(state, 'demo');
    command(state, 'createEgg', { clutchId: demo.clutchId, laidDate: '2024-01-11' }, 'demo');
    expect(state.eggs.filter(egg => egg.clutchId === clutchId).map(egg => egg.number)).toEqual([1, 2]);
    expect(state.eggs[0].expectedHatchDate).toBe('2024-02-03');
    expect(state.eggs[1].expectedHatchDate).toBe('2024-02-10');
    expect(state.eggs[2].number).toBe(1);
    expect(state.eggs[2].scope).toBe('demo');
  });

  it('requires finalized eggs before clutch closure and closed clutches before pair closure', () => {
    const { state, pairId, clutchId, eggId } = eggFixture();
    expect(() => command(state, 'closePair', { id: pairId, endDate: '2024-02-02' })).toThrow(/posturas abertas/);
    expect(() => command(state, 'closeClutch', { id: clutchId, endDate: '2024-02-01' })).toThrow(/ovos em acompanhamento/);
    hatch(state, eggId);
    expect(() => command(state, 'closeClutch', { id: clutchId, endDate: '2024-01-31' })).toThrow(/último evento/);
    command(state, 'closeClutch', { id: clutchId, endDate: '2024-02-01' });
    expect(() => command(state, 'closePair', { id: pairId, endDate: '2024-01-31' })).toThrow(/encerramento das posturas/);
    command(state, 'closePair', { id: pairId, endDate: '2024-02-02' });
    expect(state.clutches[0].endDate).toBe('2024-02-01');
    expect(state.pairs[0].endDate).toBe('2024-02-02');
    expect(() => command(state, 'closeClutch', { id: clutchId, endDate: '2024-02-02' })).toThrow(/já encerrada/);
    expect(() => command(state, 'closePair', { id: pairId, endDate: '2024-02-03' })).toThrow(/já foi encerrado/);
    expect(() => command(state, 'createEgg', { clutchId, laidDate: '2024-02-01' })).toThrow(/postura está encerrada/);
    expect(() => command(state, 'saveEgg', { id: eggId, notes: 'Alteração após fechamento' })).toThrow(/postura está encerrada/);
  });

  it('rejects closing dates before the start', () => {
    const { state, pairId, clutchId } = clutchFixture();
    expect(() => command(state, 'closeClutch', { id: clutchId, endDate: '2024-01-09' })).toThrow(/anterior ao início/);
    expect(() => command(state, 'closePair', { id: pairId, endDate: '2023-12-31' })).toThrow(/anterior à formação/);
  });
});

describe('egg fertility and hatching', () => {
  it('creates one chick with automatic parents, birth, origin and enclosure and rejects a repeated hatch', () => {
    const { state, eggId, maleId, femaleId } = eggFixture();
    const chickId = hatch(state, eggId);
    expect(getBird(state, chickId)).toMatchObject({
      identification: 'FILHOTE-001', name: 'Sol', species, sex: 'indeterminado', status: 'filhote',
      birthDate: '2024-02-01', fatherId: maleId, motherId: femaleId,
      origin: 'Nascimento no criatório', enclosure: 'Viveiro 1',
    });
    expect(state.eggs[0]).toMatchObject({ status: 'eclodido', fertility: 'fértil', chickId, hatchDate: '2024-02-01' });
    expect(getBird(state, chickId).statusHistory[0].date).toBe('2024-02-01');
    expect(getBird(state, chickId).sexHistory?.[0].date).toBe('2024-02-01');
    expect(state.mutations.find(entry => entry.birdId === chickId)?.date).toBe('2024-02-01');
    expect(() => hatch(state, eggId, 'real', { identification: 'DUPLICADO' })).toThrow(/uma vez/);
    expect(state.birds).toHaveLength(3);
    expect(state.mutations.filter(entry => entry.birdId === chickId)).toHaveLength(1);
    expect(state.eggs[0].chickId).toBe(chickId);
  });

  it('rejects hatching before incubation, in the future or with a duplicate identification', () => {
    const { state, eggId, maleId } = eggFixture();
    expect(() => hatch(state, eggId, 'real', { hatchDate: '2024-01-11' })).toThrow(/anteceder a postura ou a incubação/);
    expect(() => hatch(state, eggId, 'real', { hatchDate: tomorrow() })).toThrow(/futuro/);
    expect(() => hatch(state, eggId, 'real', { identification: getBird(state, maleId).identification.toLowerCase() })).toThrow(/identificação já/);
    expect(state.eggs[0]).toMatchObject({ status: 'incubando', chickId: null, hatchDate: null });
    expect(state.birds).toHaveLength(2);
  });

  it('separates an infertility assessment from the final outcome and allows correcting the assessment', () => {
    const { state, eggId } = eggFixture();
    command(state, 'saveEgg', { id: eggId, fertility: 'infértil', eventDate: '2024-01-20', notes: 'Primeira avaliação' });
    expect(state.eggs[0]).toMatchObject({ fertility: 'infértil', status: 'incubando' });
    expect(() => hatch(state, eggId)).toThrow(/fertilidade informada é incompatível/);
    command(state, 'saveEgg', { id: eggId, fertility: 'desconhecida', eventDate: '2024-01-21', notes: 'Avaliação anterior inconclusiva' });
    hatch(state, eggId);
    expect(state.eggs[0]).toMatchObject({ fertility: 'fértil', status: 'eclodido' });
  });

  it.each(['infértil', 'perdido'])('does not hatch an egg already finalized as %s', status => {
    const { state, eggId } = eggFixture();
    command(state, 'eggOutcome', { id: eggId, status });
    expect(state.eggs[0].status).toBe(status);
    if (status === 'infértil') expect(state.eggs[0].fertility).toBe('infértil');
    expect(() => hatch(state, eggId)).toThrow(/já tem resultado/);
    expect(state.birds).toHaveLength(2);
  });

  it('rejects a final infertile outcome paired with a fertile or unknown assessment', () => {
    const { state, eggId } = eggFixture();
    expect(() => command(state, 'eggOutcome', { id: eggId, status: 'infértil', fertility: 'fértil', eventDate: '2024-01-20' })).toThrow(/fertilidade|infértil/i);
    command(state, 'eggOutcome', { id: eggId, status: 'infértil', eventDate: '2024-01-20' });
    for (const fertility of ['fértil', 'desconhecida']) {
      expect(() => command(state, 'saveEgg', { id: eggId, fertility, eventDate: '2024-01-21' })).toThrow(/fertilidade|infértil/i);
    }
    expect(state.eggs[0]).toMatchObject({ status: 'infértil', fertility: 'infértil', outcomeDate: '2024-01-20' });
  });

  it('preserves recorded hatching while allowing notes and compatible assessments to be corrected', () => {
    const { state, eggId } = eggFixture();
    const chickId = hatch(state, eggId);
    expect(() => command(state, 'eggOutcome', { id: eggId, status: 'perdido' })).toThrow(/eclosão registrada deve ser preservada/);
    expect(() => command(state, 'saveEgg', { id: eggId, fertility: 'infértil' })).toThrow(/conflita com a eclosão/);
    expect(() => command(state, 'saveEgg', { id: eggId, fertility: 'desconhecida' })).toThrow(/conflita com a eclosão/);
    expect(() => command(state, 'saveEgg', { id: eggId, incubationDate: '2024-02-02' })).toThrow(/posterior à eclosão/);
    command(state, 'saveEgg', { id: eggId, fertility: 'fértil', notes: 'Nascimento confirmado' });
    expect(state.eggs[0]).toMatchObject({ status: 'eclodido', chickId, notes: 'Nascimento confirmado' });
  });

  it('does not erase hatching when a UI update contains explicitly undefined optional fields', () => {
    const { state, eggId } = eggFixture();
    const chickId = hatch(state, eggId);
    command(state, 'saveEgg', {
      id: eggId, status: undefined, fertility: undefined, incubationDate: undefined,
      expectedHatchDate: undefined, notes: 'Detalhe adicional', eventDate: '2024-02-02',
    });
    expect(state.eggs[0]).toMatchObject({
      status: 'eclodido', fertility: 'fértil', chickId, hatchDate: '2024-02-01',
      incubationDate: '2024-01-12', notes: 'Detalhe adicional',
    });
    expect(() => hatch(state, eggId)).toThrow(/uma vez/);
  });

  it.each(['infértil', 'perdido'])('requires a reason for reopening an egg finalized as %s and preserves its event history', status => {
    const { state, eggId } = eggFixture();
    command(state, 'eggOutcome', { id: eggId, status, eventDate: '2024-01-20', notes: 'Resultado observado' });
    expect(state.eggs[0].outcomeDate).toBe('2024-01-20');
    expect(() => command(state, 'saveEgg', { id: eggId, status: 'incubando', eventDate: '2024-01-21' })).toThrow(/motivo para reabrir/);
    command(state, 'saveEgg', { id: eggId, status: 'incubando', fertility: 'desconhecida', eventDate: '2024-01-21', notes: 'Resultado anterior informado incorretamente' });
    expect(state.eggs[0]).toMatchObject({ status: 'incubando', fertility: 'desconhecida', outcomeDate: null });
    expect(state.eggs[0].events).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: '2024-01-20', kind: `resultado: ${status}`, notes: 'Resultado observado' }),
      expect.objectContaining({ date: '2024-01-21', kind: 'resultado: incubando', notes: 'Resultado anterior informado incorretamente' }),
    ]));
  });

  it('records outcome and observation dates and requires closure after all events', () => {
    const { state, eggId, clutchId } = eggFixture();
    expect(() => command(state, 'eggOutcome', { id: eggId, status: 'perdido', eventDate: '2024-01-10' })).toThrow(/anteceder a postura/);
    expect(() => command(state, 'eggOutcome', { id: eggId, status: 'perdido', eventDate: '2024-01-11' })).toThrow(/anteceder a incubação/);
    expect(() => command(state, 'eggOutcome', { id: eggId, status: 'perdido', eventDate: tomorrow() })).toThrow(/futuro/);
    command(state, 'eggOutcome', { id: eggId, status: 'perdido', eventDate: '2024-01-20', notes: 'Perda registrada' });
    command(state, 'saveEgg', { id: eggId, eventDate: '2024-01-22', notes: 'Observação posterior' });
    expect(state.eggs[0].outcomeDate).toBe('2024-01-20');
    expect(() => command(state, 'closeClutch', { id: clutchId, endDate: '2024-01-21' })).toThrow(/último evento/);
    command(state, 'closeClutch', { id: clutchId, endDate: '2024-01-22' });
    expect(state.clutches[0].endDate).toBe('2024-01-22');
  });

  it.each(['infértil', 'perdido'])('preserves the original final date when editing notes and resending the same %s status', status => {
    const { state, eggId } = eggFixture();
    command(state, 'eggOutcome', { id: eggId, status, eventDate: '2024-01-20', notes: 'Resultado inicial' });
    command(state, 'saveEgg', { id: eggId, status, eventDate: '2024-01-22', notes: 'Observação posterior' });
    expect(state.eggs[0]).toMatchObject({ status, outcomeDate: '2024-01-20', notes: 'Observação posterior' });
    expect(state.eggs[0].events?.filter(event => event.kind === `resultado: ${status}`)).toHaveLength(1);
    expect(state.eggs[0].events).toContainEqual({ date: '2024-01-22', kind: 'observação', notes: 'Observação posterior' });
  });

  it('validates incubation and expectation corrections', () => {
    const { state, eggId } = eggFixture();
    expect(() => command(state, 'saveEgg', { id: eggId, incubationDate: '2024-01-10' })).toThrow(/incubação não pode anteceder/);
    expect(() => command(state, 'saveEgg', { id: eggId, expectedHatchDate: '2024-01-11' })).toThrow(/previsão não pode anteceder/);
    expect(() => command(state, 'saveEgg', { id: eggId, incubationDate: tomorrow() })).toThrow(/futuro/);
    command(state, 'saveEgg', { id: eggId, incubationDate: '2024-01-13', expectedHatchDate: '2024-02-05' });
    expect(state.eggs[0]).toMatchObject({ incubationDate: '2024-01-13', expectedHatchDate: '2024-02-05' });
  });

  it('protects birth and parental links created by hatching from later inconsistent edits', () => {
    const { state, eggId } = eggFixture();
    const chickId = hatch(state, eggId);
    expect(() => command(state, 'saveBird', { id: chickId, fatherId: null })).toThrow(/vinculados à eclosão/);
    expect(() => command(state, 'saveBird', { id: chickId, birthDate: '2024-02-02' })).toThrow(/vinculados à eclosão/);
    command(state, 'saveBird', { id: chickId, name: 'Sol corrigido', sex: 'macho', sexSource: 'Laudo do laboratório', sexDate: '2024-03-01' });
    expect(getBird(state, chickId)).toMatchObject({ name: 'Sol corrigido', sex: 'macho', birthDate: '2024-02-01' });
    expect(state.eggs[0].chickId).toBe(chickId);
  });
});

describe('scope isolation in reproductive commands', () => {
  it('rejects references to birds, pairs, clutches and eggs from another scope', () => {
    const { state, maleId, femaleId, pairId, clutchId, eggId } = eggFixture();
    const operations: [string, unknown, RegExp][] = [
      ['createPair', { name: 'Outro espaço', maleId, femaleId, startDate: '2024-01-01' }, /Ave não encontrada/],
      ['closePair', { id: pairId, endDate: '2024-02-01' }, /Casal não encontrado/],
      ['createClutch', { pairId, startDate: '2024-02-01' }, /Casal não encontrado/],
      ['closeClutch', { id: clutchId, endDate: '2024-02-01' }, /Postura não encontrada/],
      ['createEgg', { clutchId, laidDate: '2024-01-11' }, /Postura não encontrada/],
      ['saveEgg', { id: eggId, fertility: 'fértil' }, /Ovo não encontrado/],
      ['hatchEgg', { eggId, hatchDate: '2024-02-01', identification: 'DEMO', mutation: 'Silvestre' }, /Ovo não encontrado/],
    ];
    for (const [action, data, error] of operations) {
      expect(() => command(state, action, data, 'demo')).toThrow(error);
    }
    expect(state.birds).toHaveLength(2);
    expect(state.pairs).toHaveLength(1);
    expect(state.clutches).toHaveLength(1);
    expect(state.eggs).toHaveLength(1);
  });
});

describe('health timeline and weighing', () => {
  function healthData(birdId: string, overrides: Record<string, unknown> = {}) {
    return { birdId, date: '2024-02-01', kind: 'pesagem', title: 'Pesagem mensal', weightGrams: 92.5, author: 'Criador', ...overrides };
  }

  it('records and corrects weight measurements without duplicating the event', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const firstId = command(state, 'saveHealth', healthData(birdId));
    command(state, 'saveHealth', healthData(birdId, { id: firstId, weightGrams: 93, notes: 'Peso corrigido', professional: 'Veterinária' }));
    command(state, 'saveHealth', healthData(birdId, { date: '2024-03-01', weightGrams: 95 }));
    expect(state.health).toHaveLength(2);
    expect(state.health[0]).toMatchObject({ id: firstId, birdId, weightGrams: 93, author: 'Criador', professional: 'Veterinária', notes: 'Peso corrigido' });
    expect(state.health.map(event => event.weightGrams)).toEqual([93, 95]);
  });

  it.each([0, -1, 100001, Infinity, NaN])('rejects an invalid weight of %s grams', weightGrams => {
    const state = emptyState();
    const birdId = addBird(state);
    expect(() => command(state, 'saveHealth', healthData(birdId, { weightGrams }))).toThrow();
    expect(state.health).toHaveLength(0);
  });

  it('requires a weighing result and an author and rejects past-birth and future events', () => {
    const state = emptyState();
    const birdId = addBird(state);
    expect(() => command(state, 'saveHealth', healthData(birdId, { weightGrams: null }))).toThrow(/peso em gramas/);
    expect(() => command(state, 'saveHealth', healthData(birdId, { author: ' ' }))).toThrow(/obrigatórios/);
    expect(() => command(state, 'saveHealth', healthData(birdId, { date: '2019-12-31' }))).toThrow(/anteceder o nascimento/);
    expect(() => command(state, 'saveHealth', healthData(birdId, { date: tomorrow() }))).toThrow(/futuro/);
    command(state, 'saveHealth', healthData(birdId, { kind: 'consulta', title: 'Consulta informada', weightGrams: null }));
    expect(state.health[0].weightGrams).toBeNull();
  });

  it('rejects changing the bird of an existing event and cross-scope access', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const anotherId = addBird(state);
    const eventId = command(state, 'saveHealth', healthData(birdId));
    expect(() => command(state, 'saveHealth', healthData(anotherId, { id: eventId }))).toThrow(/pertence a outra ave/);
    expect(() => command(state, 'saveHealth', healthData(birdId), 'demo')).toThrow(/Ave não encontrada/);
    const demoId = addBird(state, {}, 'demo');
    expect(() => command(state, 'saveHealth', healthData(demoId, { id: eventId }), 'demo')).toThrow(/saúde não encontrado/);
  });

  it('rejects missing attachments and documents belonging to another bird or scope', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const anotherId = addBird(state);
    state.attachments.push({
      id: 'ANEXO-OUTRA-AVE', scope: 'real', birdId: anotherId, contactId: null, saleId: null,
      title: 'Laudo', category: 'Exame', date: '2024-01-01', issuer: 'Laboratório', reference: '', validUntil: '',
      notes: '', shareWithCustomer: false, fileName: 'laudo.pdf', mime: 'application/pdf', size: 1,
      base64: 'AA==', version: 1, previousId: null, sha256: 'fixture',
    });
    expect(() => command(state, 'saveHealth', healthData(birdId, { attachmentIds: ['AUSENTE'] }))).toThrow(/documento precisa pertencer/);
    expect(() => command(state, 'saveHealth', healthData(birdId, { attachmentIds: ['ANEXO-OUTRA-AVE'] }))).toThrow(/documento precisa pertencer/);
    state.attachments.push({ ...state.attachments[0], id: 'ANEXO-DEMO', scope: 'demo', birdId });
    expect(() => command(state, 'saveHealth', healthData(birdId, { attachmentIds: ['ANEXO-DEMO'] }))).toThrow(/documento precisa pertencer/);
    state.attachments.push({ ...state.attachments[0], id: 'ANEXO-CORRETO', birdId });
    command(state, 'saveHealth', healthData(birdId, { attachmentIds: ['ANEXO-CORRETO'] }));
    expect(state.health[0].attachmentIds).toEqual(['ANEXO-CORRETO']);
  });
});

describe('care agenda', () => {
  it('supports future tasks, optional bird links, edits and explicit completion', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const taskId = command(state, 'saveTask', { birdId, title: 'Nova pesagem', dueDate: tomorrow() });
    command(state, 'toggleTask', { id: taskId, done: true });
    expect(state.tasks[0].done).toBe(true);
    command(state, 'toggleTask', { id: taskId, done: false });
    command(state, 'saveTask', { id: taskId, birdId, title: 'Pesagem e observação', dueDate: tomorrow(), done: false, notes: 'Registro do criador' });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({ id: taskId, birdId, title: 'Pesagem e observação', done: false, notes: 'Registro do criador' });
    command(state, 'saveTask', { title: 'Limpeza do viveiro', dueDate: '2024-01-01' });
    expect(state.tasks[1].birdId).toBeNull();
  });

  it('rejects invalid dates, missing records and cross-scope bird or task links', () => {
    const state = emptyState();
    const birdId = addBird(state);
    const taskId = command(state, 'saveTask', { birdId, title: 'Observação', dueDate: '2024-02-01' });
    expect(() => command(state, 'saveTask', { title: 'Inválida', dueDate: '2024-02-30' })).toThrow(/Data inválida/);
    expect(() => command(state, 'saveTask', { id: 'AUSENTE', title: 'Inválida', dueDate: '2024-02-01' })).toThrow(/Tarefa não encontrada/);
    expect(() => command(state, 'saveTask', { birdId, title: 'Inválida', dueDate: '2024-02-01' }, 'demo')).toThrow(/Ave não encontrada/);
    expect(() => command(state, 'saveTask', { id: taskId, title: 'Inválida', dueDate: '2024-02-01' }, 'demo')).toThrow(/Tarefa não encontrada/);
    expect(() => command(state, 'toggleTask', { id: taskId, done: true }, 'demo')).toThrow(/Tarefa não encontrada/);
    expect(state.tasks[0].done).toBe(false);
  });
});

describe('safe bird deletion', () => {
  it('removes only an unused registration and its initial mutation in the selected scope', () => {
    const state = emptyState();
    const realId = addBird(state, { identification: 'MESMA' });
    const demoId = addBird(state, { identification: 'MESMA' }, 'demo');
    command(state, 'deleteBird', { id: realId });
    expect(state.birds.map(bird => bird.id)).toEqual([demoId]);
    expect(state.mutations.map(entry => entry.birdId)).toEqual([demoId]);
  });

  it('preserves ancestors, members of closed pairs and hatchlings', () => {
    const state = emptyState();
    const fatherId = addBird(state, { sex: 'macho' });
    addBird(state, { birthDate: '2021-01-01', fatherId });
    expect(() => command(state, 'deleteBird', { id: fatherId })).toThrow(/possui vínculos/);
    const pair = pairFixture(state);
    command(state, 'closePair', { id: pair.pairId, endDate: '2024-02-01' });
    expect(() => command(state, 'deleteBird', { id: pair.maleId })).toThrow(/possui vínculos/);
    const egg = eggFixture(state);
    const chickId = hatch(state, egg.eggId);
    expect(() => command(state, 'deleteBird', { id: chickId })).toThrow(/possui vínculos/);
  });

  it('preserves birds with care tasks or health records', () => {
    const state = emptyState();
    const taskBirdId = addBird(state);
    const healthBirdId = addBird(state);
    command(state, 'saveTask', { birdId: taskBirdId, title: 'Pesagem', dueDate: '2024-02-01' });
    command(state, 'saveHealth', { birdId: healthBirdId, date: '2024-02-01', kind: 'consulta', title: 'Registro informado', author: 'Criador' });
    expect(() => command(state, 'deleteBird', { id: taskBirdId })).toThrow(/possui vínculos/);
    expect(() => command(state, 'deleteBird', { id: healthBirdId })).toThrow(/possui vínculos/);
  });

  it.each(['sex', 'mutation', 'status'])('preserves a bird after a %s history correction', field => {
    const state = emptyState();
    const birdId = addBird(state);
    const changes: Record<string, Record<string, unknown>> = {
      sex: { sex: 'macho', sexSource: 'Laudo', sexDate: '2024-02-01' },
      mutation: { mutation: 'Lutino', mutationSource: 'Criador', mutationDate: '2024-02-01' },
      status: { status: 'disponível', statusReason: 'Pronto', statusDate: '2024-02-01' },
    };
    command(state, 'saveBird', { id: birdId, ...changes[field] });
    expect(() => command(state, 'deleteBird', { id: birdId })).toThrow(/possui histórico/);
    expect(state.birds).toHaveLength(1);
  });
});

describe('responsabilidade e recintos',()=>{
 it('preserves every move with date and reason and blocks deleting that history',()=>{
  const state=emptyState(),birdId=addBird(state,{responsible:'Criador A',enclosure:'Viveiro A',custodyDate:'2024-01-01'});
  expect(()=>command(state,'saveBird',{id:birdId,enclosure:'Viveiro B'})).toThrow(/motivo/);
  command(state,'saveBird',{id:birdId,enclosure:'Viveiro B',responsible:'Criador B',custodyDate:'2024-03-01',custodyReason:'Mudança de manejo'});
  expect(getBird(state,birdId).custodyHistory).toEqual([
   {date:'2024-01-01',responsible:'Criador A',enclosure:'Viveiro A',reason:'Cadastro inicial'},
   {date:'2024-03-01',responsible:'Criador B',enclosure:'Viveiro B',reason:'Mudança de manejo'}
  ]);
  expect(()=>command(state,'saveBird',{id:birdId,enclosure:'Viveiro C',custodyDate:'2024-02-01',custodyReason:'Motivo'})).toThrow(/último registro/);
  expect(()=>command(state,'deleteBird',{id:birdId})).toThrow(/histórico/);
 });
 it('rejects a movement before birth',()=>{
  expect(()=>addBird(emptyState(),{custodyDate:'2019-12-31'})).toThrow(/anteceder o nascimento/);
 });
});
