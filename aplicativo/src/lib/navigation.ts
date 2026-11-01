import type { NavigationTarget } from '../domain/ui-target';
import type { Scope, State, Task } from '../domain/types';

export type Sector = 'breeding' | 'commercial';
export const commercialViews = new Set(['contacts', 'sales', 'finance', 'stock']);
export const breedingViews = new Set(['birds', 'enclosures', 'pairs', 'breeding', 'family', 'health', 'tasks']);
export const historyStatuses = new Set(['vendido', 'transferido', 'doado', 'falecido']);

/** HOME always starts at the top; other screens keep their saved reading position. */
export function navigationScroll(target: NavigationTarget, saved = 0): number {
  return target.view === 'home' || target.birdId || target.saleId || target.contactId || target.createAction ? 0 : saved;
}

export function restorePageScroll(position: number): void {
  const main = document.getElementById('main-scroll');
  main?.scrollTo({ top: position, behavior: 'instant' });
  // Android scrolls the document, whereas desktop scrolls inside main.
  if (!main || !['auto', 'scroll'].includes(getComputedStyle(main).overflowY)) {
    window.scrollTo({ top: position, behavior: 'instant' });
  }
}

export function sectorForTarget(target: NavigationTarget, current: Sector): Sector {
  if (commercialViews.has(target.view) || target.view === 'home' && target.filter === 'commercial') return 'commercial';
  if (breedingViews.has(target.view) || target.view === 'home' && target.filter === 'breeding') return 'breeding';
  return current;
}

export function taskTarget(task: Task): NavigationTarget {
  const linked = task as Task & { source?: { birdId?: string; pairId?: string; clutchId?: string; eggId?: string }; sourceType?: string; sourceId?: string | null; clutchId?: string; eggId?: string; pairId?: string };
  const source = linked.source;
  const eggId = source?.eggId || linked.eggId || (linked.sourceType === 'egg' ? linked.sourceId ?? undefined : undefined);
  const clutchId = source?.clutchId || linked.clutchId || (linked.sourceType === 'clutch' ? linked.sourceId ?? undefined : undefined);
  const pairId = source?.pairId || linked.pairId || (linked.sourceType === 'pair' ? linked.sourceId ?? undefined : undefined);
  if (eggId || clutchId || pairId) return { view: 'breeding', eggId, clutchId, pairId, taskId: task.id };
  if (task.birdId || source?.birdId) return { view: 'birds', birdId: task.birdId ?? source?.birdId, taskId: task.id };
  return { view: 'tasks', taskId: task.id };
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export type LocalSearchResult = { id: string; group: 'Aves' | 'Pessoas' | 'Vendas e reservas' | 'Documentos'; title: string; detail: string; target: NavigationTarget; text: string };

/** Index metadata only: never visits file contents or prepares an attachment preview. */
export function buildLocalSearchIndex(state: State, scope: Scope): LocalSearchResult[] {
  const birds = new Map(state.birds.filter(record => record.scope === scope).map(record => [record.id, record]));
  const contacts = new Map(state.contacts.filter(record => record.scope === scope).map(record => [record.id, record]));
  const rows: Omit<LocalSearchResult, 'text'>[] = [];
  for (const bird of birds.values()) rows.push({ id: bird.id, group: 'Aves', title: bird.name ? `${bird.name} · ${bird.identification}` : bird.identification, detail: `${bird.species} · ${bird.status}`, target: { view: 'birds', birdId: bird.id } });
  for (const contact of contacts.values()) if(contact.kind!=='interessado') rows.push({ id: contact.id, group: 'Pessoas', title: contact.name, detail: [contact.kind, contact.phone, contact.email].filter(Boolean).join(' · '), target: { view: 'contacts', contactId: contact.id } });
  for (const sale of state.sales) if (sale.scope === scope) rows.push({ id: sale.id, group: 'Vendas e reservas', title: `${sale.number} · ${contacts.get(sale.contactId)?.name ?? 'Sem contato'}`, detail: `${sale.status} · ${sale.items.map(item => item.description).join(' · ')}`, target: { view: 'sales', saleId: sale.id } });
  for (const file of state.attachments) if (file.scope === scope) rows.push({ id: file.id, group: 'Documentos', title: file.title, detail: [file.fileName, file.category, birds.get(file.birdId ?? '')?.identification].filter(Boolean).join(' · '), target: { view: 'documents', attachmentId: file.id } });
  for (const file of state.documents) if (file.scope === scope) rows.push({ id: file.id, group: 'Documentos', title: file.title, detail: [file.fileName, file.kind, birds.get(file.birdId ?? '')?.identification].filter(Boolean).join(' · '), target: { view: file.kind.toLocaleLowerCase('pt-BR').includes('caderneta') ? 'booklet' : 'documents', issuedDocumentId: file.id, birdId: file.birdId ?? undefined, saleId: file.saleId ?? undefined } });
  return rows.map(row => ({ ...row, text: normalize(`${row.title} ${row.detail}`) }));
}

export function searchLocalIndex(index: LocalSearchResult[], query: string, limitPerGroup = 8): LocalSearchResult[] {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const counts = new Map<string, number>();
  return index.filter(row => {
    if (!terms.every(term => row.text.includes(term))) return false;
    const count = counts.get(row.group) ?? 0;
    if (count >= limitPerGroup) return false;
    counts.set(row.group, count + 1);
    return true;
  });
}

export type NavigationEntry = { target: NavigationTarget; sector: Sector; scope: Scope; scroll: number; search?: string };
export function pushNavigation(history: NavigationEntry[], entry: NavigationEntry): NavigationEntry[] {
  const previous = history.at(-1);
  if (previous && JSON.stringify(previous.target) === JSON.stringify(entry.target) && previous.sector === entry.sector && previous.scope === entry.scope) return [...history.slice(0, -1), entry];
  return [...history.slice(-39), entry];
}
