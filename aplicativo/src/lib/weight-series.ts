import type { HealthEvent } from '../domain/types';

export type WeightPoint = { record: HealthEvent; day: number; x: number; y: number };
export type WeightSeries = { points: WeightPoint[]; min: number; max: number; firstDate: string; lastDate: string };
const DAY = 86400000;

/** Only actual measurements are plotted. The x axis uses recorded dates, not list positions. */
export function weightSeries(records: HealthEvent[]): WeightSeries {
  const measurements = records.map((record, index) => ({ record, index, day: Date.parse(`${record.date}T00:00:00Z`) / DAY }))
    .filter(({ record, day }) => record.weightGrams !== null && Number.isFinite(record.weightGrams) && record.weightGrams > 0 && Number.isFinite(day) && new Date(day * DAY).toISOString().slice(0, 10) === record.date)
    .sort((a, b) => a.day - b.day || a.index - b.index);
  if (!measurements.length) return { points: [], min: 0, max: 0, firstDate: '', lastDate: '' };
  const { minimum, maximum } = measurements.reduce((range, { record }) => ({ minimum: Math.min(range.minimum, record.weightGrams!), maximum: Math.max(range.maximum, record.weightGrams!) }), { minimum: Infinity, maximum: -Infinity });
  const padding = Math.max((maximum - minimum) * 0.12, maximum * 0.025, 0.5);
  const min = Math.max(0, minimum - padding), max = maximum + padding;
  const firstDay = measurements[0].day, lastDay = measurements.at(-1)!.day;
  return { min, max, firstDate: measurements[0].record.date, lastDate: measurements.at(-1)!.record.date,
    points: measurements.map(({ record, day }) => ({ record, day, x: lastDay === firstDay ? 0.5 : (day - firstDay) / (lastDay - firstDay), y: (record.weightGrams! - min) / (max - min) })) };
}
