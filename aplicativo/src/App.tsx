import { APP_VERSION } from './domain/types';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bird, ClipboardPlus, Egg, FlaskConical, HeartPulse, KeyRound, Receipt, Search, ShoppingBag, ShoppingCart, Sparkles, UserPlus, X } from 'lucide-react';
import Breeding from './modules/Breeding';
import Commercial from './modules/Commercial';
import Documents from './modules/Documents';
import Settings, { backupVault } from './modules/Settings';
import { Vault } from './lib/storage';
import { synchronizeVault } from './lib/synchronize';
import { syncFailureLabel } from './lib/sync';
import { maintainVault } from './lib/maintenance';
import { applyCommand } from './domain/engine';
import type { State, Scope, ModuleProps } from './domain/types';
import type { NavigationTarget } from './domain/ui-target';
import type { Sector } from './lib/navigation';
import { clearDeviceKey, generateBaseKey, readDeviceKey, saveDeviceKey } from './lib/device-key';
import { defaultDeviceName, devicePlatform, getPreferences, usePreferences } from './lib/preferences';
import { buildNotices, buildSchedule, type Notice } from './lib/notices';
import { syncDeviceNotifications } from './lib/notify';
import { Sidebar } from './shell/Sidebar';
import { MobileNav } from './shell/MobileNav';
import { DesktopTopBar, MobileTopBar } from './shell/TopBar';
import type { QuickAction } from './shell/QuickActions';
import { allMenu, allViews, breedingViews, commercialViews, menuForView, type MenuId, type View } from './shell/nav';
import Today from './screens/Today';
import { BreedingOverview, CashOverview, ReportsOverview, SalesOverview } from './screens/Overviews';
import DeviceSettings from './screens/DeviceSettings';
import Identity from './screens/Identity';
import { Button, PageHeader, SegmentedTabs } from './ui/bits';
import { BrandLockup } from './ui/Brand';
import { Stagger } from './ui/motion';
import { cn } from './ui/cn';

const moduleSearch: Partial<Record<View, string>> = {
  birds: 'Nome, anilha ou espécie', family: 'Nome, anilha ou espécie', pairs: 'Buscar casais', breeding: 'Buscar reprodução', health: 'Buscar saúde e manejo', tasks: 'Buscar tarefas',
  clients: 'Buscar clientes', suppliers: 'Buscar fornecedores', sales: 'Número, cliente ou ave', finance: 'Buscar movimentações', stock: 'Buscar materiais', booklet: 'Buscar cadernetas', reports: 'Buscar relatórios',
};

/** Translate old navigation targets (Pessoas, Documentos) to the new screens. */
function normalizeTarget(state: State, scope: Scope, destination: NavigationTarget): NavigationTarget {
  if (destination.view === 'contacts') {
    const contact = destination.contactId ? state.contacts.find(c => c.id === destination.contactId && c.scope === scope) : undefined;
    return { ...destination, view: contact?.kind === 'fornecedor' || destination.filter === 'fornecedor' ? 'suppliers' : 'clients' };
  }
  if (destination.view === 'documents') {
    if (destination.birdId) return { view: 'birds', birdId: destination.birdId, filter: 'documentos' };
    if (destination.saleId) return { view: 'sales', saleId: destination.saleId };
    const file = state.attachments.find(a => a.id === destination.attachmentId);
    if (file?.birdId) return { view: 'birds', birdId: file.birdId, filter: 'documentos' };
    if (file?.saleId) return { view: 'sales', saleId: file.saleId };
    return { view: 'birds' };
  }
  return destination;
}

