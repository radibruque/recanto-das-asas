import type { Bird, PriceEntry, Scope, State } from './types';

const norm = (v: string | undefined | null) => (v ?? '').trim().toLocaleLowerCase('pt-BR');

/** Name the price table uses for a bird's species (catalog name when linked). */
export function birdSpeciesName(state: State, bird: Pick<Bird, 'species' | 'speciesId'>): string {
  const catalog = bird.speciesId ? state.settings.speciesCatalog.find(s => s.id === bird.speciesId) : undefined;
  return catalog?.name ?? bird.species;
}

export const priceEntries = (state: State, scope: Scope) => (state.settings.priceTable ?? []).filter(e => e.scope === scope);

/**
 * Best table price for a bird (market price by species + mutation): species must match;
 * an entry with the same mutation beats "any mutation". Returns null when nothing matches.
 */
export function birdTablePrice(state: State, scope: Scope, bird: Pick<Bird, 'species' | 'speciesId' | 'mutation' | 'sex'>): number | null {
  const species = norm(birdSpeciesName(state, bird));
  const aliases = new Set([species, norm(bird.species)]);
  let best: { score: number; price: number } | null = null;
  for (const e of priceEntries(state, scope)) {
    if (e.kind !== 'ave' || !aliases.has(norm(e.species))) continue;
    if (e.mutation && norm(e.mutation) !== norm(bird.mutation)) continue;
    const score = e.mutation ? 1 : 0;
    if (!best || score > best.score) best = { score, price: e.priceCents };
  }
  return best ? best.price : null;
}

/** Price for a bird in a sale: its own asking price first, then the table. */
export function birdSalePrice(state: State, scope: Scope, bird: Bird): number | null {
  if (bird.priceCents) return bird.priceCents;
  return birdTablePrice(state, scope, bird);
}

export function productTablePrice(state: State, scope: Scope, productId: string): number | null {
  return priceEntries(state, scope).find(e => e.kind === 'produto' && e.productId === productId)?.priceCents ?? null;
}

export const serviceEntries = (state: State, scope: Scope): PriceEntry[] => priceEntries(state, scope).filter(e => e.kind === 'serviço');
