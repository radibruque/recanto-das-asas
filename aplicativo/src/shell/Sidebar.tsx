import { AnimatePresence, motion } from 'motion/react';
import { Bird, ChevronsLeft, FlaskConical, MonitorSmartphone, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import type { Scope } from '../domain/types';
import type { Sector } from '../lib/navigation';
import { BrandLockup } from '../ui/Brand';
import { SegmentedTabs } from '../ui/bits';
import { cn } from '../ui/cn';
import { menuGroups, type MenuId } from './nav';
import { ThemeSwitch } from './ThemeSwitch';

export function Sidebar({ active, onOpen, sector, onSector, scope, onScope, syncText }: { active: MenuId; onOpen: (id: MenuId) => void; sector: Sector; onSector: (s: Sector) => void; scope: Scope; onScope: (s: Scope) => void; syncText: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return <motion.aside animate={{ width: collapsed ? 88 : 268 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    className="ui sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden px-4 py-6 text-ink-foreground lg:flex">
    <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between pl-2')}>
      <button type="button" onClick={() => onOpen('home')} aria-label="Ir para Hoje"><BrandLockup compact={collapsed}/></button>
    </div>
    {!collapsed && <div className="mt-6 px-1">
      <SegmentedTabs tone="ink" size="sm" value={sector} onChange={onSector} className="w-full [&>button]:flex-1 [&>button]:justify-center"
        options={[{ value: 'breeding', label: 'Criatório', icon: Bird }, { value: 'commercial', label: 'Comercial', icon: ShoppingBag }]}/>
    </div>}

    <nav aria-label="Navegação principal" className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto scrollbar-none">
      {menuGroups.map(g => <div key={g.label}>
        <AnimatePresence initial={false}>
          {!collapsed && <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted/70">{g.label}</motion.p>}
        </AnimatePresence>
        <ul className="flex flex-col gap-1">
          {g.items.map(item => {
            const isActive = active === item.id;
            return <li key={item.id}>
              <button type="button" title={item.label} aria-current={isActive ? 'page' : undefined} onClick={() => onOpen(item.id)}
                className={cn('group relative flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors duration-300', collapsed && 'justify-center px-0', isActive ? 'text-ink-foreground' : 'text-ink-muted hover:text-ink-foreground')}>
                {isActive && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-2xl bg-ink-foreground/10 ring-1 ring-ink-foreground/10" transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sun"/>
                </motion.span>}
                <item.icon className={cn('relative size-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110', isActive && 'text-sun')}/>
                {!collapsed && <span className="relative truncate">{item.label}</span>}
              </button>
            </li>;
          })}
        </ul>
      </div>)}
    </nav>

    <div className="mt-4 flex flex-col gap-2">
      {!collapsed && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2 rounded-2xl bg-ink-foreground/6 p-3 ring-1 ring-ink-foreground/10">
        <div className="flex items-center gap-2 text-xs font-semibold"><MonitorSmartphone className="size-4 text-sky"/>Windows + Android</div>
        <p className="text-[11px] text-ink-muted">{syncText}</p>
        <SegmentedTabs tone="ink" size="sm" value={scope} onChange={onScope} className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[{ value: 'real', label: 'Meu criatório' }, { value: 'demo', label: 'Demonstração', icon: FlaskConical }]}/>
      </motion.div>}
      <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
        <ThemeSwitch compact={collapsed}/>
        <button type="button" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} className="press ml-auto grid size-10 place-items-center rounded-xl text-ink-muted hover:bg-ink-foreground/8 hover:text-ink-foreground">
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }}><ChevronsLeft className="size-4"/></motion.span>
        </button>
      </div>
    </div>
  </motion.aside>;
}
