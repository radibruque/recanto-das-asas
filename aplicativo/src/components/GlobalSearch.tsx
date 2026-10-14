import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Scope, State } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { buildLocalSearchIndex, searchLocalIndex } from '../lib/navigation';

export default function GlobalSearch({ state, scope, navigate }: { state: State; scope: Scope; navigate: (target: NavigationTarget) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(query);
  const index = useMemo(() => buildLocalSearchIndex(state, scope), [state.birds, state.contacts, state.sales, state.attachments, state.documents, scope]);
  const results = useMemo(() => searchLocalIndex(index, deferred), [index, deferred]);
  useEffect(() => { if (open) { dialog.current?.showModal(); input.current?.focus(); } else dialog.current?.close(); }, [open]);
  useEffect(() => { setOpen(false); setQuery(''); }, [scope]);
  const groups = ['Aves', 'Pessoas', 'Vendas e reservas', 'Documentos'] as const;
  return <><button type="button" className="button secondary global-search-trigger" onClick={() => setOpen(true)}><Search size={18} aria-hidden="true"/><span>Buscar em tudo</span></button>
    <dialog ref={dialog} className="modal global-search-dialog" aria-labelledby="global-search-heading" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className="stack"><div className="row modal-heading"><h2 id="global-search-heading">Busca global local</h2><button type="button" className="icon-button" aria-label="Fechar busca global" onClick={() => setOpen(false)}><X/></button></div>
        <label className="field">Buscar aves, anilhas, pessoas, vendas e documentos<input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, anilha ou número da venda"/></label>
        <p className="muted">Busca somente nos registros deste aparelho e deste espaço.</p>
        <div className="global-search-results" aria-live="polite" aria-busy={query !== deferred}>{query.trim() ? results.length ? groups.map(group => { const rows = results.filter(row => row.group === group); return rows.length > 0 && <section key={group}><h3>{group}</h3>{rows.map(row => <button type="button" className="global-search-result" key={`${group}-${row.id}`} onClick={() => { setOpen(false); navigate(row.target); }}><strong>{row.title}</strong><small>{row.detail}</small></button>)}</section>; }) : <p className="empty">Nenhum registro corresponde à busca.</p> : <p className="empty">Digite para localizar um registro e abri-lo diretamente.</p>}</div>
      </div>
    </dialog>
  </>;
}
