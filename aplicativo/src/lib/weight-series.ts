import type { HealthEvent } from '../domain/types';

export type WeightPoint = { record: HealthEvent; day: number; x: number; y: number };
export type WeightSeries = { points: WeightPoint[]; min: number; max: number; firstDate: string; lastDate: string };
const DAY = 86400000;
export type WeightPeriod = 'day' | 'week' | 'month' | 'all';

/** Windows end at the last actual weighing, so an older bird still has a useful chart. */
export function weightPeriodRecords(records: HealthEvent[], period: WeightPeriod): HealthEvent[] {
  const valid=weightSeries(records).points.map(point=>point.record);
  const last=valid.at(-1);
  if(!last||period==='all')return valid;
  const span=period==='day'?1:period==='week'?7:30;
  const first=Date.parse(`${last.date}T00:00:00Z`)-(span-1)*DAY;
  return valid.filter(record=>Date.parse(`${record.date}T00:00:00Z`)>=first);
}

/** Only actual measurements are plotted. The x axis uses recorded dates, not list positions. */
export function weightSeries(records: HealthEvent[]): WeightSeries {
  const measurements = records.map((record, index) => ({ record, index, day: Date.parse(`${record.date}T00:00:00Z`) / DAY }))
    .filter(({ record, day }) => record.weightGrams !== null && Number.isFinite(record.weightGrams) && record.weightGrams > 0 && Number.isFinite(day) && new Date(day * DAY).toISOString().slice(0, 10) === record.date)
    .sort((a, b) => a.day - b.day || a.index - b.index);
  if (!measurements.length) return { points: [], min: 0, max: 0, firstDate: '', lastDate: '' };
  const { minimum, maximum } = measurements.reduce((range, { record }) => ({ minimum: Math.min(range.minimum, record.weightGrams ?? 0), maximum: Math.max(range.maximum, record.weightGrams ?? 0) }), { minimum: Infinity, maximum: -Infinity });
  const padding = Math.max((maximum - minimum) * 0.12, maximum * 0.025, 0.5);
  const min = Math.max(0, minimum - padding), max = maximum + padding;
  const first=measurements[0],last=measurements.at(-1);
  if(!first||!last)return {points:[],min:0,max:0,firstDate:'',lastDate:''};
  const firstDay = first.day, lastDay = last.day;
  return { min, max, firstDate: first.record.date, lastDate: last.record.date,
    points: measurements.map(({ record, day }) => ({ record, day, x: lastDay === firstDay ? 0.5 : (day - firstDay) / (lastDay - firstDay), y: ((record.weightGrams ?? 0) - min) / (max - min) })) };
}
