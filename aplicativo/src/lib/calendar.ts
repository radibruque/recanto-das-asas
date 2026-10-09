import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Task } from '../domain/types';

export const CALENDAR_TIME_ZONE = 'America/Sao_Paulo';
export const REMINDER_MINUTES = [0, 5, 15, 30, 60, 1440] as const;
type ReminderTask = Pick<Task, 'id' | 'title' | 'dueDate' | 'done' | 'notes'> & {
  reminderTime?: string;
  reminderMinutes?: number;
};
export type CalendarEvent = {
  title: string;
  description: string;
  beginTime: number;
  endTime: number;
  reminderMinutes: number;
  timeZone: string;
};

const nativeCalendar = registerPlugin<{
  addEvent(options: CalendarEvent): Promise<{ opened: boolean }>;
}>('RecantoCalendar');

/** Future reminders use Brasília time. Brazil has no daylight saving time since 2019. */
export function calendarEvent(task: ReminderTask, birdName = '', now = Date.now()): CalendarEvent {
  if (task.done) throw new Error('Esta tarefa está concluída. Reabra a tarefa antes de criar um lembrete.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.reminderTime ?? '')) {
    throw new Error('Edite a tarefa e informe a data e o horário do lembrete.');
  }
  const beginTime = Date.parse(`${task.dueDate}T${task.reminderTime}:00-03:00`);
  const dateCheck = new Date(`${task.dueDate}T12:00:00Z`);
  if (!Number.isFinite(beginTime) || Number.isNaN(dateCheck.valueOf()) || dateCheck.toISOString().slice(0, 10) !== task.dueDate) {
    throw new Error('A data do lembrete é inválida.');
  }
  if (beginTime <= now) throw new Error('Defina uma data e um horário futuros para criar o lembrete.');
  const minutes = task.reminderMinutes ?? 15;
  if (!(REMINDER_MINUTES as readonly number[]).includes(minutes)) throw new Error('Escolha um intervalo de lembrete válido.');
  return {
    title: task.title,
    description: [birdName ? `Ave: ${birdName}` : 'Tarefa geral do criatório', task.notes, 'Tarefa do Recanto das Asas. Alterações feitas no aplicativo não atualizam este evento; ajuste ou exclua o evento no calendário.'].filter(Boolean).join('\n\n'),
    beginTime,
    endTime: beginTime + 30 * 60 * 1000,
    reminderMinutes: minutes,
    timeZone: CALENDAR_TIME_ZONE,
  };
}

export function escapeCalendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
}

/** RFC 5545 uses a maximum of 75 UTF-8 octets, including a continuation space. */
export function foldCalendarLine(value: string): string {
  const encoder = new TextEncoder();
  let result = '', width = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (width + size > 75) { result += '\r\n '; width = 1; }
    result += character;
    width += size;
  }
  return result;
}

const utcStamp = (epoch: number) => new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function taskCalendarIcs(task: ReminderTask, birdName = '', now = Date.now()): Uint8Array {
  const event = calendarEvent(task, birdName, now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Recanto das Asas//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(task.id)}@recantodasasas.local`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(event.beginTime)}`,
    `DTEND:${utcStamp(event.endTime)}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `DESCRIPTION:${escapeCalendarText(event.description)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    `TRIGGER:-PT${event.reminderMinutes}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeCalendarText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new TextEncoder().encode(lines.map(foldCalendarLine).join('\r\n') + '\r\n');
}

export const hasNativeCalendar = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function downloadTaskCalendar(task: ReminderTask, birdName = ''): Promise<void> {
  const bytes = taskCalendarIcs(task, birdName);
  const { downloadBytes } = await import('./exports');
  const name = task.title.replace(/[^\p{L}\p{N}_. -]/gu, '_').slice(0, 80) || 'Lembrete';
  await downloadBytes(bytes, `${name}.ics`, 'text/calendar');
}

/** Opens the system editor. An opened editor does not mean the user saved an event. */
export async function addTaskToCalendar(task: ReminderTask, birdName = ''): Promise<void> {
  if (!hasNativeCalendar()) { await downloadTaskCalendar(task, birdName); return; }
  await nativeCalendar.addEvent(calendarEvent(task, birdName));
}
