import { describe, it, expect } from 'vitest';
import { emptyState } from '../src/domain/types';
import { applyCommand } from '../src/domain/engine';
import { enclosureBirds, enclosureOptions } from '../src/domain/enclosures';
import { validateState } from '../src/lib/validation';
const bird = (identification: string, enclosure: string) => ({ identification, enclosure, species: 'Calopsita', sex: 'indeterminado', mutation: 'Não informada', certainty: 'informada', origin: 'Não informada' });
describe('Recintos confirmados no vídeo', () => {
  it('um recinto ocupado aceita múltiplas aves', () => {
    const s = emptyState(); applyCommand(s, 'real', 'enclosure.save', { name: 'Viveiro 1', status: 'ocupado' });
    applyCommand(s, 'real', 'saveBird', bird('A1', 'Viveiro 1')); applyCommand(s, 'real', 'saveBird', bird('A2', 'Viveiro 1'));
    expect(enclosureBirds(s, 'real', 'Viveiro 1').length).toBe(2);
  });
  it('exclusão exige mover todas as aves antes', () => {
    const s = emptyState(); applyCommand(s, 'real', 'enclosure.save', { name: 'Viveiro 1', status: 'ocupado' });
    applyCommand(s, 'real', 'saveBird', bird('A1', 'Viveiro 1'));
    expect(() => applyCommand(s, 'real', 'enclosure.delete', { name: 'Viveiro 1' })).toThrow('Mova todas as aves');
    applyCommand(s, 'real', 'saveBird', { ...s.birds[0], enclosure: '', custodyReason: 'Mudança' });
    applyCommand(s, 'real', 'enclosure.delete', { name: 'Viveiro 1' });
    expect(enclosureOptions(s, 'real')).toHaveLength(0);
  });
  it.each(['manutenção','fora de uso'])('%s impede receber novas aves', status => {
    const s = emptyState(); applyCommand(s, 'real', 'enclosure.save', { name: 'Viveiro 1', status });
    expect(() => applyCommand(s, 'real', 'saveBird', bird('A1', 'Viveiro 1'))).toThrow('Escolha outro');
  });
  it('as listas editadas e os recintos sobrevivem à validação do backup', () => {
    const s = emptyState(); applyCommand(s, 'real', 'enclosure.save', { name: 'Viveiro 1', status: 'disponível' });
    applyCommand(s, 'real', 'catalogs.save', { mutations: ['Lutino'], sexMethods: ['DNA'], healthKinds: ['consulta'] });
    const restored = validateState(s);
    expect(restored.settings.formCatalogs?.mutations).toEqual(['Lutino']);
    expect(restored.settings.enclosures?.[0].name).toBe('Viveiro 1');
  });
});