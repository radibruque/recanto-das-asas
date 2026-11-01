import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Attachment, Bird, Scope, State } from '../domain/types';
import { useAttachmentUrl } from '../components/DirectAttachments';
import { cn } from './cn';
import { AnimatedNumber, riseItem } from './motion';

export type Tone = 'sky' | 'teal' | 'leaf' | 'sun' | 'coral' | 'ink';
export const toneClasses: Record<Tone, { bg: string; fg: string; dot: string }> = {
  sky: { bg: 'bg-tint-sky', fg: 'text-primary', dot: 'bg-sky' },
  teal: { bg: 'bg-tint-teal', fg: 'text-teal', dot: 'bg-teal' },
  leaf: { bg: 'bg-tint-leaf', fg: 'text-leaf', dot: 'bg-leaf' },
  sun: { bg: 'bg-tint-sun', fg: 'text-foreground', dot: 'bg-sun' },
  coral: { bg: 'bg-tint-coral', fg: 'text-coral', dot: 'bg-coral' },
  ink: { bg: 'bg-ink', fg: 'text-ink-foreground', dot: 'bg-ink' },
};

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <motion.div variants={riseItem} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">{eyebrow}</p>
      <h1 className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
      {description && <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </motion.div>;
}

export function Panel({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: string; subtitle?: ReactNode; action?: ReactNode }) {
  return <motion.section variants={riseItem} className={cn('rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 md:p-6', className)}>
    {(title || action) && <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {title && <h2 className="font-sans text-base font-bold text-foreground">{title}</h2>}
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>}
    {children}
  </motion.section>;
}

export function StatCard({ label, value, format, icon: Icon, tone = 'sky', delta, hint, onClick }: { label: string; value: number; format?: (n: number) => string; icon: LucideIcon; tone?: Tone; delta?: number; hint?: string; onClick?: () => void }) {
  const t = toneClasses[tone];
  const dark = tone === 'ink';
  const Tag = onClick ? motion.button : motion.div;
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} variants={riseItem} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    className={cn('group relative block w-full min-w-0 overflow-hidden rounded-3xl p-4 text-left sm:p-5', dark ? 'bg-feather text-ink-foreground shadow-float' : cn(t.bg, 'text-foreground'))}>
    <div className="flex items-start justify-between">
      <span className={cn('grid size-10 place-items-center rounded-2xl transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110', dark ? 'bg-ink-foreground/12' : 'bg-card shadow-soft')}>
        <Icon className={cn('size-5', dark ? 'text-sun' : t.fg)}/>
      </span>
      {delta !== undefined && Number.isFinite(delta) && <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold', dark ? 'bg-ink-foreground/12' : 'bg-card/80', delta >= 0 ? (dark ? 'text-sun' : 'text-leaf') : 'text-coral')}>
        {delta >= 0 ? <ArrowUpRight className="size-3"/> : <ArrowDownRight className="size-3"/>}{Math.abs(delta)}%
      </span>}
    </div>
    <p className={cn('mt-4 truncate text-sm font-medium sm:mt-5', dark ? 'text-ink-muted' : 'text-muted-foreground')}>{label}</p>
    <p className="mt-0.5 whitespace-nowrap font-display text-xl font-semibold tabular-nums min-[400px]:text-2xl md:text-3xl"><AnimatedNumber value={value} format={format}/></p>
    {hint && <p className={cn('mt-1 text-xs', dark ? 'text-ink-muted' : 'text-muted-foreground')}>{hint}</p>}
  </Tag>;
}

const statusTone: Record<string, Tone> = {
  disponível: 'leaf', reprodutor: 'teal', reservado: 'sun', manejo: 'coral', vendido: 'ink', filhote: 'sky',
  doado: 'sky', transferido: 'sky', falecido: 'coral',
  orçamento: 'sky', reservada: 'sun', vendida: 'teal', entregue: 'leaf', cancelada: 'coral', devolvida: 'coral',
  pendente: 'sun', vencida: 'coral', paga: 'leaf', recebida: 'leaf', incubando: 'teal', eclodido: 'leaf', infértil: 'coral', perdido: 'coral',
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = toneClasses[statusTone[status.toLocaleLowerCase('pt-BR')] ?? 'sky'];
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize', t.bg, t.fg, className)}>
    <span className={cn('size-1.5 rounded-full', t.dot)}/>{status}
  </span>;
}

