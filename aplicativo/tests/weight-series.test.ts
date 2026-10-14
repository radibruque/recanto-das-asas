import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HealthEvent } from '../src/domain/types';
import { weightSeries } from '../src/lib/weight-series';
import WeightChart from '../src/components/WeightChart';

const measurement = (id: string, date: string, weightGrams: number | null): HealthEvent => ({ id, date, weightGrams, scope: 'real', birdId: 'bird', kind: weightGrams === null ? 'exame' : 'pesagem', title: `Registro ${id}`, notes: '', author: 'Criador', professional: '', attachmentIds: [] });

describe('recorded bird weight evolution', () => {
  it('keeps real calendar intervals and all same-day measurements without modifying the shared health history', () => {
    const records = [measurement('last', '2024-01-11', 100), measurement('first', '2024-01-01', 95), measurement('near', '2024-01-02', 97), measurement('same-day', '2024-01-02', 98), measurement('exam', '2024-01-03', null)];
    const original = structuredClone(records), series = weightSeries(records);
    expect(series.points.map(point => point.record.id)).toEqual(['first', 'near', 'same-day', 'last']);
    expect(series.points.map(point => point.x)).toEqual([0, 0.1, 0.1, 1]);
    expect(series.points.map(point => point.record.weightGrams)).toEqual([95, 97, 98, 100]);
    expect(records).toEqual(original);
    series.points.forEach(point => expect(records.includes(point.record)).toBe(true));
  });
  it('keeps a single measurement and equal-weight series visible without fabricating dates or values', () => {
    const one = weightSeries([measurement('single', '2024-06-10', 97.5)]);
    expect(one.points).toHaveLength(1);
    expect(one.points[0].x).toBe(0.5);
    expect(one.points[0].y).toBeGreaterThan(0);
    expect(one.points[0].y).toBeLessThan(1);
    expect(one.firstDate).toBe(one.lastDate);
    expect(weightSeries([measurement('a', '2024-06-10', 97), measurement('b', '2024-07-10', 97)]).points.map(point => point.y)).toEqual([0.5, 0.5]);
  });
  it('ignores events with no measured weight and cannot manufacture a plotted point from an invalid legacy date/value', () => {
    expect(weightSeries([measurement('none', '2024-01-01', null), measurement('invalid-date', '2024-02-30', 97), measurement('invalid-weight', '2024-01-01', NaN), measurement('zero', '2024-01-01', 0)]).points).toEqual([]);
    expect(weightSeries([]).points).toEqual([]);
  });
  it('exports an accessible chart with Brazilian dates, real weights and a clear reference to the complete list', () => {
    const records = [measurement('single', '2024-06-10', 97.5)];
    const markup = renderToStaticMarkup(createElement(WeightChart, { records }));
    expect(markup).toContain('role="img"');
    expect(markup).toContain('1 pesagem registrada');
    expect(markup).toContain('10/06/2024: 97,5 g');
    expect(markup).toContain('lista abaixo');
    expect(markup.match(/<circle\b/g)).toHaveLength(1);
    expect(markup).not.toContain('<path');
    expect(renderToStaticMarkup(createElement(WeightChart, { records: [] }))).toContain('Nenhuma pesagem registrada');
  });
});
