import { AnimatePresence, motion } from 'motion/react';
import { Bell, CloudOff, RefreshCw, Search, Wifi, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Scope, State } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { buildLocalSearchIndex, searchLocalIndex } from '../lib/navigation';
import type { Notice } from '../lib/notices';
import { BrandLockup } from '../ui/Brand';
import { cn } from '../ui/cn';
import { QuickActions, type QuickAction } from './QuickActions';

const toneDot: Record<Notice['tone'], string> = { coral: 'bg-coral', sun: 'bg-sun', teal: 'bg-teal', sky: 'bg-sky', leaf: 'bg-leaf' };

function Notifications({ notices, onOpen, dark = false }: { notices: Notice[]; onOpen: (n: Notice) => void; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button type="button" onClick={() => setOpen(o => !o)} aria-label={`Avisos (${notices.length})`}
      className={cn('press relative grid size-10 place-items-center rounded-xl', dark ? 'bg-ink-foreground/10 text-ink-foreground' : 'bg-card text-foreground shadow-soft ring-1 ring-border')}>
      <Bell className="size-[18px]"/>
      {notices.length > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-coral ring-2 ring-card"/>}
    </button>
    <AnimatePresence>
      {open && <>
        <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar avisos"/>
        <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute right-0 top-12 z-50 max-h-[70vh] w-80 origin-top-right overflow-y-auto rounded-3xl bg-card p-2 text-foreground shadow-float ring-1 ring-border">
          <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Avisos</p>
          {notices.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Nada pendente por aqui. Bom trabalho!</p>}
          {notices.map((a, i) => <motion.button type="button" key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * Math.min(i, 8) }}
            onClick={() => { setOpen(false); onOpen(a); }} className="flex w-full gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-secondary">
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[a.tone])}/>
            <span><span className="block text-sm font-semibold">{a.title}</span><span className="block text-xs text-muted-foreground">{a.detail}</span></span>
          </motion.button>)}
        </motion.div>
      </>}
    </AnimatePresence>
  </div>;
}

function SearchBox({ state, scope, navigate }: { state: State; scope: Scope; navigate: (t: NavigationTarget) => void }) {
  const [query, setQuery] = useState(''), [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(query);
  const index = useMemo(() => buildLocalSearchIndex(state, scope), [state.birds, state.contacts, state.sales, state.attachments, state.documents, scope]);
  const results = useMemo(() => searchLocalIndex(index, deferred, 5), [index, deferred]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const show = focused && query.trim().length > 0;
  return <div className="relative flex-1">
    <label className="group flex h-11 items-center gap-3 rounded-2xl bg-card px-4 shadow-soft ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-teal/50">
      <Search className="size-4 text-muted-foreground transition-colors group-focus-within:text-teal"/>
      <input ref={input} value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar ave, anilha, cliente ou venda…" className="h-full flex-1 bg-transparent text-sm outline-none" type="search"/>
      {query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X className="size-4 text-muted-foreground"/></button>
        : <kbd className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">Ctrl K</kbd>}
    </label>
    <AnimatePresence>
      {show && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        className="absolute inset-x-0 top-13 z-50 max-h-[60vh] overflow-y-auto rounded-3xl bg-card p-2 shadow-float ring-1 ring-border">
        {results.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum registro encontrado.</p>}
        {results.map(r => <button type="button" key={r.group + r.id} onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(''); input.current?.blur(); navigate(r.target); }}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-secondary">
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{r.title}</span><span className="block truncate text-xs text-muted-foreground">{r.detail}</span></span>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{r.group === 'Pessoas' ? 'Contatos' : r.group}</span>
        </button>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}

function SyncPill({ text }: { text: string }) {
  const ok = /em dia|offline disponível/i.test(text);
  const waiting = /aguardando/i.test(text);
  return <span title={text} className={cn('inline-flex h-11 items-center gap-2 rounded-2xl px-3 text-xs font-bold', ok ? 'bg-tint-leaf text-leaf' : waiting ? 'bg-tint-sun text-foreground' : 'bg-tint-coral text-coral')}>
    {ok ? <Wifi className="size-4"/> : waiting ? <RefreshCw className="size-4"/> : <CloudOff className="size-4"/>}
    <span className="hidden xl:inline">{/local/i.test(text) ? 'Neste aparelho' : ok ? 'Sincronizado' : waiting ? 'Aguardando' : 'Verificar'}</span>
  </span>;
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'RA';

export function DesktopTopBar({ state, scope, navigate, notices, onNotice, actions, syncText, ownerName, onProfile }: { state: State; scope: Scope; navigate: (t: NavigationTarget) => void; notices: Notice[]; onNotice: (n: Notice) => void; actions: QuickAction[]; syncText: string; ownerName: string; onProfile: () => void }) {
  return <div className="ui sticky top-0 z-30 hidden items-center gap-3 bg-background/80 px-8 py-4 backdrop-blur-xl lg:flex">
    <SearchBox state={state} scope={scope} navigate={navigate}/>
    <SyncPill text={syncText}/>
    <QuickActions placement="top" actions={actions}/>
    <Notifications notices={notices} onOpen={onNotice}/>
    <button type="button" onClick={onProfile} className="press flex items-center gap-3 rounded-2xl bg-card py-1.5 pl-1.5 pr-4 text-left shadow-soft ring-1 ring-border">
      <span className="grid size-8 place-items-center rounded-xl bg-brand text-xs font-bold text-primary-foreground">{initials(ownerName || 'R A')}</span>
      <span className="leading-tight"><span className="block text-sm font-bold">{ownerName || 'Seu nome'}</span><span className="block text-[11px] text-muted-foreground">{scope === 'demo' ? 'Demonstração' : state.settings.name}</span></span>
    </button>
  </div>;
}

export function MobileTopBar({ section, state, scope, navigate, notices, onNotice, ownerName, onProfile }: { section: string; state: State; scope: Scope; navigate: (t: NavigationTarget) => void; notices: Notice[]; onNotice: (n: Notice) => void; ownerName: string; onProfile: () => void }) {
  const [searching, setSearching] = useState(false);
  return <div className="ui px-5 pt-5 text-ink-foreground lg:hidden" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BrandLockup compact className="[&_img]:h-9"/>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky">Recanto das Asas{scope === 'demo' ? ' · Demonstração' : ''}</p>
          <AnimatePresence mode="wait">
            <motion.p key={section} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="font-display text-lg font-semibold">{section}</motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setSearching(s => !s)} aria-label="Buscar" className="press grid size-10 place-items-center rounded-xl bg-ink-foreground/10"><Search className="size-[18px]"/></button>
        <Notifications dark notices={notices} onOpen={onNotice}/>
        <button type="button" onClick={onProfile} aria-label="Seu perfil" className="grid size-10 place-items-center rounded-xl bg-brand text-xs font-bold ring-1 ring-ink-foreground/15">{initials(ownerName || 'R A')}</button>
      </div>
    </div>
    <AnimatePresence>
      {searching && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-foreground">
        <SearchBox state={state} scope={scope} navigate={t => { setSearching(false); navigate(t); }}/>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
