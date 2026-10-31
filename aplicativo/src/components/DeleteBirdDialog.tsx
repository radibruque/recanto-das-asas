import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Bird, Scope, State } from '../domain/types';
import { BirdPhoto, Button, Sheet } from '../ui/bits';

/** What deleting a bird takes with it (shown before confirming). */
export function deletionSummary(state: State, scope: Scope, bird: Bird) {
  const pairs = state.pairs.filter(p => p.scope === scope && (p.maleId === bird.id || p.femaleId === bird.id));
  const clutches = state.clutches.filter(c => c.scope === scope && pairs.some(p => p.id === c.pairId));
  const eggs = state.eggs.filter(e => e.scope === scope && clutches.some(c => c.id === e.clutchId));
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const lines = [
    [state.health.filter(h => h.scope === scope && h.birdId === bird.id).length, 'registro de saúde/peso', 'registros de saúde/peso'],
    [state.tasks.filter(t => t.scope === scope && (t.birdId === bird.id || t.sourceId === bird.id)).length, 'tarefa', 'tarefas'],
    [state.attachments.filter(a => a.scope === scope && a.birdId === bird.id).length + state.documents.filter(d => d.scope === scope && d.birdId === bird.id).length, 'foto/documento', 'fotos/documentos'],
    [pairs.length, 'casal', 'casais'],
    [clutches.length, 'postura', 'posturas'],
    [eggs.length, 'ovo', 'ovos'],
  ].filter(([n]) => (n as number) > 0).map(([n, one, many]) => plural(n as number, one as string, many as string));
  const children = state.birds.filter(b => b.scope === scope && (b.fatherId === bird.id || b.motherId === bird.id)).length;
  const sales = state.sales.filter(s => s.scope === scope && s.items.some(i => i.kind === 'ave' && i.refId === bird.id)).length;
  return { lines, children, sales };
}

export default function DeleteBirdDialog({ state, scope, bird, open, onClose, onConfirm }: { state: State; scope: Scope; bird: Bird; open: boolean; onClose: () => void; onConfirm: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const { lines, children, sales } = deletionSummary(state, scope, bird);
  const photo = bird.photoId ? state.attachments.find(a => a.id === bird.photoId && a.scope === scope) : undefined;
  return <Sheet open={open} onClose={() => !busy && onClose()} title="Excluir ave" className="sm:inset-x-auto sm:left-1/2 sm:w-[min(520px,calc(100%-2rem))] sm:-translate-x-1/2">
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
        <BirdPhoto bird={bird} photo={photo} size={56}/>
        <div className="min-w-0"><p className="truncate font-display text-lg font-semibold">{bird.name || bird.identification}</p><p className="truncate text-xs text-muted-foreground">{bird.identification} · {bird.species}</p></div>
      </div>
      <div className="flex gap-3 rounded-2xl bg-tint-coral p-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral"/>
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">A ave e tudo o que é só dela será apagado de vez{lines.length ? ':' : '.'}</p>
          {lines.length > 0 && <ul className="list-disc pl-4 text-muted-foreground">{lines.map(l => <li key={l} className="list-item">{l}</li>)}</ul>}
          {children > 0 && <p className="text-muted-foreground">{children} {children === 1 ? 'filho continua' : 'filhos continuam'} no plantel, sem esse pai/mãe.</p>}
          {sales > 0 && <p className="text-muted-foreground">{sales} {sales === 1 ? 'venda continua' : 'vendas continuam'} com os valores e pagamentos; o item vira “Ave excluída”.</p>}
          <p className="text-muted-foreground">Não dá para desfazer. Se quiser guardar, faça um backup antes.</p>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="danger" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}><Trash2/>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</Button>
      </div>
    </div>
  </Sheet>;
}
