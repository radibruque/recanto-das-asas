import { useState } from 'react';
import type { ModuleProps } from '../domain/types';
import { formCatalogs } from '../domain/form-catalogs';
import { Button } from '../ui/bits';
export default function FormCatalogSettings({ state, command, notify }: ModuleProps) {
 const lists = formCatalogs(state), [busy, setBusy] = useState(false);
 return <form className="ui space-y-4 py-6" onSubmit={async e => {
 e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true);
 try { await command('catalogs.save', Object.fromEntries(['mutations', 'sexMethods', 'healthKinds'].map(key => [key, [...new Set(String(form.get(key)).split('\n').map(v => v.trim()).filter(Boolean))]]))); notify('Listas salvas.'); }
 catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
 finally { setBusy(false); }
 }}><h2 className="text-lg font-semibold">Opções dos cadastros</h2><div className="grid gap-4 md:grid-cols-3">{([['mutations', 'Mutações'], ['sexMethods', 'Métodos de sexagem'], ['healthKinds', 'Saúde e manejo']] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-2 text-sm font-medium">{label}<textarea name={key} defaultValue={lists[key].join('\n')} required rows={7} className="rounded-lg border border-border bg-card p-3 text-foreground"/></label>)}</div><Button type="submit" disabled={busy}>Salvar listas</Button></form>;
}