export function speciesImage(species: string) {
  const s = species.toLocaleLowerCase('pt-BR');
  if (s.includes('calopsita') || s.includes('nymphicus')) return '/especies/ave-calopsita.jpg';
  if (s.includes('periquito') || s.includes('melopsittacus')) return '/especies/ave-periquito.jpg';
  if (s.includes('agapornis')) return '/especies/ave-agapornis.jpg';
  if (s.includes('ringneck') || s.includes('psittacula')) return '/especies/ave-ringneck.jpg';
  return '';
}
export const shortSpecies = (s: string) => s.split(' (')[0] ?? s;

/** Bird photo: the main photo attachment when there is one, else the species picture. */
export function BirdPhoto({ bird, photo, size = 44, className, fill = false }: { bird: Pick<Bird, 'species' | 'name' | 'identification'>; photo?: Attachment; size?: number; className?: string; fill?: boolean }) {
  const { url } = useAttachmentUrl(photo && photo.mime.startsWith('image/') ? photo : null);
  const src = url || speciesImage(bird.species);
  const style = fill ? undefined : { width: size, height: size };
  if (!src) return <span style={style} className={cn('grid shrink-0 place-items-center rounded-2xl bg-tint-sky ring-2 ring-card', fill && 'size-full rounded-none ring-0', className)}>
    <img src="/brand/simbolo-azul.svg" alt="" className="w-3/5 opacity-70"/>
  </span>;
  return <img src={src} alt={bird.name || bird.identification} loading="lazy" style={style}
    className={cn('shrink-0 rounded-2xl object-cover object-top ring-2 ring-card', fill && 'size-full rounded-none ring-0', className)}/>;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-2xl bg-ink px-3 py-2 text-xs text-ink-foreground shadow-float">
    <p className="mb-1 font-bold">{label}</p>
    {payload.map(p => <p key={p.name} className="flex items-center gap-2 text-ink-muted">
      <span className="size-2 rounded-full" style={{ background: p.color }}/>{p.name}: <span className="font-semibold text-ink-foreground">{format ? format(p.value) : p.value}</span>
    </p>)}
  </div>;
}

export interface SegmentOption<T extends string> { value: T; label: string; icon?: LucideIcon; count?: number }
export function SegmentedTabs<T extends string>({ options, value, onChange, tone = 'light', size = 'md', className }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; tone?: 'light' | 'ink'; size?: 'sm' | 'md'; className?: string }) {
  const id = useId();
  return <div role="tablist" className={cn('relative inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-2xl p-1 scrollbar-none', tone === 'light' ? 'bg-secondary' : 'bg-ink-foreground/8 ring-1 ring-ink-foreground/10', className)}>
    {options.map(o => {
      const active = o.value === value;
      const Icon = o.icon;
      return <button type="button" key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
        className={cn('relative z-0 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors duration-300', size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
          tone === 'light' ? (active ? 'text-ink-foreground' : 'text-muted-foreground hover:text-foreground') : (active ? 'text-ink' : 'text-ink-muted hover:text-ink-foreground'))}>
        {active && <span className={cn('absolute inset-0 -z-10 rounded-xl', tone === 'light' ? 'bg-ink shadow-soft' : 'bg-ink-foreground')}/>} 
        {Icon && <Icon className="size-4"/>}{o.label}
        {o.count !== undefined && <span className={cn('rounded-full px-1.5 text-[10px] leading-4 transition-colors', active ? (tone === 'light' ? 'bg-ink-foreground/20' : 'bg-ink/10') : 'bg-card/70 text-muted-foreground')}>{o.count}</span>}
      </button>;
    })}
  </div>;
}

