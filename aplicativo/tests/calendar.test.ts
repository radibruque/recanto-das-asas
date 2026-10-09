import { describe, expect, it } from 'vitest';
import { calendarEvent, escapeCalendarText, foldCalendarLine, taskCalendarIcs } from '../src/lib/calendar';

const now = Date.parse('2026-10-09T10:00:00Z');
const task = {
  id: '94ac63c7-3d34-45a6-b1fa-d8ac9d5c7e52',
  title: 'Consulta da Roxa', dueDate: '2026-10-10', reminderTime: '09:30', reminderMinutes: 30,
  done: false, notes: 'Levar exame e a caderneta.',
};

describe('Lembretes do calendário', () => {
  it('preserva a hora de Brasília ao criar o evento do telefone e o arquivo ICS', () => {
    const event = calendarEvent(task, 'Roxa · ABC123', now);
    expect(new Date(event.beginTime).toISOString()).toBe('2026-10-10T12:30:00.000Z');
    expect(event.endTime - event.beginTime).toBe(30 * 60 * 1000);
    expect(event.timeZone).toBe('America/Sao_Paulo');
    expect(event.description).toContain('Ave: Roxa · ABC123');
    const ics = new TextDecoder().decode(taskCalendarIcs(task, 'Roxa · ABC123', now));
    expect(ics).toContain('DTSTART:20261010T123000Z\r\nDTEND:20261010T130000Z');
    expect(ics).toContain('DTSTAMP:20261009T100000Z');
    expect(ics).toContain('BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY');
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('usa um identificador estável para não inventar um novo evento a cada exportação', () => {
    const first = new TextDecoder().decode(taskCalendarIcs(task, '', now));
    const next = new TextDecoder().decode(taskCalendarIcs({ ...task, title: 'Consulta reagendada' }, '', now + 1_000));
    expect(first.match(/^UID:.+$/m)?.[0]).toBe(next.match(/^UID:.+$/m)?.[0]);
    expect(first).toContain(`UID:${task.id}@recantodasasas.local`);
  });

  it('não permite evento no passado, tarefa concluída, data impossível ou horário inválido', () => {
    expect(() => calendarEvent({ ...task, done: true }, '', now)).toThrow(/concluída/);
    expect(() => calendarEvent({ ...task, dueDate: '2026-10-08' }, '', now)).toThrow(/futuros/);
    expect(() => calendarEvent({ ...task, dueDate: '2027-02-30' }, '', now)).toThrow(/inválida/);
    expect(() => calendarEvent({ ...task, reminderTime: '24:00' }, '', now)).toThrow(/horário/);
    expect(() => calendarEvent({ ...task, reminderTime: undefined }, '', now)).toThrow(/horário/);
    expect(() => calendarEvent({ ...task, dueDate: '2026-10-09', reminderTime: '07:00' }, '', now)).toThrow(/futuros/);
  });

  it('mantém tarefas antigas sem horário válidas na base mas solicita edição antes do lembrete', () => {
    const { reminderTime, reminderMinutes, ...oldTask } = task;
    expect(() => taskCalendarIcs(oldTask, '', now)).toThrow(/informe a data e o horário/);
    expect(calendarEvent({ ...oldTask, reminderTime: '09:30' }, '', now).reminderMinutes).toBe(15);
  });

  it('aceita avisos no horário da tarefa e um dia antes, recusando intervalos desconhecidos', () => {
    const atTime = new TextDecoder().decode(taskCalendarIcs({ ...task, reminderMinutes: 0 }, '', now));
    const dayBefore = new TextDecoder().decode(taskCalendarIcs({ ...task, reminderMinutes: 1440 }, '', now));
    expect(atTime).toContain('TRIGGER:-PT0M');
    expect(dayBefore).toContain('TRIGGER:-PT1440M');
    expect(() => calendarEvent({ ...task, reminderMinutes: -15 }, '', now)).toThrow(/intervalo/);
    expect(() => calendarEvent({ ...task, reminderMinutes: 10 }, '', now)).toThrow(/intervalo/);
  });

  it('escapa observações e impede que texto ou identificadores criem eventos extras', () => {
    expect(escapeCalendarText('Olá; a,b\\c\r\nOutra linha')).toBe('Olá\\; a\\,b\\\\c\\nOutra linha');
    const bytes = taskCalendarIcs({ ...task, id: 'A\r\nBEGIN:VEVENT', title: 'Exame\r\nEND:VEVENT', notes: 'Consulta; exame, e medicação\\somente prescrita' }, 'Roxa', now);
    const unfolded = new TextDecoder().decode(bytes).replace(/\r\n /g, '');
    expect(unfolded.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(unfolded.match(/^END:VEVENT$/gm)).toHaveLength(1);
    expect(unfolded).toContain('UID:A%0D%0ABEGIN%3AVEVENT@recantodasasas.local');
    expect(unfolded).toContain('SUMMARY:Exame\\nEND:VEVENT');
    expect(unfolded).toContain('Consulta\\; exame\\, e medicação\\\\somente prescrita');
  });

  it('dobra texto longo por 75 bytes UTF-8 sem quebrar caracteres acentuados ou emojis', () => {
    const title = `SUMMARY:${'Aves 🦜, observação e saúde; '.repeat(12)}`;
    const folded = foldCalendarLine(title);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(title);
    expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(folded))).toBe(folded);
  });
});
