import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

export function RecordField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function RecordDialog({ title, children, onClose, onSave, preparing = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (data: FormData) => Promise<string | undefined>;
  preparing?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || preparing) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const recordId = await onSave(data);
      if (recordId) onClose();
      else setError('Não foi possível salvar. Os campos foram preservados; confira a mensagem do sistema.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setBusy(false); }
  }
  return <dialog ref={ref} className="modal" aria-labelledby={heading} onCancel={e => { e.preventDefault(); if (!busy && !preparing) onClose(); }}>
    <form onSubmit={submit}>
      <div className="row"><h2 id={heading}>{title}</h2><button type="button" className="button secondary" onClick={onClose} disabled={busy || preparing} aria-label="Fechar formulário">Fechar</button></div>
      <fieldset disabled={busy || preparing} className="record-form-content">{children}</fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="toolbar"><button className="button" disabled={busy || preparing}>{busy ? 'Salvando…' : preparing ? 'Preparando arquivos…' : 'Salvar'}</button><button type="button" className="button secondary" onClick={onClose} disabled={busy || preparing}>Cancelar</button></div>
    </form>
  </dialog>;
}

export function RecordDetailsDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={heading} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="row"><h2 id={heading}>{title}</h2><button type="button" className="button secondary" onClick={onClose}>Fechar</button></div>
    {children}
  </dialog>;
}