type ButtonVariant = 'ink' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'outline';
const buttonVariants: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-ink-foreground shadow-soft hover:bg-ink-2',
  brand: 'bg-brand text-primary-foreground shadow-glow',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-secondary',
  danger: 'bg-coral text-ink-foreground hover:opacity-90',
  outline: 'bg-card text-foreground ring-1 ring-border hover:bg-secondary',
};
export function Button({ variant = 'ink', size = 'md', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  return <button type="button" {...props} className={cn('press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold [&_svg]:size-4',
    size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm', buttonVariants[variant], className)}>{children}</button>;
}

/** Sheet that slides from the bottom on phones and from the right on desktop. */
export function Sheet({ open, onClose, title, children, side = 'bottom', className }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; side?: 'bottom' | 'right' | 'center'; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(<AnimatePresence>
    {open && <div className="ui fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <motion.button aria-label="Fechar" className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}/>
      <motion.div
        initial={side === 'center' ? { opacity: 0, scale: 0.96 } : side === 'bottom' ? { y: '100%' } : { x: '100%' }} animate={side === 'center' ? { opacity: 1, scale: 1 } : side === 'bottom' ? { y: 0 } : { x: 0 }} exit={side === 'center' ? { opacity: 0, scale: 0.96 } : side === 'bottom' ? { y: '100%' } : { x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className={cn('absolute overflow-y-auto bg-background text-foreground shadow-float', side === 'center' ? 'inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl rounded-3xl p-5' : side === 'bottom' ? 'inset-x-0 bottom-0 max-h-[88vh] rounded-t-[32px] px-5 pb-10 pt-5' : 'inset-y-0 right-0 w-full max-w-xl rounded-l-[32px] p-6', className)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-display text-2xl font-semibold">{title}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="press grid size-10 place-items-center rounded-xl bg-secondary"><X className="size-4"/></button>
        </div>
        {children}
      </motion.div>
    </div>}
  </AnimatePresence>, document.body);
}

/** Small photo + name of a bird, used wherever a bird is mentioned. */
export function BirdChip({ state, scope, birdId, bird: given, onClick, size = 32, sub, className }: { state: State; scope: Scope; birdId?: string | null; bird?: Bird; onClick?: () => void; size?: number; sub?: ReactNode; className?: string }) {
  const bird = given ?? (birdId ? state.birds.find(b => b.id === birdId && b.scope === scope) : undefined);
  if (!bird) return <span className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>{birdId === undefined ? '' : 'Ave não informada'}</span>;
  const photo = bird.photoId ? state.attachments.find(a => a.id === bird.photoId && a.scope === scope) : undefined;
  const body = <>
    <BirdPhoto bird={bird} photo={photo} size={size} className="rounded-xl ring-1"/>
    <span className="min-w-0 text-left leading-tight">
      <span className="block truncate text-sm font-semibold text-foreground">{bird.name || bird.identification}</span>
      <span className="block truncate text-[11px] text-muted-foreground">{sub ?? [bird.name ? bird.identification : '', bird.mutation].filter(Boolean).join(' · ')}</span>
    </span>
  </>;
  const cls = cn('ui inline-flex min-w-0 max-w-full items-center gap-2 align-middle', onClick && 'press rounded-2xl pr-2 hover:bg-secondary', className);
  return onClick ? <button type="button" onClick={onClick} className={cls} aria-label={`Abrir ficha de ${bird.name || bird.identification}`}>{body}</button> : <span className={cls}>{body}</span>;
}

/** Compact pill select used by the simple filters. */
export function PillSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  const active = !!value;
  return <label className={cn('relative inline-flex h-9 shrink-0 items-center rounded-full text-xs font-semibold transition-colors', active ? 'bg-ink text-ink-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted', className)}>
    <span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} className="h-9 cursor-pointer appearance-none rounded-full bg-transparent py-2 pl-3.5 pr-8 outline-none [&>option]:bg-card [&>option]:text-foreground">
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 opacity-70"/>
  </label>;
}
