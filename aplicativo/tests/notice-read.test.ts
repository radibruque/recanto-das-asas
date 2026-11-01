import { describe, expect, it } from 'vitest';
import { noticeReadKey, unreadNoticeCount, type Notice } from '../src/lib/notices';

const notice: Notice = { id: 'task:1', kind: 'task', title: 'Pesar ave', detail: 'Hoje às 9h', tone: 'sun' };
describe('Avisos novos e não lidos', () => {
  it('ler todos remove a contagem sem remover os avisos', () => {
    const notices = [notice];
    expect(unreadNoticeCount(notices, 'real', [])).toBe(1);
    expect(unreadNoticeCount(notices, 'real', [noticeReadKey(notice, 'real')])).toBe(0);
    expect(notices).toHaveLength(1);
  });
  it('um aviso novo ou atualizado volta a contar como não lido', () => {
    const read = [noticeReadKey(notice, 'real')];
    expect(unreadNoticeCount([notice, { ...notice, id: 'task:2' }], 'real', read)).toBe(1);
    expect(unreadNoticeCount([{ ...notice, detail: 'Amanhã às 10h' }], 'real', read)).toBe(1);
  });
  it('ler na demonstração não lê os avisos do criatório real', () => {
    expect(unreadNoticeCount([notice], 'real', [noticeReadKey(notice, 'demo')])).toBe(1);
  });
});