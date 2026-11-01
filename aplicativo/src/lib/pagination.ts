export const BIRD_PAGE_SIZE = 20;
export const REPORT_PAGE_SIZE = 10;

export function paginate<T>(rows: T[], requested: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(1, Math.min(pages, requested));
  return { page, pages, rows: rows.slice((page - 1) * size, page * size) };
}