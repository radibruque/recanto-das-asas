import type { Scope, State } from '../domain/types';
import type { NavigationTarget } from '../domain/ui-target';
import { billOutstanding, stockBalance } from '../domain/commercial';
import { birdLabel, dateLabel, today } from '../domain/shared';
import { money } from '../domain/shared';
import type { Preferences } from './preferences';

export type NoticeKind = 'task' | 'hatch' | 'bill' | 'delivery' | 'stock' | 'report';
export type Notice = { id: string; kind: NoticeKind; title: string; detail: string; tone: 'coral' | 'sun' | 'teal' | 'sky' | 'leaf'; target?: NavigationTarget; reportKey?: string };
export type ScheduledNotice = { id: string; at: Date; title: string; body: string; target?: NavigationTarget };

/** Scope + contents distinguish a new or updated notice from one already read. */
export const noticeReadKey = (notice: Notice, scope: Scope) => JSON.stringify([scope, notice.id, notice.title, notice.detail]);
export const unreadNoticeCount = (notices: Notice[], scope: Scope, read: string[]) => {
  const seen = new Set(read);
  return notices.filter(n => !seen.has(noticeReadKey(n, scope))).length;
};

const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const relative = (iso: string, now: string) => iso === now ? 'hoje' : iso === addDays(now, 1) ? 'amanhã' : iso < now ? `atrasado desde ${dateLabel(iso)}` : dateLabel(iso);

