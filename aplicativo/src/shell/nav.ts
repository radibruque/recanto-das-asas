import {
  Bird, BookOpen, ChartPie, ClipboardCheck, Egg, Landmark, LayoutGrid, Network, Palette, Settings, ShoppingBag, Truck, Users,
  type LucideIcon,
} from 'lucide-react';

/** Internal screen ids. Several ids can live in one menu item as tabs. */
export type View =
  | 'home' | 'birds' | 'breeding' | 'pairs' | 'family' | 'health' | 'tasks'
  | 'clients' | 'suppliers' | 'sales' | 'finance' | 'stock'
  | 'reports' | 'booklet' | 'arts'
  | 'settings' | 'backup' | 'sync' | 'updates' | 'support';

export type MenuId = 'home' | 'birds' | 'breeding' | 'family' | 'care' | 'clients' | 'suppliers' | 'sales' | 'money' | 'reports' | 'booklet' | 'arts' | 'system';

export interface MenuItem {
  id: MenuId;
  label: string;
  short: string;
  icon: LucideIcon;
  group: string;
  eyebrow: string;
  description: string;
  views: { view: View; label: string }[];
}

export const menuGroups: { label: string; items: MenuItem[] }[] = [
  { label: 'Visão geral', items: [
    { id: 'home', label: 'Hoje', short: 'Hoje', icon: LayoutGrid, group: 'Visão geral', eyebrow: 'Visão geral', description: '', views: [{ view: 'home', label: 'Hoje' }] },
  ] },
  { label: 'Criatório', items: [
    { id: 'birds', label: 'Aves', short: 'Aves', icon: Bird, group: 'Criatório', eyebrow: 'Criatório', description: 'Ficha, fotos, documentos e história de cada ave.', views: [{ view: 'birds', label: 'Aves' }] },
    { id: 'breeding', label: 'Casais e reprodução', short: 'Reprodução', icon: Egg, group: 'Criatório', eyebrow: 'Criatório', description: 'Casais, posturas, ovos e filhotes.', views: [{ view: 'breeding', label: 'Reprodução' }, { view: 'pairs', label: 'Casais' }] },
    { id: 'family', label: 'Parentesco', short: 'Parentesco', icon: Network, group: 'Criatório', eyebrow: 'Criatório', description: 'Pais, avós e descendentes de cada ave.', views: [{ view: 'family', label: 'Parentesco' }] },
    { id: 'care', label: 'Saúde, manejo e agenda', short: 'Agenda', icon: ClipboardCheck, group: 'Criatório', eyebrow: 'Criatório', description: 'Ocorrências de saúde, pesagens e tarefas do dia.', views: [{ view: 'health', label: 'Saúde e manejo' }, { view: 'tasks', label: 'Agenda' }] },
  ] },
  { label: 'Comercial', items: [
    { id: 'clients', label: 'Clientes', short: 'Clientes', icon: Users, group: 'Comercial', eyebrow: 'Comercial', description: 'Quem compra as aves do Recanto.', views: [{ view: 'clients', label: 'Clientes' }] },
    { id: 'suppliers', label: 'Fornecedores', short: 'Fornecedores', icon: Truck, group: 'Comercial', eyebrow: 'Comercial', description: 'Pessoas e empresas de quem você compra materiais, insumos e aves.', views: [{ view: 'suppliers', label: 'Fornecedores' }] },
    { id: 'sales', label: 'Vendas e reservas', short: 'Vendas', icon: ShoppingBag, group: 'Comercial', eyebrow: 'Comercial', description: 'Orçamentos, reservas, vendas e entregas.', views: [{ view: 'sales', label: 'Vendas e reservas' }] },
    { id: 'money', label: 'Caixa e materiais', short: 'Caixa', icon: Landmark, group: 'Comercial', eyebrow: 'Comercial', description: 'Saldo, contas a pagar e receber, compras e estoque.', views: [{ view: 'finance', label: 'Caixa' }, { view: 'stock', label: 'Materiais' }] },
  ] },
  { label: 'Central', items: [
    { id: 'reports', label: 'Relatórios', short: 'Relatórios', icon: ChartPie, group: 'Central', eyebrow: 'Central', description: 'Gráficos e arquivos em PDF, Excel, CSV e Word.', views: [{ view: 'reports', label: 'Relatórios' }] },
    { id: 'booklet', label: 'Caderneta do pet', short: 'Caderneta', icon: BookOpen, group: 'Central', eyebrow: 'Central', description: 'A caderneta que acompanha a ave para o tutor.', views: [{ view: 'booklet', label: 'Caderneta' }] },
    { id: 'arts', label: 'Identidade visual', short: 'Marca', icon: Palette, group: 'Central', eyebrow: 'Central', description: 'Cores e logos principais do Recanto das Asas.', views: [{ view: 'arts', label: 'Identidade visual' }] },
  ] },
  { label: 'Sistema', items: [
    { id: 'system', label: 'Configurações e suporte', short: 'Sistema', icon: Settings, group: 'Sistema', eyebrow: 'Sistema', description: 'Backup, sincronização, avisos e ajustes do aplicativo.', views: [{ view: 'settings', label: 'Configurações' }, { view: 'backup', label: 'Backup' }, { view: 'sync', label: 'Sincronização' }, { view: 'updates', label: 'Atualizações' }, { view: 'support', label: 'Relatar bug' }] },
  ] },
];

export const allMenu = menuGroups.flatMap(g => g.items);
export const allViews = allMenu.flatMap(m => m.views.map(v => v.view));
export const menuForView = (view: string) => allMenu.find(m => m.views.some(v => v.view === view)) ?? allMenu[0]!;

export const breedingViews = new Set<string>(['birds', 'pairs', 'breeding', 'family', 'health', 'tasks']);
export const commercialViews = new Set<string>(['clients', 'suppliers', 'sales', 'finance', 'stock', 'contacts']);
