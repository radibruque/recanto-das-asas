import { cn } from './cn';

/** Símbolo das aves + nome, versão negativa para fundo escuro. */
export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <div className={cn('flex items-center gap-3', className)}>
    <img src="/brand/simbolo-branco.svg" alt="" className="h-10 w-auto shrink-0"/>
    {!compact && <img src="/brand/nome-branco.svg" alt="Recanto das Asas" className="h-9 w-auto"/>}
  </div>;
}
