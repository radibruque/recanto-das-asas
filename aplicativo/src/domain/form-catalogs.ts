import type { State } from './types';
export const defaultHealthKinds = ['alimentação','anilhamento','desmame','independência','consulta','exame','diagnóstico informado','tratamento prescrito','procedimento','ocorrência','acompanhamento'];
export function formCatalogs(state: State) {
  return state.settings.formCatalogs ?? {
    mutations: [...new Set(['Não informada', ...state.birds.map(b => b.mutation)])],
    sexMethods: [...new Set(['Não informado', 'DNA', 'Visual', ...state.birds.map(b => b.sexMethod).filter(Boolean)])],
    healthKinds: defaultHealthKinds,
  };
}