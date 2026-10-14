import { test, expect, type Page } from '@playwright/test';
import { createVisualVault, navigateVisual, readVisualState, visualPassword } from './visual-helpers';
import { today } from '../../src/domain/shared';

test.use({ actionTimeout: 15000 });
const active = (page: Page) => page.locator('.cached-view:not([hidden])');
const after = (days: number) => { const date = new Date(today() + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
async function createEgg(page: Page) {
  for (const [id, name, sex] of [['QA-TAREFA-PAI', 'QA pai tarefas', 'macho'], ['QA-TAREFA-MAE', 'QA mãe tarefas', 'fêmea']] as const) {
    await navigateVisual(page, 'Aves'); await page.getByRole('button', { name: 'Cadastrar ave', exact: true }).click(); const form = page.getByRole('dialog', { name: 'Cadastrar ave', exact: true });
    await form.getByLabel('Identificação ou anilha *', { exact: true }).fill(id); await form.getByLabel('Nome', { exact: true }).fill(name); await form.getByLabel('Espécie *', { exact: true }).fill('Calopsita'); await form.getByRole('combobox', { name: 'Sexo *', exact: true }).selectOption(sex);
    await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
  }
  await navigateVisual(page, 'Casais'); await page.getByRole('button', { name: 'Formar casal', exact: true }).click(); let form = page.getByRole('dialog', { name: 'Formar casal', exact: true });
  await form.getByLabel('Nome do casal *', { exact: true }).fill('QA casal tarefas'); await form.getByRole('combobox', { name: 'Macho *', exact: true }).selectOption({ label: 'QA pai tarefas · QA-TAREFA-PAI · manejo' }); await form.getByRole('combobox', { name: 'Fêmea *', exact: true }).selectOption({ label: 'QA mãe tarefas · QA-TAREFA-MAE · manejo' });
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible(); await active(page).getByRole('button', { name: 'Nova postura', exact: true }).click(); form = page.getByRole('dialog', { name: 'Registrar postura', exact: true });
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible(); await active(page).getByRole('button', { name: 'Posturas e ovos', exact: true }).click();
  await active(page).getByRole('button', { name: 'Registrar ovo', exact: true }).click(); form = page.getByRole('dialog', { name: 'Registrar ovo', exact: true }); await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}
async function changeForecast(page: Page, days: number, lost = false) {
  await navigateVisual(page, 'Reprodução'); await active(page).getByRole('button', { name: 'Posturas e ovos', exact: true }).click(); await active(page).getByRole('button', { name: 'Avaliar ovo', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Avaliar ovo 1', exact: true }); await form.getByLabel('Previsão de eclosão (estimativa)', { exact: true }).fill(after(days));
  if (lost) await form.getByRole('combobox', { name: 'Resultado', exact: true }).selectOption('perdido');
  await form.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(form).not.toBeVisible();
}

test('derived agenda requires configured parameters, updates the same task, preserves completion and resolves future work on closure', async ({ page, context }) => {
  test.setTimeout(150000); await createVisualVault(page, 'light', false); await createEgg(page); await navigateVisual(page, 'Configurações');
  await page.getByRole('checkbox', { name: 'Acompanhar previsão de eclosão', exact: true }).check(); await page.getByRole('checkbox', { name: 'Lembrar avaliação do ovo', exact: true }).check(); await page.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(page.getByText('Configurações salvas.', { exact: true })).toBeVisible(); expect((await readVisualState(page)).tasks).toHaveLength(0);
  await page.getByRole('button', { name: 'Editar espécie Calopsita', exact: true }).click(); const parameters = page.getByRole('dialog', { name: 'Editar espécie e parâmetros', exact: true });
  await parameters.getByLabel('Incubação estimada (dias)', { exact: true }).fill('10'); await parameters.getByLabel('Avaliação do ovo após postura (dias)', { exact: true }).fill('2'); await parameters.getByLabel('Fonte dos parâmetros', { exact: true }).fill('Parâmetros fictícios exclusivos deste teste; sem recomendação biológica.');
  await parameters.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(parameters).not.toBeVisible();
  let state = await readVisualState(page); expect(state.tasks).toHaveLength(2); const hatch = state.tasks.find(task => task.derivationKey?.endsWith(':hatch'))!, check = state.tasks.find(task => task.derivationKey?.endsWith(':check'))!; expect(hatch.dueDate).toBe(after(10)); expect(check.dueDate).toBe(after(2));
  await changeForecast(page, 14); state = await readVisualState(page); expect(state.tasks).toHaveLength(2); expect(state.tasks.find(task => task.id === hatch.id)?.dueDate).toBe(after(14));
  await navigateVisual(page, 'Agenda'); await active(page).getByRole('button', { name: 'Ver tarefas', exact: true }).click(); const tasks = page.getByRole('dialog', { name: 'QA mãe tarefas · QA-TAREFA-MAE', exact: true });
  await tasks.locator('article').filter({ hasText: 'Acompanhamento do ovo' }).getByRole('button', { name: 'Concluir tarefa', exact: true }).click(); await tasks.getByRole('button', { name: 'Fechar', exact: true }).click();
  await changeForecast(page, 15); state = await readVisualState(page); expect(state.tasks).toHaveLength(2); expect(state.tasks.find(task => task.id === check.id)?.done).toBe(true); expect(state.tasks.find(task => task.id === hatch.id)?.dueDate).toBe(after(15));
  await changeForecast(page, 15, true); await active(page).getByRole('button', { name: 'Encerrar postura', exact: true }).click(); const close = page.getByRole('dialog', { name: 'Encerrar postura', exact: true }); await close.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(close).not.toBeVisible();
  state = await readVisualState(page); expect(state.tasks).toHaveLength(2); expect(state.tasks.every(task => task.done)).toBe(true); expect(state.tasks.find(task => task.id === hatch.id)?.resolvedAt).toBeTruthy(); expect(state.tasks.find(task => task.id === hatch.id)?.history?.some(event => event.action === 'resolvida')).toBe(true);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await context.setOffline(true); await page.reload(); await page.getByLabel('Senha da base', { exact: true }).fill(visualPassword); await page.getByRole('button', { name: 'Desbloquear', exact: true }).click(); await navigateVisual(page, 'Agenda');
  await page.getByRole('combobox', { name: 'Situação das tarefas', exact: true }).selectOption('concluídas'); await active(page).getByRole('button', { name: 'Ver tarefas', exact: true }).click(); const completed = page.getByRole('dialog'); await expect(completed.locator('article')).toHaveCount(1); await expect(completed).toContainText(check.title); await completed.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Situação das tarefas', exact: true }).selectOption('resolvidas'); await active(page).getByRole('button', { name: 'Ver tarefas', exact: true }).click(); const resolved = page.getByRole('dialog'); await expect(resolved.locator('article')).toHaveCount(1); await expect(resolved).toContainText(hatch.title); await resolved.getByRole('button', { name: 'Ver detalhes', exact: true }).click(); await expect(page.getByRole('dialog', { name: hatch.title, exact: true })).toContainText('Resolvida pelo acompanhamento');
  const reopened = await readVisualState(page); expect(reopened.tasks.map(task => task.id).sort()).toEqual([hatch.id, check.id].sort()); expect(reopened.tasks.every(task => task.done)).toBe(true);
});
