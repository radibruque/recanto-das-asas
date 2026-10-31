import { motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import type { Scope } from '../domain/types';
import type { Sector } from '../lib/navigation';
import { SegmentedTabs, Sheet } from '../ui/bits';
import { cn } from '../ui/cn';
import { allMenu, type MenuId } from './nav';
import { QuickActions, type QuickAction } from './QuickActions';
import { ThemeSwitch } from './ThemeSwitch';

/** Barra inferior flutuante (Android) com indicador deslizante e botão central. */
export function MobileNav({ active, onOpen, sector, onSector, scope, onScope, actions }: { active: MenuId; onOpen: (id: MenuId) => void; sector: Sector; onSector: (s: Sector) => void; scope: Scope; onScope: (s: Scope) => void; actions: QuickAction[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const left: MenuId[] = sector === 'breeding' ? ['home', 'birds'] : ['home', 'sales'];
  const right: MenuId[] = sector === 'breeding' ? ['sales'] : ['money'];
  const primary = [...left, ...right];
  const inPrimary = primary.includes(active);
  const Item = ({ id }: { id: MenuId }) => {
    const item = allMenu.find(m => m.id === id)!;
    const isActive = active === id;
    return <button type="button" onClick={() => onOpen(id)} className="relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold">
      {isActive && <motion.span layoutId="mobile-active" className="absolute inset-x-1 inset-y-1 rounded-2xl bg-ink-foreground/12" transition={{ type: 'spring', stiffness: 420, damping: 32 }}/>}
      <motion.span animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }} className="relative"><item.icon className={cn('size-5', isActive ? 'text-sun' : 'text-ink-muted')}/></motion.span>
      <span className={cn('relative', isActive ? 'text-ink-foreground' : 'text-ink-muted')}>{id === 'home' && sector === 'commercial' ? 'Resumo' : item.short}</span>
    </button>;
  };
  const current = allMenu.find(m => m.id === active);
  return <>
    <nav className="ui fixed inset-x-3 bottom-3 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center rounded-[26px] bg-ink px-2 shadow-float ring-1 ring-ink-foreground/10">
        {left.map(id => <Item key={id} id={id}/>)}
        <div className="-mt-8 flex flex-1 justify-center"><QuickActions actions={actions}/></div>
        {right.map(id => <Item key={id} id={id}/>)}
        <button type="button" onClick={() => setMoreOpen(true)} className="relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold">
          {!inPrimary && <motion.span layoutId="mobile-active" className="absolute inset-x-1 inset-y-1 rounded-2xl bg-ink-foreground/12"/>}
          <Menu className={cn('relative size-5', !inPrimary ? 'text-sun' : 'text-ink-muted')}/>
          <span className={cn('relative', !inPrimary ? 'text-ink-foreground' : 'text-ink-muted')}>{!inPrimary ? current?.short ?? 'Mais' : 'Mais'}</span>
        </button>
      </div>
    </nav>

    <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Módulos">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedTabs size="sm" value={sector} onChange={s => { onSector(s); setMoreOpen(false); }} options={[{ value: 'breeding', label: 'Criatório' }, { value: 'commercial', label: 'Comercial' }]}/>
        <SegmentedTabs size="sm" value={scope} onChange={s => { onScope(s); setMoreOpen(false); }} options={[{ value: 'real', label: 'Meu criatório' }, { value: 'demo', label: 'Demonstração' }]}/>
        <ThemeSwitch tone="light"/>
      </div>
      <motion.div className="grid grid-cols-3 gap-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
        {allMenu.map(n => {
          const isActive = active === n.id;
          return <motion.div key={n.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
            <button type="button" onClick={() => { setMoreOpen(false); onOpen(n.id); }}
              className={cn('press flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl p-2 text-center text-xs font-bold', isActive ? 'bg-ink text-ink-foreground shadow-float' : 'bg-card text-foreground shadow-soft')}>
              <n.icon className={cn('size-6', isActive ? 'text-sun' : 'text-teal')}/>
              {n.label}
              <span className={cn('text-[10px] font-medium', isActive ? 'text-ink-muted' : 'text-muted-foreground')}>{n.group}</span>
            </button>
          </motion.div>;
        })}
      </motion.div>
    </Sheet>
  </>;
}