function Gate({ vault, exists, onOpen }: { vault: Vault; exists: boolean; onOpen: (s: State) => void }) {
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function start() {
    setBusy(true); setError('');
    try { const key = generateBaseKey(); const s = await vault.create(key); saveDeviceKey(key); onOpen(s); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível começar.'); } finally { setBusy(false); }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    setBusy(true); setError('');
    try { const s = exists ? await vault.unlock(password) : await vault.create(password); saveDeviceKey(password); onOpen(s); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível abrir.'); } finally { setBusy(false); }
  }
  return <main className="ui grid min-h-screen place-items-center bg-feather p-5 text-ink-foreground">
    <motion.div initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6 }} className="w-full max-w-md">
      <div className="mb-8 flex justify-center"><img src="/brand/logo-vertical-branco.svg" alt="Recanto das Asas" className="h-36 w-auto"/></div>
      <div className="rounded-[32px] bg-card p-7 text-foreground shadow-float">
        {exists ? <form onSubmit={submit} className="flex flex-col gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-tint-sky text-primary"><KeyRound className="size-5"/></span>
          <h1 className="text-2xl">Só desta vez: digite a senha antiga</h1>
          <p className="text-sm text-muted-foreground">A versão {APP_VERSION} abre direto, sem senha. Para destrancar os seus registros neste aparelho, digite uma única vez a senha que você usava. Depois disso o app não pede mais.</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Senha que você usava<input name="password" type="password" required autoFocus autoComplete="current-password" className="h-12 rounded-2xl bg-secondary px-4 outline-none ring-teal/50 focus:ring-2"/></label>
          {error && <p role="alert" className="rounded-2xl bg-tint-coral px-4 py-3 text-sm text-coral">{error}</p>}
          <Button type="submit" size="lg" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir meus registros'}</Button>
        </form> : mode === 'choose' ? <div className="flex flex-col gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-tint-sun"><Sparkles className="size-5"/></span>
          <h1 className="text-2xl">Bem-vindo ao Recanto das Asas</h1>
          <p className="text-sm text-muted-foreground">Seus registros ficam guardados neste aparelho. Se você já usa o app no celular ou no computador, escolha a segunda opção para ligar os dois.</p>
          {error && <p role="alert" className="rounded-2xl bg-tint-coral px-4 py-3 text-sm text-coral">{error}</p>}
          <Button size="lg" disabled={busy} onClick={() => void start()}>{busy ? 'Preparando…' : 'Começar meu criatório'}</Button>
          <Button size="lg" variant="secondary" onClick={() => setMode('join')}>Já uso em outro aparelho</Button>
        </div> : <form onSubmit={submit} className="flex flex-col gap-4">
          <h1 className="text-2xl">Ligar a este aparelho</h1>
          <p className="text-sm text-muted-foreground">Digite a chave da base do seu outro aparelho. Ela aparece lá em Configurações e suporte → Sincronização (se o outro aparelho veio da versão antiga, é a mesma senha que você usava). Depois, restaure um backup ou configure a sincronização para trazer os registros.</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Chave da base<input name="password" type="password" required minLength={10} autoFocus className="h-12 rounded-2xl bg-secondary px-4 outline-none ring-teal/50 focus:ring-2"/></label>
          {error && <p role="alert" className="rounded-2xl bg-tint-coral px-4 py-3 text-sm text-coral">{error}</p>}
          <Button type="submit" size="lg" disabled={busy}>{busy ? 'Preparando…' : 'Continuar'}</Button>
          <Button variant="ghost" onClick={() => setMode('choose')}>Voltar</Button>
        </form>}
      </div>
      <p className="mt-6 text-center text-xs text-ink-muted">Versão {APP_VERSION} · Português do Brasil</p>
    </motion.div>
  </main>;
}

