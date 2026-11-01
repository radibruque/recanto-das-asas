import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './bits';

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages < 2) return null;
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const numbers = Array.from({ length: Math.min(3, pages) }, (_, i) => start + i);
  return <nav aria-label="Páginas" className="ui flex flex-wrap items-center justify-center gap-1.5 py-3">
    <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onChange(1)} title="Primeira página" aria-label="Primeira página"><ChevronsLeft/></Button>
    <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onChange(page - 1)} title="Página anterior" aria-label="Página anterior"><ChevronLeft/></Button>
    {numbers.map(n => <Button size="sm" key={n} variant={page === n ? 'ink' : 'secondary'} aria-current={page === n ? 'page' : undefined} aria-label={`Página ${n}`} onClick={() => onChange(n)}>{n}</Button>)}
    <Button size="sm" variant="secondary" disabled={page === pages} onClick={() => onChange(page + 1)} title="Próxima página" aria-label="Próxima página"><ChevronRight/></Button>
    <Button size="sm" variant="secondary" disabled={page === pages} onClick={() => onChange(pages)} title="Última página" aria-label="Última página"><ChevronsRight/></Button>
    <span className="px-2 text-xs text-muted-foreground">{page} / {pages}</span>
  </nav>;
}