import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleProps, Task } from '../domain/types';
import { birdLabel, dateLabel, today } from '../domain/shared';
import { addTaskToCalendar, downloadTaskCalendar, hasNativeCalendar } from '../lib/calendar';

type StatusFilter = 'pendentes' | 'todas' | 'vencidas' | 'concluídas';
const statusLabel = (task: Task) => task.done ? 'Concluída' : task.dueDate < today() ? 'Vencida' : task.dueDate === today() ? 'Hoje' : 'Pendente';
const byDate = (a: Task, b: Task) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate) || (a.reminderTime ?? '').localeCompare(b.reminderTime ?? '') || a.title.localeCompare(b.title, 'pt-BR');

function AgendaDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="stack"><div className="row"><h2 id={heading}>{title}</h2><button type="button" className="button secondary" onClick={onClose}>Fechar</button></div>{children}</div>
  </dialog>;
}

export default function Agenda({ state, scope, command, notify, search, onEdit }: ModuleProps & { onEdit: (task: Task) => void }) {
  const [status, setStatus] = useState<StatusFilter>('pendentes');
  const [birdFilter, setBirdFilter] = useState(''), [from, setFrom] = useState(''), [until, setUntil] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null), [taskId, setTaskId] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { setGroupId(null); setTaskId(null); setBirdFilter(''); setFrom(''); setUntil(''); setStatus('pendentes'); }, [scope]);
  const tasks = state.tasks.filter(task => task.scope === scope);
  const birds = state.birds.filter(bird => bird.scope === scope);
  const findBird = (id: string | null) => birds.find(bird => bird.id === id);
  const taskBirdLabel = (task: Task) => task.birdId ? birdLabel(findBird(task.birdId)) : 'Tarefas gerais';
  const filtered = tasks.filter(task =>
    (status === 'todas' || (status === 'concluídas' ? task.done : !task.done && (status !== 'vencidas' || task.dueDate < today()))) &&
    (!birdFilter || (birdFilter === 'geral' ? !task.birdId : task.birdId === birdFilter)) &&
    (!from || task.dueDate >= from) && (!until || task.dueDate <= until) &&
    `${task.title} ${task.notes} ${taskBirdLabel(task)}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  ).slice().sort(byDate);
  const groups = [...new Set(filtered.map(task => task.birdId ?? 'geral'))].map(id => ({
    id, title: id === 'geral' ? 'Tarefas gerais' : birdLabel(findBird(id)), records: filtered.filter(task => (task.birdId ?? 'geral') === id),
  }));
  const selectedGroup = groups.find(group => group.id === groupId);
  const selectedTask = tasks.find(task => task.id === taskId);

  async function toggle(task: Task) {
    if (busy) return;
    setBusy(true);
    try {
      const id = await command('toggleTask', { id: task.id, done: !task.done });
      if (id) notify(task.done ? 'Tarefa reaberta.' : 'Tarefa concluída. Se criou um evento no calendário, ajuste ou remova o lembrete nele.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível alterar a tarefa.'); }
    finally { setBusy(false); }
  }

  async function calendar(task: Task, fileOnly = false) {
    if (busy) return;
    setBusy(true);
    try {
      const name = task.birdId ? taskBirdLabel(task) : '';
      if (fileOnly) await downloadTaskCalendar(task, name); else await addTaskToCalendar(task, name);
      notify(!fileOnly && hasNativeCalendar() ? 'Calendário aberto. Confira data, horário e lembrete, e toque em Salvar no calendário.' : 'Lembrete .ics preparado. Importe-o no seu calendário e confira a notificação.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível abrir o calendário. Você pode baixar o lembrete .ics.'); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    <div className="grid" aria-label="Resumo da agenda">
      <article className="card"><h3>Pendentes</h3><p><strong>{tasks.filter(task => !task.done).length}</strong> tarefas abertas</p></article>
      <article className="card"><h3>Hoje</h3><p><strong>{tasks.filter(task => !task.done && task.dueDate === today()).length}</strong> tarefas para hoje</p></article>
      <article className="card"><h3>Vencidas</h3><p><strong>{tasks.filter(task => !task.done && task.dueDate < today()).length}</strong> tarefas aguardando conclusão</p></article>
    </div>
    <div className="card stack">
      <h2>Tarefas por ave</h2>
      <div className="filters">
        <label className="field"><span>Situação das tarefas</span><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="pendentes">Pendentes</option><option value="vencidas">Vencidas</option><option value="concluídas">Concluídas</option><option value="todas">Todas</option></select></label>
        <label className="field"><span>Ave da tarefa</span><select value={birdFilter} onChange={event => setBirdFilter(event.target.value)}><option value="">Todas</option>{tasks.some(task => !task.birdId) && <option value="geral">Tarefas gerais</option>}{birds.filter(bird => tasks.some(task => task.birdId === bird.id)).map(bird => <option key={bird.id} value={bird.id}>{birdLabel(bird)}</option>)}</select></label>
        <label className="field"><span>Data a partir de</span><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
        <label className="field"><span>Data até</span><input type="date" value={until} onChange={event => setUntil(event.target.value)}/></label>
      </div>
      {from && until && from > until ? <p role="alert" className="error">A data inicial deve ser anterior ou igual à data final.</p> : groups.length ? <div className="table-wrap"><table><thead><tr><th>Ave ou categoria</th><th>Tarefas</th><th>Primeira data do filtro</th><th>Histórico</th></tr></thead><tbody>{groups.map(group => <tr key={group.id}><td><strong>{group.title}</strong></td><td>{group.records.length} · {group.records.filter(task => !task.done).length} pendentes</td><td>{dateLabel(group.records[0].dueDate)}{group.records[0].reminderTime && <> às {group.records[0].reminderTime}</>}</td><td><button className="button secondary" onClick={() => { setGroupId(group.id); setTaskId(null); }}>Ver tarefas</button></td></tr>)}</tbody></table></div> : <p className="empty">{tasks.length ? 'Nenhuma tarefa corresponde aos filtros.' : 'Nenhuma tarefa cadastrada. Use Nova tarefa para organizar os cuidados.'}</p>}
      <p className="muted">Aves aparecem quando têm tarefas nos filtros selecionados. Tarefas sem ave ficam em Tarefas gerais.</p>
    </div>
    <div className="notice"><p><strong>Lembretes no telefone e no computador</strong></p><p className="muted">Defina um horário na tarefa. No Android, abra os detalhes e adicione ao calendário do telefone; confira o lembrete e confirme em Salvar. No Windows, importe o arquivo .ics no seu calendário. O calendário escolhido cuida do aviso mesmo com este aplicativo fechado. Os horários usam Brasília.</p><p className="muted">O título, a ave e as observações serão enviados ao calendário escolhido. Editar ou concluir a tarefa no Recanto das Asas não altera esse evento: ajuste ou exclua o lembrete também no calendário.</p></div>
    {groupId !== null && !selectedTask && <AgendaDialog title={selectedGroup?.title ?? (groupId === 'geral' ? 'Tarefas gerais' : birdLabel(findBird(groupId)))} onClose={() => setGroupId(null)}>
      <p className="muted">Histórico de tarefas da ave ou categoria, conforme os filtros selecionados.</p>
      <div className="list">{selectedGroup?.records.map(task => <article className="stack" key={task.id}><div className="row"><strong>{task.title}</strong><span className="badge">{statusLabel(task)}</span></div><p className="muted">{dateLabel(task.dueDate)}{task.reminderTime && ` às ${task.reminderTime} (Brasília)`}</p>{task.notes && <p>{task.notes}</p>}<div className="row"><button className="button secondary" onClick={() => setTaskId(task.id)}>Ver detalhes</button><button className="button" disabled={busy} onClick={() => void toggle(task)}>{task.done ? 'Reabrir tarefa' : 'Concluir tarefa'}</button></div></article>)}</div>
      {!selectedGroup?.records.length && <p className="empty">Nenhuma tarefa neste grupo corresponde aos filtros.</p>}
    </AgendaDialog>}
    {selectedTask && <AgendaDialog title={selectedTask.title} onClose={() => setTaskId(null)}>
      <dl><dt>Ave</dt><dd>{taskBirdLabel(selectedTask)}</dd><dt>Data</dt><dd>{dateLabel(selectedTask.dueDate)}</dd><dt>Horário</dt><dd>{selectedTask.reminderTime ? `${selectedTask.reminderTime} (Brasília)` : 'Não definido'}</dd><dt>Situação</dt><dd>{statusLabel(selectedTask)}</dd><dt>Antecedência</dt><dd>{(selectedTask.reminderMinutes ?? 15) === 0 ? 'No horário da tarefa' : `${selectedTask.reminderMinutes ?? 15} minutos antes`}</dd><dt>Observações</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{selectedTask.notes || 'Não informadas'}</dd></dl>
      <div className="row"><button className="button secondary" onClick={() => { setTaskId(null); setGroupId(null); onEdit(selectedTask); }}>Editar tarefa</button><button className="button" disabled={busy} onClick={() => void toggle(selectedTask)}>{selectedTask.done ? 'Reabrir tarefa' : 'Concluir tarefa'}</button></div>
      {!selectedTask.done && <div className="notice"><p className="muted">{selectedTask.reminderTime ? 'Ao abrir o calendário, confira e confirme o evento e o lembrete. Evite adicionar a mesma tarefa duas vezes.' : 'Edite a tarefa e informe um horário para criar um lembrete.'}</p><div className="row"><button className="button" disabled={busy || !selectedTask.reminderTime} onClick={() => void calendar(selectedTask)}>{hasNativeCalendar() ? 'Adicionar ao calendário' : 'Baixar lembrete (.ics)'}</button>{hasNativeCalendar() && <button className="button secondary" disabled={busy || !selectedTask.reminderTime} onClick={() => void calendar(selectedTask, true)}>Baixar lembrete (.ics)</button>}</div></div>}
      <button className="button secondary" onClick={() => setTaskId(null)}>Voltar às tarefas</button>
    </AgendaDialog>}
  </div>;
}
