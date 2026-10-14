import type { Attachment, Scope, State } from '../domain/types';

/** Follow current and legacy bird links in linear passes, without opening file contents. */
export function filesForBird(state: State, scope: Scope, birdId: string): Attachment[] {
  const bird = state.birds.find(record => record.scope === scope && record.id === birdId);
  if (!bird) return [];
  const linked = new Set<string>();
  if (bird.photoId) linked.add(bird.photoId);
  for (const entry of bird.sexHistory ?? []) if (entry.attachmentId) linked.add(entry.attachmentId);
  for (const event of state.health) if (event.scope === scope && event.birdId === birdId) for (const id of event.attachmentIds) linked.add(id);
  for (const entry of state.mutations) if (entry.scope === scope && entry.birdId === birdId && entry.attachmentId) linked.add(entry.attachmentId);
  const sales = new Set(state.sales.filter(sale => sale.scope === scope && sale.items.some(item => item.kind === 'ave' && item.refId === birdId)).map(sale => sale.id));
  return state.attachments.filter(file => file.scope === scope && (file.birdId === birdId || linked.has(file.id) || !!file.saleId && sales.has(file.saleId)));
}
