import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BirdRecentHealthHistory, HealthTimeline } from '../src/components/HealthHistory';
import { emptyState, type HealthEvent, type ModuleProps } from '../src/domain/types';

const event = (id: string, date: string): HealthEvent => ({ id, scope: 'real', birdId: 'bird-1', date, kind: 'exame', title: `Registro ${id}`, notes: 'Observação completa no detalhe', weightGrams: 97.5, professional: 'Profissional informado', author: 'Criador', attachmentIds: ['document-1'] });

describe('health timeline presentation', () => {
  it('keeps the record title, date, kind, weight, professional and file count with accessible detail actions', () => {
    const markup = renderToStaticMarkup(createElement(HealthTimeline, { records: [event('1', '2024-06-10')], onOpen: () => {} }));
    for (const value of ['Registro 1', '10/06/2024', 'exame', '97,5 g', 'Profissional informado', '1 arquivo', 'Ver detalhes', 'aria-label="Ver registro: Registro 1"']) expect(markup).toContain(value);
    expect(markup).toContain('<ol');
    expect(markup).toContain('dateTime="2024-06-10"');
  });
  it('retains the empty history message and falls back to the author when no professional was provided', () => {
    expect(renderToStaticMarkup(createElement(HealthTimeline, { records: [], onOpen: () => {} }))).toContain('Nenhum registro de saúde ou manejo.');
    const record = { ...event('1', '2024-06-10'), professional: '', weightGrams: null, attachmentIds: [] };
    const markup = renderToStaticMarkup(createElement(HealthTimeline, { records: [record], onOpen: () => {} }));
    expect(markup).toContain('Criador');
    expect(markup).toContain('0 arquivos');
    expect(markup).not.toContain('97,5 g');
  });
  it('shows four recent records in the existing order while retaining a route to the complete history', () => {
    const state = emptyState();
    state.health = [event('1', '2024-06-10'), event('2', '2024-07-10'), event('3', '2024-06-10'), event('4', '2024-08-10'), event('5', '2024-08-10'), { ...event('6', '2024-09-10'), scope: 'demo' }, { ...event('7', '2024-09-10'), birdId: 'bird-2' }];
    const props: ModuleProps = { state, scope: 'real', command: async () => undefined, notify: () => {}, search: '' };
    const markup = renderToStaticMarkup(createElement(BirdRecentHealthHistory, { ...props, birdId: 'bird-1', onEdit: () => {}, onViewAll: () => {} }));
    expect(markup).toContain('Histórico recente');
    expect(markup).toContain('Ver todo o histórico');
    expect(Array.from(markup.matchAll(/aria-label="Ver registro: Registro (\d)"/g), match => match[1])).toEqual(['5', '4', '2', '3']);
    expect(state.health).toHaveLength(7);
  });
});
