import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/types';
import { readUiContext, recallUiRoute, rememberUiRoute, writeUiContext, type UiContextValue } from '../src/lib/ui-context';

describe('contexto visual leve durante a sessão', () => {
  it('preserva filtros, identificação, aba e rascunho de entrega sem compartilhar objetos mutáveis', () => {
    const context = new Map<string, unknown>();
    const snapshot = { species: 'Calopsita', sex: 'indeterminado', selectedId: 'ave-qa', tab: 'saúde', date: '2026-10-14', selected: [{ type: 'attachment', id: 'arquivo-qa' }], reason: 'Revisão fictícia' };
    writeUiContext(context, 'filters', snapshot);
    snapshot.species = 'Outra'; snapshot.selected[0].id = 'outro-arquivo';
    const reopened = readUiContext(context, 'filters', snapshot);
    expect(reopened).toMatchObject({ species: 'Calopsita', selected: [{ type: 'attachment', id: 'arquivo-qa' }] });
    reopened.selected[0].id = 'modificado-na-tela';
    expect(readUiContext(context, 'filters', snapshot).selected[0].id).toBe('arquivo-qa');
  });

  it.each([
    emptyState(),
    { id: 'ave-qa', scope: 'real', identification: 'QA-01' },
    { id: 'arquivo-qa', base64: 'CONTEUDO-DO-ARQUIVO', title: 'Documento' },
    { envelope: { ciphertext: 'conteudo-criptografado' } },
    { password: 'senha-ficticia' },
    { token: 'chave-ficticia' },
    new Uint8Array([1, 2, 3]),
    new ArrayBuffer(4),
    new Blob(['arquivo-ficticio']),
    new Map([['record', 'qa']]),
    'blob:http://localhost/qa-documento',
    'data:image/png;base64,QUREUg==',
  ].map((value, index) => ({ value, index })))('recusa valor indevido $index sem reter registros, arquivos ou segredos', ({ value }) => {
    const context = new Map<string, unknown>();
    expect(() => writeUiContext(context, 'unsafe', value as unknown as UiContextValue)).toThrow(/contexto visual/);
    expect(context.size).toBe(0);
  });

  it('não executa getters que poderiam fechar sobre arquivos ou uma base anterior', () => {
    let accessed = false;
    const snapshot = { get selectedId() { accessed = true; return 'ave-qa'; } };
    expect(() => writeUiContext(new Map(), 'filters', snapshot)).toThrow();
    expect(accessed).toBe(false);
  });

  it('descarta um valor indevido preexistente e hidrata somente a alternativa leve', () => {
    const context = new Map<string, unknown>([['filters', emptyState()]]);
    expect(readUiContext(context, 'filters', () => ({ sex: 'indeterminado' }))).toEqual({ sex: 'indeterminado' });
    expect(context.has('filters')).toBe(false);
  });

  it('mantém quarenta contextos de voltar e substitui a versão do mesmo request sem duplicá-la', () => {
    const context = new Map<string, unknown>();
    for (let request = 1; request <= 60; request++) rememberUiRoute(context, 'aves', request, { selectedId: `ave-${request}`, tab: 'ficha' });
    expect(recallUiRoute(context, 'aves', 20)).toBeUndefined();
    expect(recallUiRoute(context, 'aves', 21)).toEqual({ selectedId: 'ave-21', tab: 'ficha' });
    rememberUiRoute(context, 'aves', 60, { selectedId: 'ave-60', tab: 'saúde' });
    expect(recallUiRoute(context, 'aves', 60)).toEqual({ selectedId: 'ave-60', tab: 'saúde' });
    expect(context.get('routes:aves')).toHaveLength(40);
    rememberUiRoute(context, 'aves', 61, { selectedId: 'ave-61', tab: 'ficha' }, 200);
    expect(context.get('routes:aves')).toHaveLength(40);
    expect(recallUiRoute(context, 'aves', 21)).toBeUndefined();
  });

  it('não permite que alterações posteriores modifiquem a situação lembrada para voltar', () => {
    const context = new Map<string, unknown>();
    const filters = { species: 'Calopsita', selectedId: null, tab: 'ficha' };
    rememberUiRoute(context, 'aves', 1, filters);
    filters.species = 'Outra';
    expect(recallUiRoute(context, 'aves', 1)).toEqual({ species: 'Calopsita', selectedId: null, tab: 'ficha' });
  });

  it('mantém espaços separados e deixa de recuperar contexto após o bloqueio', () => {
    const sessions = new Map<string, Map<string, unknown>>([['real:birds', new Map()], ['demo:birds', new Map()]]);
    writeUiContext(sessions.get('real:birds'), 'selectedId', 'ave-real-qa');
    writeUiContext(sessions.get('demo:birds'), 'selectedId', 'ave-demo-qa');
    expect(readUiContext(sessions.get('real:birds'), 'selectedId', '')).toBe('ave-real-qa');
    expect(readUiContext(sessions.get('demo:birds'), 'selectedId', '')).toBe('ave-demo-qa');
    sessions.clear();
    expect(readUiContext(sessions.get('real:birds'), 'selectedId', '')).toBe('');
    expect(readUiContext(sessions.get('demo:birds'), 'selectedId', '')).toBe('');
  });

  it('funciona sem contexto opcional e ignora requests ausentes ou inválidos', () => {
    expect(readUiContext(undefined, 'population', 'present')).toBe('present');
    const context = new Map<string, unknown>();
    rememberUiRoute(context, 'aves', undefined, { tab: 'ficha' });
    rememberUiRoute(context, 'aves', NaN, { tab: 'ficha' });
    expect(context.size).toBe(0);
  });
});
