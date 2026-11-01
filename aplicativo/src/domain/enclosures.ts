import { z } from 'zod';
import type { Enclosure, State, Scope } from './types';
import { ensure, id, required } from './shared';
export const enclosureStatuses = ['disponível', 'vazio', 'ocupado', 'manutenção', 'fora de uso'] as const;
export const enclosureBirds = (state: State, scope: Scope, name: string) => state.birds.filter(b => b.scope === scope && b.enclosure === name);
export function enclosureOptions(state: State, scope: Scope): Enclosure[] {
  const saved = (state.settings.enclosures ?? []).filter(e => e.scope === scope);
  const legacy = [...new Set(state.birds.filter(b => b.scope === scope && b.enclosure).map(b => b.enclosure))].filter(name => !saved.some(e => e.name === name));
  return [...saved, ...legacy.map(name => ({ id: `legacy:${name}`, scope, name, status: 'ocupado' as const }))];
}
export function saveEnclosure(state: State, scope: Scope, input: unknown): string {
  const data = z.object({ id: required.optional(), name: required, status: z.enum(enclosureStatuses) }).parse(input);
  const list = state.settings.enclosures ?? [];
  const old = list.find(e => e.id === data.id && e.scope === scope);
  const oldName = old?.name ?? (data.id?.startsWith('legacy:') ? data.id.slice(7) : undefined);
  ensure(!list.some(e => e.scope === scope && e.id !== old?.id && e.name.toLocaleLowerCase('pt-BR') === data.name.toLocaleLowerCase('pt-BR')), 'Este recinto já está cadastrado.');
  const record = { ...data, id: old?.id ?? id(), scope };
  if (oldName && oldName !== data.name) {
    for (const b of enclosureBirds(state, scope, oldName)) b.enclosure = data.name;
    for (const p of state.pairs.filter(p => p.scope === scope && p.enclosure === oldName)) p.enclosure = data.name;
  }
  state.settings.enclosures = [...list.filter(e => e.id !== record.id), record];
  return record.id;
}
export function deleteEnclosure(state: State, scope: Scope, input: unknown): string {
  const { name } = z.object({ name: required }).parse(input);
  ensure(enclosureBirds(state, scope, name).length === 0, 'Mova todas as aves para outro recinto antes de excluir este.');
  state.settings.enclosures = (state.settings.enclosures ?? []).filter(e => e.scope !== scope || e.name !== name);
  for (const p of state.pairs.filter(p => p.scope === scope && p.enclosure === name)) p.enclosure = '';
  return name;
}