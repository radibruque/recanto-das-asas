import { AnimatePresence, motion } from 'motion/react';
import { Plus, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../ui/cn';

export type QuickAction = { label: string; icon: LucideIcon; tone: string; run: () => void };

/** Botão central "+" com menu que se abre em leque e abre os cadastros reais. */
export function QuickActions({ actions, placement = 'bottom' }: { actions: QuickAction[]; placement?: 'bottom' | 'top' }) {
  const [open, setOpen] = useState(false);
  const list = placement === 'bottom' ? [...actions].reverse() : actions;
  return <div className="relative">
    <AnimatePresence>
      {open && <>
        <motion.button type="button" aria-label="Fechar ações" className="fixed inset-0 z-40 cursor-default bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}/>
        <motion.ul className={cn('absolute z-50 flex w-60 flex-col gap-2', placement === 'bottom' ? 'bottom-[calc(100%+18px)] left-1/2 -translate-x-1/2' : 'right-0 top-[calc(100%+12px)]')}
          initial="hidden" animate="show" exit="hidden"
          variants={{ hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }, show: { transition: { staggerChildren: 0.05 } } }}>
          {list.map(a => <motion.li key={a.label} variants={{ hidden: { opacity: 0, y: placement === 'bottom' ? 16 : -10, scale: 0.92 }, show: { opacity: 1, y: 0, scale: 1 } }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <button type="button" onClick={() => { setOpen(false); a.run(); }} className="press flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 pr-4 text-left text-sm font-semibold text-foreground shadow-float ring-1 ring-border">
              <span className={cn('grid size-9 place-items-center rounded-xl', a.tone)}><a.icon className="size-4"/></span>{a.label}
            </button>
          </motion.li>)}
        </motion.ul>
      </>}
    </AnimatePresence>
    <motion.button type="button" aria-label="Novo cadastro" aria-expanded={open} onClick={() => setOpen(o => !o)} whileTap={{ scale: 0.9 }}
      className={cn('relative z-50 grid place-items-center rounded-full bg-brand text-primary-foreground shadow-glow', placement === 'bottom' ? 'size-14 ring-4 ring-background' : 'size-10', !open && placement === 'bottom' && 'animate-pulse-ring')}>
      <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}><Plus className={placement === 'bottom' ? 'size-6' : 'size-5'}/></motion.span>
    </motion.button>
  </div>;
}
