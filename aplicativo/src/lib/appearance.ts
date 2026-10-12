export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface AppearanceSnapshot {
  readonly preference: ThemePreference;
  readonly theme: ResolvedTheme;
}

interface AppearanceStore {
  getSnapshot: () => AppearanceSnapshot;
  subscribe: (listener: () => void) => () => void;
  setPreference: (preference: ThemePreference) => void;
}

declare global {
  interface Window {
    __recantoAppearance?: AppearanceStore;
  }
}

export const APPEARANCE_STORAGE_KEY = 'recanto.ui.theme';
const fallback: AppearanceSnapshot = Object.freeze({ preference: 'system', theme: 'light' });

function store() {
  return typeof window === 'undefined' ? undefined : window.__recantoAppearance;
}

// The synchronous, external theme-init.js owns initialization and all visual
// preference changes. Keeping a single store also keeps multiple controls in sync.
export function getAppearanceSnapshot(): AppearanceSnapshot {
  return store()?.getSnapshot() ?? fallback;
}

export function subscribeAppearance(listener: () => void): () => void {
  return store()?.subscribe(listener) ?? (() => {});
}

export function setAppearancePreference(preference: ThemePreference): void {
  store()?.setPreference(preference);
}
