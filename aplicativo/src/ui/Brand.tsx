import { cn } from './cn';

/**
 * Main full-colour logo. The artwork was drawn for a white background (its dark-blue
 * lettering disappears on navy), so it always sits on its own light plate: a rounded
 * card in the expanded menu and a round badge with the birds when space is short.
 */
export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) return <BrandBadge className={className}/>;
  return <div className={cn('flex w-full items-center justify-center rounded-[22px] bg-plate px-4 py-2.5 shadow-float ring-1 ring-ink-foreground/10', className)}>
    <img src="/brand/logo-principal.webp" alt="Recanto das Asas" className="h-[92px] w-auto object-contain"/>
  </div>;
}

/** Round badge with the four birds of the main logo. */
export function BrandBadge({ className, size = 44 }: { className?: string; size?: number }) {
  return <span style={{ width: size, height: size }} className={cn('grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-plate shadow-soft ring-1 ring-ink-foreground/15', className)}>
    <img src="/brand/logo-aves.webp" alt="Recanto das Asas" className="size-[118%] max-w-none object-cover"/>
  </span>;
}
