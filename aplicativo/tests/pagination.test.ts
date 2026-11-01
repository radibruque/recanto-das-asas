import { describe, expect, it } from 'vitest';
import { BIRD_PAGE_SIZE, REPORT_PAGE_SIZE, paginate } from '../src/lib/pagination';
describe('Limites de páginas solicitados', () => {
  const rows = Array.from({ length: 45 }, (_, i) => i + 1);
  it('aves mostram 20 registros, quatro linhas de cinco no computador', () => {
    expect(BIRD_PAGE_SIZE).toBe(20);
    expect(paginate(rows, 1, BIRD_PAGE_SIZE).rows).toEqual(rows.slice(0, 20));
    expect(paginate(rows, 2, BIRD_PAGE_SIZE).rows).toEqual(rows.slice(20, 40));
    expect(paginate(rows, 3, BIRD_PAGE_SIZE).rows).toEqual([41, 42, 43, 44, 45]);
  });
  it('relatórios mostram no máximo dez registros por página sem alterar o conjunto exportado', () => {
    expect(REPORT_PAGE_SIZE).toBe(10);
    expect(paginate(rows, 2, REPORT_PAGE_SIZE).rows).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(rows).toHaveLength(45);
  });
  it('reduzir o filtro ajusta a última página e não retorna uma página vazia', () => {
    expect(paginate(rows.slice(0, 3), 5, BIRD_PAGE_SIZE)).toEqual({ page: 1, pages: 1, rows: [1, 2, 3] });
  });
});