/** ISO week number, used to remember a dismissed weekly report suggestion. */
function isoWeek(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `${d.getUTCFullYear()}-S${String(1 + Math.round(((d.valueOf() - first.valueOf()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}

/** Suggestions to generate a report at the end of the day, week, month and year. Never automatic. */
export function reportSuggestions(now = new Date()): { key: string; label: string; period: string }[] {
  const iso = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  const tomorrow = addDays(iso, 1);
  const out: { key: string; label: string; period: string }[] = [];
  if (iso.slice(5) === '12-31') out.push({ key: `ano:${iso.slice(0, 4)}`, label: 'Fim do ano', period: 'ano' });
  if (tomorrow.slice(0, 7) !== iso.slice(0, 7)) out.push({ key: `mes:${iso.slice(0, 7)}`, label: 'Fim do mês', period: 'mês' });
  if (new Date(iso + 'T12:00:00Z').getUTCDay() === 0) out.push({ key: `semana:${isoWeek(iso)}`, label: 'Fim da semana', period: 'semana' });
  if (hour >= 18) out.push({ key: `dia:${iso}`, label: 'Fim do dia', period: 'dia' });
  return out;
}

export function buildNotices(state: State, scope: Scope, prefs: Preferences, now = new Date()): Notice[] {
  const iso = today();
  const soon = addDays(iso, 7);
  const birds = new Map(state.birds.filter(b => b.scope === scope).map(b => [b.id, b]));
  const notices: Notice[] = [];

  for (const task of state.tasks) {
    if (task.scope !== scope || task.done || task.dueDate > addDays(iso, 1)) continue;
    notices.push({ id: 'task:' + task.id, kind: 'task', title: task.title, detail: `Tarefa ${relative(task.dueDate, iso)}${task.reminderTime ? ' às ' + task.reminderTime : ''}${task.birdId ? ' · ' + birdLabel(birds.get(task.birdId)) : ''}`, tone: task.dueDate < iso ? 'coral' : 'sun', target: { view: 'tasks', taskId: task.id } });
  }
  for (const egg of state.eggs) {
    if (egg.scope !== scope || egg.status !== 'incubando' || !egg.expectedHatchDate || egg.expectedHatchDate > soon) continue;
    const clutch = state.clutches.find(c => c.id === egg.clutchId);
    const pair = clutch && state.pairs.find(p => p.id === clutch.pairId);
    notices.push({ id: 'hatch:' + egg.id, kind: 'hatch', title: `Eclosão prevista ${relative(egg.expectedHatchDate, iso)}`, detail: `Ovo ${egg.number}${pair ? ' · ' + pair.name : ''}`, tone: egg.expectedHatchDate <= addDays(iso, 1) ? 'sun' : 'teal', target: { view: 'breeding', eggId: egg.id, clutchId: egg.clutchId } });
  }
  for (const bill of state.bills) {
    if (bill.scope !== scope || bill.cancelled || bill.dueDate > addDays(iso, 3)) continue;
    const open = billOutstanding(state, scope, bill);
    if (open <= 0) continue;
    notices.push({ id: 'bill:' + bill.id, kind: 'bill', title: `${bill.direction === 'pagar' ? 'Pagar' : 'Receber'} ${money(open)}`, detail: `${bill.description} · vence ${relative(bill.dueDate, iso)}`, tone: bill.dueDate < iso ? 'coral' : 'sun', target: { view: 'finance', billId: bill.id } });
  }
  for (const sale of state.sales) {
    if (sale.scope !== scope || !['reservada', 'vendida'].includes(sale.status) || !sale.deliveryDate || sale.deliveryDate > addDays(iso, 2)) continue;
    const contact = state.contacts.find(c => c.id === sale.contactId);
    notices.push({ id: 'sale:' + sale.id, kind: 'delivery', title: `${sale.status === 'reservada' ? 'Reserva' : 'Entrega'} ${relative(sale.deliveryDate, iso)}`, detail: `${sale.number}${contact ? ' · ' + contact.name : ''}`, tone: sale.deliveryDate < iso ? 'coral' : 'teal', target: { view: 'sales', saleId: sale.id } });
  }
  for (const product of state.products) {
    if (product.scope !== scope) continue;
    const balance = stockBalance(state, scope, product.id);
    if (balance > product.minimum) continue;
    notices.push({ id: 'stock:' + product.id, kind: 'stock', title: `${product.name} abaixo do mínimo`, detail: `Estoque: ${balance.toLocaleString('pt-BR')} ${product.unit} de ${product.minimum.toLocaleString('pt-BR')} ${product.unit}`, tone: 'coral', target: { view: 'stock', filter: 'low-stock' } });
  }
  if (prefs.reportReminders) for (const r of reportSuggestions(now)) {
    if (prefs.dismissedReports.includes(r.key)) continue;
    notices.push({ id: 'report:' + r.key, kind: 'report', title: `${r.label}: que tal gerar um relatório?`, detail: `Resumo do ${r.period} em PDF ou planilha, quando você quiser.`, tone: 'sky', target: { view: 'reports', filter: r.period }, reportKey: r.key });
  }
  const order: Record<Notice['tone'], number> = { coral: 0, sun: 1, teal: 2, sky: 3, leaf: 4 };
  return notices.sort((a, b) => order[a.tone] - order[b.tone]);
}

const at = (iso: string, hour: number, minute = 0) => new Date(`${iso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`);

/** Future moments for the phone/computer notification bar (next 30 days). */
export function buildSchedule(state: State, scope: Scope, prefs: Preferences, now = new Date()): ScheduledNotice[] {
  if (!prefs.notifications) return [];
  const iso = today(), limit = addDays(iso, 30);
  const out: ScheduledNotice[] = [];
  const push = (n: ScheduledNotice) => { if (n.at > now && n.at.valueOf() - now.valueOf() < 31 * 86400000) out.push(n); };
  const birds = new Map(state.birds.filter(b => b.scope === scope).map(b => [b.id, b]));
  if (prefs.notifyTasks) for (const task of state.tasks) {
    if (task.scope !== scope || task.done || task.dueDate > limit || task.dueDate < iso) continue;
    const [h, m] = (task.reminderTime ?? '').split(':').map(Number);
    const base = task.reminderTime && Number.isFinite(h) ? at(task.dueDate, h!, m ?? 0) : at(task.dueDate, prefs.dailyNoticeHour);
    const advance = task.reminderTime ? (task.reminderMinutes ?? prefs.taskAdvanceMinutes) : 0;
    push({ id: 'task:' + task.id, at: new Date(base.valueOf() - advance * 60000), title: task.title, body: `${task.reminderTime ? 'Às ' + task.reminderTime : 'Hoje'}${task.birdId ? ' · ' + birdLabel(birds.get(task.birdId)) : ''}`, target: { view: 'tasks', taskId: task.id } });
  }
  if (prefs.notifyHatch) for (const egg of state.eggs) {
    if (egg.scope !== scope || egg.status !== 'incubando' || !egg.expectedHatchDate || egg.expectedHatchDate > limit) continue;
    const target = { view: 'breeding', eggId: egg.id, clutchId: egg.clutchId };
    push({ id: 'hatch1:' + egg.id, at: at(addDays(egg.expectedHatchDate, -1), prefs.dailyNoticeHour), title: 'Eclosão prevista amanhã', body: `Ovo ${egg.number} — prepare o ninho e confira a incubação.`, target });
    push({ id: 'hatch0:' + egg.id, at: at(egg.expectedHatchDate, prefs.dailyNoticeHour), title: 'Eclosão prevista para hoje', body: `Ovo ${egg.number} — registre o nascimento no app.`, target });
  }
  if (prefs.notifyBills) for (const bill of state.bills) {
    if (bill.scope !== scope || bill.cancelled || bill.dueDate > limit || billOutstanding(state, scope, bill) <= 0) continue;
    const label = bill.direction === 'pagar' ? 'Conta a pagar' : 'Valor a receber';
    const target = { view: 'finance', billId: bill.id };
    push({ id: 'bill1:' + bill.id, at: at(addDays(bill.dueDate, -1), prefs.dailyNoticeHour), title: `${label} vence amanhã`, body: `${bill.description} · ${money(billOutstanding(state, scope, bill))}`, target });
    push({ id: 'bill0:' + bill.id, at: at(bill.dueDate, prefs.dailyNoticeHour), title: `${label} vence hoje`, body: `${bill.description} · ${money(billOutstanding(state, scope, bill))}`, target });
  }
  if (prefs.notifyDeliveries) for (const sale of state.sales) {
    if (sale.scope !== scope || !['reservada', 'vendida'].includes(sale.status) || !sale.deliveryDate || sale.deliveryDate > limit) continue;
    const contact = state.contacts.find(c => c.id === sale.contactId);
    push({ id: 'sale:' + sale.id, at: at(sale.deliveryDate, prefs.dailyNoticeHour), title: sale.status === 'reservada' ? 'Reserva marcada para hoje' : 'Entrega marcada para hoje', body: `${sale.number}${contact ? ' · ' + contact.name : ''}`, target: { view: 'sales', saleId: sale.id } });
  }
  return out.sort((a, b) => a.at.valueOf() - b.at.valueOf()).slice(0, 60);
}
