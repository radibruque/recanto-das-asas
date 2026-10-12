import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY, getAppearanceSnapshot, setAppearancePreference, subscribeAppearance,
  type AppearanceSnapshot, type ThemePreference,
} from '../src/lib/appearance';

const bootstrap = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');

interface BootstrapStore {
  getSnapshot: () => AppearanceSnapshot;
  subscribe: (listener: () => void) => () => void;
  setPreference: (preference: ThemePreference | string) => void;
}

function browser(options: {
  saved?: string; dark?: boolean; blockedRead?: boolean; blockedWrite?: boolean;
  blockedStorageGetter?: boolean; missingMedia?: boolean; legacyMedia?: boolean;
} = {}) {
  const values = new Map<string, string>();
  if (options.saved !== undefined) values.set(APPEARANCE_STORAGE_KEY, options.saved);
  const storage = {
    getItem: vi.fn((key: string) => {
      if (options.blockedRead) throw new Error('Storage disabled');
      return values.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (options.blockedWrite) throw new Error('Storage full');
      values.set(key, value);
    }),
  };
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
  const meta = { content: '', setAttribute(name: string, value: string) { if (name === 'content') this.content = value; } };
  let mediaListener: ((event: { matches: boolean }) => void) | undefined;
  const media = {
    matches: options.dark ?? false,
    addEventListener: options.legacyMedia ? undefined : vi.fn((_type: string, listener: typeof mediaListener) => { mediaListener = listener; }),
    addListener: vi.fn((listener: typeof mediaListener) => { mediaListener = listener; }),
  };
  const events = new Map<string, (event: unknown) => void>();
  const windowLike = {
    get localStorage() {
      if (options.blockedStorageGetter) throw new Error('Origin storage blocked');
      return storage;
    },
    matchMedia: vi.fn(() => {
      if (options.missingMedia) throw new Error('Media query unsupported');
      return media;
    }),
    addEventListener: vi.fn((event: string, listener: (event: unknown) => void) => { events.set(event, listener); }),
    __recantoAppearance: undefined as BootstrapStore | undefined,
  };
  const context = createContext({
    window: windowLike,
    document: { documentElement: root, querySelector: () => meta },
  });
  runInContext(bootstrap, context);
  return {
    store: windowLike.__recantoAppearance!, root, meta, storage, values, windowLike,
    systemChange(dark: boolean) { media.matches = dark; mediaListener?.({ matches: dark }); },
    storageChange(key: string | null, newValue: string | null, storageArea: unknown = storage) {
      events.get('storage')?.({ key, newValue, storageArea });
    },
    runAgain() { runInContext(bootstrap, context); },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Preferência visual isolada', () => {
  it('aplica o tema do sistema antes de React quando não há escolha salva', () => {
    const app = browser({ dark: true });
    expect(app.store.getSnapshot()).toEqual({ preference: 'system', theme: 'dark' });
    expect(app.root.dataset).toEqual({ theme: 'dark', themePreference: 'system' });
    expect(app.root.style.colorScheme).toBe('dark');
    expect(app.meta.content).toBe('#273B40');
    expect(app.storage.getItem).toHaveBeenCalledExactlyOnceWith('recanto.ui.theme');
    expect(app.storage.setItem).not.toHaveBeenCalled();
  });

  it('dá prioridade à escolha manual salva sem alterá-la quando o sistema muda', () => {
    const app = browser({ saved: 'light', dark: true });
    expect(app.store.getSnapshot()).toEqual({ preference: 'light', theme: 'light' });
    expect(app.meta.content).toBe('#F5F8F6');
    const listener = vi.fn();
    app.store.subscribe(listener);
    app.systemChange(false); app.systemChange(true);
    expect(listener).not.toHaveBeenCalled();
    expect(app.root.dataset.theme).toBe('light');
    app.store.setPreference('dark');
    expect(app.values.get(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(app.storage.setItem).toHaveBeenCalledExactlyOnceWith(APPEARANCE_STORAGE_KEY, 'dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('acompanha mudanças do sistema ao vivo e ao voltar da seleção manual', () => {
    const app = browser({ dark: false });
    app.systemChange(true);
    expect(app.store.getSnapshot().theme).toBe('dark');
    app.store.setPreference('light');
    app.systemChange(false);
    app.store.setPreference('system');
    expect(app.store.getSnapshot()).toEqual({ preference: 'system', theme: 'light' });
    app.systemChange(true);
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.values.get(APPEARANCE_STORAGE_KEY)).toBe('system');
  });

  it('trata valores desconhecidos como Sistema e recusa escolhas inválidas', () => {
    const app = browser({ saved: 'unexpected-value', dark: true });
    const initial = app.store.getSnapshot();
    expect(initial.preference).toBe('system');
    app.store.setPreference('unexpected-value');
    expect(app.store.getSnapshot()).toBe(initial);
    expect(app.storage.setItem).not.toHaveBeenCalled();
  });

  it('permanece utilizável com leitura, escrita ou acesso a localStorage bloqueados', () => {
    for (const options of [
      { blockedRead: true }, { blockedWrite: true }, { blockedStorageGetter: true },
    ]) {
      const app = browser({ ...options, dark: true });
      expect(app.store.getSnapshot()).toEqual({ preference: 'system', theme: 'dark' });
      expect(() => app.store.setPreference('light')).not.toThrow();
      expect(app.root.dataset.theme).toBe('light');
      expect(app.store.getSnapshot().preference).toBe('light');
    }
  });

  it('usa claro como fallback sem matchMedia e aceita o listener legado', () => {
    const unsupported = browser({ missingMedia: true });
    expect(unsupported.store.getSnapshot()).toEqual({ preference: 'system', theme: 'light' });
    unsupported.store.setPreference('dark');
    expect(unsupported.root.dataset.theme).toBe('dark');
    const legacy = browser({ legacyMedia: true });
    legacy.systemChange(true);
    expect(legacy.root.dataset.theme).toBe('dark');
  });

  it('atualiza outras janelas pela chave visual, ignorando chaves e storage alheios', () => {
    const app = browser({ saved: 'light', dark: true });
    app.storageChange('unrelated-key', 'dark');
    app.storageChange(APPEARANCE_STORAGE_KEY, 'dark', {});
    expect(app.root.dataset.theme).toBe('light');
    app.storageChange(APPEARANCE_STORAGE_KEY, 'dark');
    expect(app.store.getSnapshot()).toEqual({ preference: 'dark', theme: 'dark' });
    app.storageChange(APPEARANCE_STORAGE_KEY, 'unknown');
    expect(app.store.getSnapshot().preference).toBe('system');
    app.storageChange(APPEARANCE_STORAGE_KEY, 'light');
    app.storageChange(null, null);
    expect(app.store.getSnapshot()).toEqual({ preference: 'system', theme: 'dark' });
    expect(app.storage.setItem).not.toHaveBeenCalled();
  });

  it('mantém snapshots estáveis, sincroniza assinantes e remove assinaturas no cleanup', () => {
    const app = browser();
    const first = vi.fn(), second = vi.fn();
    const unsubscribe = app.store.subscribe(first);
    app.store.subscribe(second);
    const initial = app.store.getSnapshot();
    app.store.setPreference('system');
    expect(app.store.getSnapshot()).toBe(initial);
    expect(first).not.toHaveBeenCalled();
    app.store.setPreference('dark');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribe(); unsubscribe();
    app.store.setPreference('light');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(app.store.getSnapshot())).toBe(true);
  });

  it('não cria listeners ou inicialização duplicados se o bootstrap executar novamente', () => {
    const app = browser();
    const initialStore = app.store;
    app.runAgain();
    expect(app.windowLike.__recantoAppearance).toBe(initialStore);
    expect(app.windowLike.addEventListener).toHaveBeenCalledTimes(1);
    expect(app.windowLike.matchMedia).toHaveBeenCalledTimes(1);
    expect(app.storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('o adaptador React reutiliza o bootstrap e não toca na base de registros', () => {
    const app = browser({ dark: true });
    vi.stubGlobal('window', app.windowLike);
    expect(getAppearanceSnapshot()).toBe(app.store.getSnapshot());
    const listener = vi.fn();
    const cleanup = subscribeAppearance(listener);
    setAppearancePreference('light');
    expect(getAppearanceSnapshot().theme).toBe('light');
    expect(listener).toHaveBeenCalledTimes(1);
    cleanup();
    setAppearancePreference('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(app.storage.getItem).toHaveBeenCalledExactlyOnceWith(APPEARANCE_STORAGE_KEY);
    expect(app.storage.setItem.mock.calls.map(call => call[0])).toEqual([APPEARANCE_STORAGE_KEY, APPEARANCE_STORAGE_KEY]);
  });

  it('oferece um snapshot estável sem browser para renderização e ferramentas', () => {
    vi.stubGlobal('window', undefined);
    const snapshot = getAppearanceSnapshot();
    expect(snapshot).toEqual({ preference: 'system', theme: 'light' });
    expect(getAppearanceSnapshot()).toBe(snapshot);
    expect(() => setAppearancePreference('dark')).not.toThrow();
    expect(() => subscribeAppearance(vi.fn())()).not.toThrow();
  });
});
