import { motion } from 'motion/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useId, useSyncExternalStore } from 'react';
import { getAppearanceSnapshot, setAppearancePreference, subscribeAppearance, type ThemePreference } from '../lib/appearance';
import { cn } from '../ui/cn';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema escuro', icon: Moon },
  { value: 'system', label: 'Igual ao aparelho', icon: Monitor },
];

/** Claro / escuro / sistema, on navy surfaces (tone ink) or light panels. */
export function ThemeSwitch({ compact = false, tone = 'ink' }: { compact?: boolean; tone?: 'ink' | 'light' }) {
  const { preference } = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceSnapshot);
  const id = useId();
  const shown = compact ? options.filter(o => o.value === preference) : options;
  return <div role="group" aria-label="Aparência" className={cn('inline-flex items-center gap-1 rounded-xl p-1', tone === 'ink' ? 'bg-ink-foreground/8 ring-1 ring-ink-foreground/10' : 'bg-secondary')}>
    {shown.map(o => {
      const active = preference === o.value;
      const next = compact ? options[(options.findIndex(x => x.value === o.value) + 1) % options.length]!.value : o.value;
      return <button type="button" key={o.value} title={o.label} aria-label={o.label} aria-pressed={active} onClick={() => setAppearancePreference(next)}
        className={cn('relative grid size-8 place-items-center rounded-lg transition-colors', tone === 'ink' ? (active ? 'text-ink' : 'text-ink-muted hover:text-ink-foreground') : (active ? 'text-ink-foreground' : 'text-muted-foreground'))}>
        {active && <motion.span layoutId={`theme-${id}`} className={cn('absolute inset-0 rounded-lg', tone === 'ink' ? 'bg-ink-foreground' : 'bg-ink')} transition={{ type: 'spring', stiffness: 420, damping: 34 }}/>}
        <o.icon className="relative size-4"/>
      </button>;
    })}
  </div>;
}
