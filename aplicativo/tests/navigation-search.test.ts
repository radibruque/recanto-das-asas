import { describe, expect, it } from 'vitest';
import { emptyState, type Attachment, type Bird, type Contact, type IssuedDocument, type Sale, type Task } from '../src/domain/types';
import { buildLocalSearchIndex, historyStatuses, navigationScroll, pushNavigation, searchLocalIndex, sectorForTarget, taskTarget } from '../src/lib/navigation';

function fixture() {
  const state = emptyState();
  state.birds = [{ id: 'bird-real', scope: 'real', identification: 'ANILHA-001', name: 'Jóia', species: 'Calopsita', status: 'disponível' }, { id: 'bird-demo', scope: 'demo', identification: 'DEMO-001', name: 'Outra Jóia', species: 'Calopsita', status: 'vendido' }] as Bird[];
  state.contacts = [{ id: 'contact-real', scope: 'real', name: 'José', kind: 'cliente', phone: '11999887766', email: 'cliente-ficticio@example.test' }, { id: 'contact-demo', scope: 'demo', name: 'José demonstrativo', kind: 'fornecedor' }] as Contact[];
  state.sales = [{ id: 'sale-real', scope: 'real', number: 'V-001', contactId: 'contact-real', status: 'vendida', items: [{ description: 'Calopsita Jóia' }] }, { id: 'sale-demo', scope: 'demo', number: 'V-DEMO', contactId: 'contact-demo', status: 'reservada', items: [] }] as Sale[];
  state.attachments = [{ id: 'attachment-real', scope: 'real', title: 'Exame de Jóia', fileName: 'exame-joia.pdf', category: 'Saúde', birdId: 'bird-real' }] as Attachment[];
  state.documents = [{ id: 'document-real', scope: 'real', title: 'Caderneta de Jóia', fileName: 'caderneta-joia.pdf', kind: 'Caderneta digital', birdId: 'bird-real', saleId: 'sale-real' }] as IssuedDocument[];
  return state;
}

describe('Navegação e busca local isoladas da persistência', () => {
  it('HOME sempre retorna ao topo, inclusive no resumo comercial', () => {
    expect(navigationScroll({ view: 'home' }, 890)).toBe(0);
    expect(navigationScroll({ view: 'home', filter: 'commercial' }, 420)).toBe(0);
    expect(navigationScroll({ view: 'birds' }, 890)).toBe(890);
  });
  it('busca anilha, acentos, contato e venda e abre o identificador original', () => {
    const index = buildLocalSearchIndex(fixture(), 'real');
    expect(searchLocalIndex(index, 'ANILHA-001').find(row => row.group === 'Aves')?.target).toEqual({ view: 'birds', birdId: 'bird-real' });
    expect(searchLocalIndex(index, 'joia')).toHaveLength(4);
    expect(searchLocalIndex(index, 'jose').map(row => row.group)).toEqual(['Pessoas', 'Vendas e reservas']);
    expect(searchLocalIndex(index, 'V-001')[0]?.target).toEqual({ view: 'sales', saleId: 'sale-real' });
    expect(searchLocalIndex(index, '11999887766')[0]?.target.contactId).toBe('contact-real');
  });
  it('não lê bytes, base64 ou propriedades não necessárias dos documentos', () => {
    const state = fixture();
    for (const file of [...state.attachments, ...state.documents]) Object.defineProperty(file, 'base64', { get() { throw new Error('A busca acessou o conteúdo do arquivo.'); } });
    const index = buildLocalSearchIndex(state, 'real');
    expect(searchLocalIndex(index, 'exame')[0]?.target).toEqual({ view: 'documents', attachmentId: 'attachment-real' });
    expect(searchLocalIndex(index, 'caderneta')[0]?.target).toEqual({ view: 'booklet', issuedDocumentId: 'document-real', birdId: 'bird-real', saleId: 'sale-real' });
  });
  it('mantém real e demonstração separados, mesmo quando possuem nomes semelhantes', () => {
    const state = fixture();
    expect(buildLocalSearchIndex(state, 'real').some(row => row.id.includes('demo'))).toBe(false);
    expect(buildLocalSearchIndex(state, 'demo').some(row => row.id.includes('real'))).toBe(false);
    expect(searchLocalIndex(buildLocalSearchIndex(state, 'real'), 'V-DEMO')).toEqual([]);
  });
  it('combina termos e limita cada grupo sem esconder os demais tipos de registro', () => {
    const state = fixture();
    state.birds.push(...Array.from({ length: 20 }, (_, index) => ({ ...state.birds[0], id: `extra-${index}`, identification: `ANILHA-${index}`, name: 'Jóia' })));
    const index = buildLocalSearchIndex(state, 'real');
    expect(searchLocalIndex(index, 'joia').filter(row => row.group === 'Aves')).toHaveLength(8);
    expect(searchLocalIndex(index, 'joia').some(row => row.group === 'Documentos')).toBe(true);
    expect(searchLocalIndex(index, 'joia calopsita').filter(row => row.group === 'Documentos')).toHaveLength(0);
    expect(searchLocalIndex(index, '  ')).toEqual([]);
  });
  it('mantém o setor nos acessos compartilhados e muda somente no destino contextual', () => {
    expect(sectorForTarget({ view: 'finance' }, 'breeding')).toBe('commercial');
    expect(sectorForTarget({ view: 'birds' }, 'commercial')).toBe('breeding');
    expect(sectorForTarget({ view: 'documents' }, 'commercial')).toBe('commercial');
    expect(sectorForTarget({ view: 'home', filter: 'breeding' }, 'commercial')).toBe('breeding');
    expect(historyStatuses.has('falecido')).toBe(true);
    expect(historyStatuses.has('reservado')).toBe(false);
  });
  it('tarefas abrem a ave ou o registro reprodutivo em vez de apenas a lista geral', () => {
    const task = { id: 'task', birdId: 'bird-real' } as Task;
    expect(taskTarget(task)).toEqual({ view: 'birds', birdId: 'bird-real', taskId: 'task' });
    expect(taskTarget({ ...task, birdId: null })).toEqual({ view: 'tasks', taskId: 'task' });
    expect(taskTarget({ ...task, sourceType: 'egg', sourceId: 'egg-real' } as Task)).toEqual({ view: 'breeding', eggId: 'egg-real', clutchId: undefined, pairId: undefined, taskId: 'task' });
  });
  it('preserva alvos e rolagem no histórico limitado sem mutar as entradas anteriores', () => {
    const entry = { target: { view: 'birds', filter: 'present' }, sector: 'breeding' as const, scope: 'real' as const, scroll: 420 };
    const original = [entry];
    const updated = pushNavigation(original, { ...entry, scroll: 560 });
    expect(updated).toHaveLength(1); expect(updated[0].scroll).toBe(560); expect(original[0].scroll).toBe(420);
    let history = updated;
    for (let index = 0; index < 60; index++) history = pushNavigation(history, { ...entry, target: { view: 'birds', birdId: `${index}` } });
    expect(history).toHaveLength(40); expect(history.at(-1)?.target.birdId).toBe('59');
  });
});
