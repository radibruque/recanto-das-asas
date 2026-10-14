import { useId, useMemo } from 'react';
import type { HealthEvent } from '../domain/types';
import { dateLabel } from '../domain/shared';
import { weightSeries } from '../lib/weight-series';

export default function WeightChart({ records }: { records: HealthEvent[] }) {
  const series = useMemo(() => weightSeries(records), [records]);
  const title = useId(), description = useId();
  if (!series.points.length) return <p className="empty muted">Nenhuma pesagem registrada para esta ave.</p>;
  const label = (weight: number) => weight.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return <figure className="weight-chart">
    <div className="weight-chart-mobile-scale"><span>Escala do gráfico (g)</span><strong>{label(series.min)} a {label(series.max)}</strong></div>
    <svg viewBox="0 0 640 232" role="img" aria-labelledby={`${title} ${description}`}>
      <title id={title}>{`Evolução do peso: ${series.points.length} ${series.points.length === 1 ? 'pesagem registrada' : 'pesagens registradas'}`}</title>
      <desc id={description}>Cada ponto representa uma medição real em gramas. O espaçamento horizontal corresponde às datas registradas, sem medições ou curvas estimadas. A lista abaixo apresenta os valores completos.</desc>
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line className="weight-chart-grid" x1="58" x2="618" y1={192 - ratio * 164} y2={192 - ratio * 164}/><text className="weight-chart-label" x="48" y={196 - ratio * 164} textAnchor="end">{label(series.min + (series.max - series.min) * ratio)}</text></g>)}
      <text className="weight-chart-label" x="12" y="14">g</text>
      {series.points.map(point => <circle key={point.record.id} className="weight-chart-point" cx={70 + point.x * 536} cy={192 - point.y * 164} r="5"><title>{`${dateLabel(point.record.date)}: ${label(point.record.weightGrams!)} g · ${point.record.title}`}</title></circle>)}
      <text className="weight-chart-label" x="70" y="220">{dateLabel(series.firstDate)}</text>
      {series.firstDate !== series.lastDate && <text className="weight-chart-label" x="606" y="220" textAnchor="end">{dateLabel(series.lastDate)}</text>}
    </svg>
    <div className="weight-chart-mobile-dates"><time dateTime={series.firstDate}>{dateLabel(series.firstDate)}</time>{series.firstDate !== series.lastDate && <time dateTime={series.lastDate}>{dateLabel(series.lastDate)}</time>}</div>
    <figcaption className="muted">Pontos de pesagens reais; períodos sem registro mantêm seu intervalo entre datas.</figcaption>
  </figure>;
}