export default function App() {
  const [vault] = useState(() => new Vault()), [exists, setExists] = useState<boolean | null>(null), [needsKey, setNeedsKey] = useState(false);
  const [state, setState] = useState<State | null>(null), [scope, setScope] = useState<Scope>('real');
  const [view, setView] = useState<View>('home'), [search, setSearch] = useState(''), [message, setMessage] = useState('');
  const [syncText, setSyncText] = useState('Local · offline disponível');
  const [target, setTarget] = useState<NavigationTarget>({ view: 'home' }), [sector, setSector] = useState<Sector>('breeding');
  const prefs = usePreferences();
  const targets = useRef(new Map<string, NavigationTarget>()), searches = useRef(new Map<string, string>()), positions = useRef(new Map<string, number>()), request = useRef(0);
  const uiContexts = useRef(new Map<string, Map<string, unknown>>()), backHandler = useRef<() => void>(() => {});
  const sessionVersion = useRef(0), backupRunning = useRef(false), stateRef = useRef(state); stateRef.current = state;
  const notify = useCallback((text: string) => setMessage(text), []);

  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 6000); return () => clearTimeout(t); }, [message]);

  // Open directly: the base password is asked once per device and remembered.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const has = await vault.exists();
        if (!active) return;
        setExists(has);
        if (!has) return;
        const key = readDeviceKey();
        if (!key) { setNeedsKey(true); return; }
        try { const data = await vault.unlock(key); if (active) acceptUnlocked(data); }
        catch { clearDeviceKey(); if (active) setNeedsKey(true); }
      } catch (e) { notify(e instanceof Error ? e.message : 'Não foi possível abrir os registros.'); }
    })();
    return () => { active = false; };
  }, [vault]);

  useEffect(() => { const back = () => backHandler.current(); window.addEventListener('recanto:native-back', back); return () => window.removeEventListener('recanto:native-back', back); }, []);
  const command = useCallback(async (action: string, data: unknown) => { const generation = sessionVersion.current; const result = await vault.mutate(s => applyCommand(s, scope, action, data)); if (generation === sessionVersion.current && stateRef.current) setState(current => current && current.revision > result.state.revision ? current : result.state); return result.id; }, [scope, vault]);

  // Synchronization loop (unchanged behavior). Safety copies are released after a clean sync.
  useEffect(() => {
    if (!state) return; let cancelled = false;
    const update = async () => { const generation = sessionVersion.current; try { const result = await maintainVault(vault, async () => { const meta = await vault.metadata(); return meta.sync ? await synchronizeVault(vault) : null; }); if (!result) { setSyncText('Local · offline disponível'); return; } if (cancelled || generation !== sessionVersion.current) return; if (result.status === 'conflict') { setSyncText('Conflito pendente'); return; } if (result.state) setState(result.state); setSyncText(result.pending ? 'Alterações aguardando conexão' : 'Sincronização em dia'); if (!result.pending) { void vault.releaseSafetyCopies().catch(() => {}); markDeviceSeen(result.state ?? stateRef.current); } } catch (error) { if (!cancelled && generation === sessionVersion.current) setSyncText(syncFailureLabel(error)); } };
    const timer = setInterval(update, 30000); window.addEventListener('online', update); update(); return () => { cancelled = true; clearInterval(timer); window.removeEventListener('online', update); };
  }, [!!state, vault]);

  // Automatic backup: weekly by default (or the interval chosen in Configurações).
  useEffect(() => {
    if (!state || backupRunning.current) return;
    const effectiveDays = (d: number) => d === 1 ? 7 : d; // 0.3 default was daily; 0.4 is weekly
    const days = effectiveDays(state.settings.backupDays);
    const due = !state.settings.lastBackupAt || Date.now() - new Date(state.settings.lastBackupAt).valueOf() > days * 86400000; if (!due) return;
    backupRunning.current = true; const generation = sessionVersion.current;
    (async () => { try { const saved = await maintainVault(vault, async () => { const current = await vault.load(); if (current.settings.lastBackupAt && Date.now() - new Date(current.settings.lastBackupAt).valueOf() <= effectiveDays(current.settings.backupDays) * 86400000) return { state: current }; const result = await backupVault(vault, current); return vault.mutate(s => applyCommand(s, scope, 'backup.record', result)); }); if (generation === sessionVersion.current && stateRef.current) setState(current => current && current.revision > saved.state.revision ? current : saved.state); } catch (error) { if (stateRef.current) notify('Backup automático pendente: ' + (error instanceof Error ? error.message : 'verifique o armazenamento.')); } finally { backupRunning.current = false; } })();
  }, [state?.settings.lastBackupAt, vault, scope, notify]);

  const notices = useMemo(() => state ? buildNotices(state, scope, prefs) : [], [state, scope, prefs]);
  useEffect(() => { if (!state) return; const t = setTimeout(() => { void syncDeviceNotifications(buildSchedule(state, scope, prefs)); }, 1500); return () => clearTimeout(t); }, [state?.revision, scope, prefs]);
  useEffect(() => { const open = (e: Event) => { const t = (e as CustomEvent<NavigationTarget>).detail; if (t) navigate(t); }; window.addEventListener('recanto:open-target', open); return () => window.removeEventListener('recanto:open-target', open); });

  function markDeviceSeen(current: State | null) {
    if (!current) return;
    const p = getPreferences();
    const mine = current.settings.devices?.find(d => d.id === p.deviceId);
    const name = p.deviceName || defaultDeviceName();
    if (mine && mine.name === name && Date.now() - new Date(mine.lastSeen).valueOf() < 12 * 3600000) return;
    void vault.mutate(s => applyCommand(s, 'real', 'device.seen', { id: p.deviceId, name, platform: devicePlatform(), lastSeen: new Date().toISOString() })).then(r => { if (stateRef.current) setState(c => c && c.revision > r.state.revision ? c : r.state); }).catch(() => {});
  }
  function acceptUnlocked(data: State) { sessionVersion.current++; stateRef.current = data; setState(data); setExists(true); setNeedsKey(false); setMessage(''); }

  if (!state) {
    if (exists === null || (exists && !needsKey)) return <main className="ui grid min-h-screen place-items-center bg-feather"><motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }}><BrandLockup/></motion.div></main>;
    backHandler.current = () => window.dispatchEvent(new Event('recanto:native-root-back'));
    return <Gate vault={vault} exists={exists} onOpen={acceptUnlocked}/>;
  }

  const viewKey = (name: string, space = scope) => space + ':' + name;
  const restoreScroll = (position: number) => requestAnimationFrame(() => requestAnimationFrame(() => (document.getElementById('main-scroll') ?? window).scrollTo({ top: position, behavior: 'instant' as ScrollBehavior })));
  const scrollPos = () => document.getElementById('main-scroll')?.scrollTop || window.scrollY;
  function navigate(raw: NavigationTarget) {
    const destination = normalizeTarget(state!, scope, raw);
    if (destination.view === 'home' && destination.filter) { setSector(destination.filter === 'commercial' ? 'commercial' : 'breeding'); }
    if (!allViews.includes(destination.view as View)) return;
    const next = destination.view as View, key = viewKey(next), currentKey = viewKey(view);
    searches.current.set(currentKey, search); positions.current.set(currentKey, scrollPos());
    if (breedingViews.has(next)) setSector('breeding'); else if (commercialViews.has(next)) setSector('commercial');
    const resolved = { ...destination, request: ++request.current }; targets.current.set(key, resolved);
    setTarget(resolved); setView(next);
    setSearch(destination.filter || destination.birdId || destination.saleId || destination.contactId || destination.attachmentId || destination.issuedDocumentId ? '' : searches.current.get(key) ?? '');
    restoreScroll(destination.birdId || destination.saleId || destination.contactId || destination.createAction ? 0 : positions.current.get(key) ?? 0);
  }
  // Android back: close an open window, then leave the record, then go to Hoje, then minimize.
  const goBack = () => {
    const nativeDialog = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).find(d => !d.closest('[hidden]'));
    if (nativeDialog) { if (nativeDialog.dispatchEvent(new Event('cancel', { cancelable: true }))) nativeDialog.close(); return; }
    const otherDialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(d => !d.closest('[hidden]'));
    if (otherDialog) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return; }
    const event = new CustomEvent('recanto:back', { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    if (target.birdId || target.saleId || target.contactId || target.billId) { navigate({ view }); return; }
    if (view !== 'home') navigate({ view: 'home' });
    else window.dispatchEvent(new CustomEvent('recanto:native-root-back'));
  };
  backHandler.current = goBack;
  const changeScope = (next: Scope) => { if (next === scope) return; searches.current.set(viewKey(view), search); positions.current.set(viewKey(view), scrollPos()); setScope(next); setSearch(searches.current.get(viewKey(view, next)) ?? ''); setTarget(targets.current.get(viewKey(view, next)) ?? { view }); restoreScroll(positions.current.get(viewKey(view, next)) ?? 0); };
  const generation = sessionVersion.current; const commitState = (next: State) => { if (generation === sessionVersion.current && stateRef.current) setState(next); };
  const activeKey = viewKey(view);
  let uiContext = uiContexts.current.get(activeKey);
  if (!uiContext) { uiContext = new Map<string, unknown>(); uiContexts.current.set(activeKey, uiContext); }
  const props: RoutedProps = { state, scope, command, notify, search, target, navigate, back: goBack, uiContext };
  const menu = menuForView(view);
  const openMenu = (id: MenuId) => navigate({ view: allMenu.find(m => m.id === id)?.views[0]?.view ?? 'home' });
  const switchSector = (next: Sector) => { setSector(next); if (view !== 'home') navigate({ view: 'home', filter: next }); };
  const onNotice = (n: Notice) => { if (n.target) navigate(n.target); };

  const actions: QuickAction[] = sector === 'breeding' ? [
    { label: 'Nova ave', icon: Bird, tone: 'bg-tint-sky text-primary', run: () => navigate({ view: 'birds', createAction: 'bird' }) },
    { label: 'Registrar postura', icon: Egg, tone: 'bg-tint-sun text-foreground', run: () => navigate({ view: 'breeding', createAction: 'clutch' }) },
    { label: 'Ocorrência de saúde', icon: HeartPulse, tone: 'bg-tint-coral text-coral', run: () => navigate({ view: 'health', createAction: 'health' }) },
    { label: 'Nova tarefa', icon: ClipboardPlus, tone: 'bg-tint-teal text-teal', run: () => navigate({ view: 'tasks', createAction: 'task' }) },
    { label: 'Nova venda', icon: ShoppingBag, tone: 'bg-tint-leaf text-leaf', run: () => navigate({ view: 'sales', createAction: 'sale' }) },
  ] : [
    { label: 'Nova venda', icon: ShoppingBag, tone: 'bg-tint-leaf text-leaf', run: () => navigate({ view: 'sales', createAction: 'sale' }) },
    { label: 'Nova reserva', icon: Sparkles, tone: 'bg-tint-sun text-foreground', run: () => navigate({ view: 'sales', createAction: 'reservation' }) },
    { label: 'Registrar compra', icon: ShoppingCart, tone: 'bg-tint-sky text-primary', run: () => navigate({ view: 'stock', createAction: 'purchase' }) },
    { label: 'Conta a pagar ou receber', icon: Receipt, tone: 'bg-tint-coral text-coral', run: () => navigate({ view: 'finance', createAction: 'bill' }) },
    { label: 'Novo cliente', icon: UserPlus, tone: 'bg-tint-teal text-teal', run: () => navigate({ view: 'clients', createAction: 'contact' }) },
  ];

  const sectionLabel = view === 'home' ? (sector === 'commercial' ? 'Resumo' : 'Hoje') : menu.label;
  const searchLabel = moduleSearch[view];

  return <div className="min-h-screen bg-feather lg:flex">
    <Sidebar active={menu.id} onOpen={openMenu} sector={sector} onSector={switchSector} scope={scope} onScope={changeScope} syncText={syncText}/>
    <div className="relative min-w-0 flex-1 lg:py-3 lg:pr-3">
      <MobileTopBar section={sectionLabel} state={state} scope={scope} navigate={navigate} notices={notices} onNotice={onNotice} ownerName={prefs.ownerName} onProfile={() => navigate({ view: 'settings' })}/>
      <main id="main-scroll" className="relative mt-5 min-h-[calc(100vh-84px)] rounded-t-[32px] bg-background pb-32 lg:mt-0 lg:h-[calc(100vh-24px)] lg:min-h-0 lg:overflow-y-auto lg:rounded-[32px] lg:pb-10">
        <DesktopTopBar state={state} scope={scope} navigate={navigate} notices={notices} onNotice={onNotice} actions={actions} syncText={syncText} ownerName={prefs.ownerName} onProfile={() => navigate({ view: 'settings' })}/>
        <motion.div key={activeKey + (view === 'home' ? sector : '')} initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="px-4 pt-6 md:px-6 lg:px-8 lg:pt-2">
          {scope === 'demo' && <div className="ui mb-5 flex flex-wrap items-center gap-3 rounded-3xl bg-tint-sun px-5 py-3 text-sm">
            <FlaskConical className="size-4"/><strong>Demonstração · dados fictícios.</strong><span className="text-muted-foreground">Os exemplos ficam separados dos registros do seu criatório.</span>
            {!state.birds.some(b => b.scope === 'demo') && <Button size="sm" className="ml-auto" onClick={() => command('initializeDemo', {}).catch(e => notify(e.message))}>Criar exemplos fictícios</Button>}
          </div>}
          {view === 'home' ? <div className="ui"><Today {...props} navigate={navigate} sector={sector} notices={notices}/></div> : <>
            <Stagger className="ui mb-6 flex flex-col gap-4">
              <PageHeader eyebrow={menu.eyebrow} title={menu.label} description={menu.description}
                actions={menu.views.length > 1 ? <SegmentedTabs value={view} onChange={v => navigate({ view: v })} options={menu.views.map(v => ({ value: v.view, label: v.label }))}/> : undefined}/>
              {searchLabel && <label className="group flex h-11 max-w-md items-center gap-3 rounded-2xl bg-card px-4 shadow-soft ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-teal/50">
                <Search className="size-4 text-muted-foreground group-focus-within:text-teal"/>
                <input value={search} onChange={e => { setSearch(e.target.value); searches.current.set(activeKey, e.target.value); }} placeholder={searchLabel} type="search" aria-label={searchLabel} className="h-full flex-1 bg-transparent text-sm outline-none"/>
              </label>}
            </Stagger>
            {view === 'finance' && <CashOverview state={state} scope={scope} navigate={navigate}/>}
            {view === 'sales' && <SalesOverview state={state} scope={scope} navigate={navigate}/>}
            {(view === 'breeding' || view === 'pairs') && <BreedingOverview state={state} scope={scope} navigate={navigate}/>}
            {view === 'reports' && <ReportsOverview state={state} scope={scope} navigate={navigate}/>}
            {view === 'settings' && <DeviceSettings state={state} notify={notify}/>}
            {view === 'arts' ? <Identity notify={notify}/> : <div key={activeKey} className="legacy cached-view" data-view={view}><RoutedModule props={props} vault={vault} commitState={commitState} view={view}/></div>}
          </>}
          <footer className="ui mt-10 flex flex-wrap justify-between gap-2 pb-4 text-[11px] text-muted-foreground"><span>Recanto das Asas · {APP_VERSION}</span><span>{scope === 'demo' ? 'Exemplos fictícios' : 'Seu criatório'} · Horário de Brasília</span></footer>
        </motion.div>
      </main>
    </div>
    <MobileNav active={menu.id} onOpen={openMenu} sector={sector} onSector={switchSector} scope={scope} onScope={changeScope} actions={actions}/>
    <AnimatePresence>
      {message && <motion.div role="status" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className={cn('ui fixed inset-x-4 bottom-24 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-ink-foreground shadow-float lg:bottom-6 lg:right-6 lg:left-auto')}>
        <span className="flex-1">{message}</span>
        <button type="button" aria-label="Dispensar mensagem" onClick={() => setMessage('')} className="text-ink-muted hover:text-ink-foreground"><X className="size-4"/></button>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

type RoutedProps = ModuleProps & { target?: NavigationTarget; navigate: (target: NavigationTarget) => void; back: () => void };
function RoutedModule({ props, vault, commitState, view }: { props: RoutedProps; vault: Vault; commitState: (state: State) => void; view: View }) {
  const moduleTarget = props.target ? { ...props.target, view: props.target.view === 'clients' || props.target.view === 'suppliers' ? 'contacts' : props.target.view } : props.target;
  const p = { ...props, target: moduleTarget };
  if (['birds', 'pairs', 'breeding', 'family', 'health', 'tasks'].includes(view)) return <Breeding {...p} view={view as 'birds'} initialBirdId={props.target?.birdId ?? null} initialCreate={props.target?.createAction === 'bird'}/>;
  if (view === 'clients' || view === 'suppliers') return <Commercial {...p} view="contacts" contactKind={view === 'clients' ? 'cliente' : 'fornecedor'}/>;
  if (['sales', 'finance', 'stock'].includes(view)) return <Commercial {...p} view={view as 'sales'}/>;
  if (['reports', 'booklet', 'arts'].includes(view)) return <Documents {...p} view={view as 'reports'}/>;
  return <Settings {...p} vault={vault} setState={commitState} view={view as 'settings'}/>;
}
