import { Bird, Egg, Home, Menu, ShoppingBag } from 'lucide-react';
import type { Sector } from '../lib/navigation';

type Props = { currentView: string; sector: Sector; onNavigate: (view: 'home' | 'birds' | 'breeding') => void; onCommercial: () => void; onOpenMenus: () => void; menusExpanded?: boolean };

/** Navigation destinations only. + Novo is a separate contextual action. */
export default function WebShortcuts({ currentView, sector, onNavigate, onCommercial, onOpenMenus, menusExpanded = false }: Props) {
  const buttons = [
    { label: 'Hoje', icon: Home, selected: currentView === 'home' && sector === 'breeding', action: () => onNavigate('home') },
    { label: 'Aves', icon: Bird, selected: ['birds', 'family', 'health'].includes(currentView), action: () => onNavigate('birds') },
    { label: 'Reprodução', icon: Egg, selected: ['breeding', 'pairs'].includes(currentView), action: () => onNavigate('breeding') },
    { label: 'Comercial', icon: ShoppingBag, selected: sector === 'commercial', action: onCommercial },
    { label: 'Mais', icon: Menu, selected: menusExpanded, action: onOpenMenus },
  ];
  return <nav className="web-shortcuts" aria-label="Navegação inferior"><div className="web-shortcuts-items">{buttons.map(button => <button type="button" key={button.label} className={'web-shortcut' + (button.selected ? ' active' : '')} aria-current={button.selected && button.label !== 'Mais' ? 'page' : undefined} aria-label={button.label === 'Mais' ? 'Abrir todos os menus' : button.label} aria-controls={button.label === 'Mais' ? 'main-navigation' : undefined} aria-expanded={button.label === 'Mais' ? menusExpanded : undefined} onClick={button.action}><button.icon size={22} aria-hidden="true"/><span>{button.label}</span></button>)}</div></nav>;
}
