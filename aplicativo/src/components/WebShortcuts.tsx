import { Bird, Heart, Menu, Plus, Wallet } from 'lucide-react';

type ShortcutView = 'birds' | 'pairs' | 'finance';

type WebShortcutsProps = {
  currentView: string;
  onCreateBird: () => void;
  onNavigate: (view: ShortcutView) => void;
  onOpenMenus: () => void;
  menusExpanded?: boolean;
};

/** Presentation only: every shortcut invokes an existing application action. */
export default function WebShortcuts({ currentView, onCreateBird, onNavigate, onOpenMenus, menusExpanded = false }: WebShortcutsProps) {
  const shortcuts = [
    { view: 'birds', label: 'Aves', icon: Bird },
    { view: 'pairs', label: 'Casais', icon: Heart },
    { view: 'finance', label: 'Financeiro', icon: Wallet },
  ] as const;

  return <nav className="web-shortcuts" aria-label="Atalhos rápidos">
    <div className="web-shortcuts-items">
      <button type="button" className="web-shortcut web-shortcut-create" aria-label="Cadastrar ave pelo atalho" onClick={onCreateBird}>
        <Plus size={22} aria-hidden="true"/>
        <span>Cadastrar</span>
      </button>
      {shortcuts.map(shortcut => <button
        type="button"
        key={shortcut.view}
        className={'web-shortcut' + (currentView === shortcut.view ? ' active' : '')}
        aria-current={currentView === shortcut.view ? 'page' : undefined}
        onClick={() => onNavigate(shortcut.view)}
      >
        <shortcut.icon size={22} aria-hidden="true"/>
        <span>{shortcut.label}</span>
      </button>)}
      <button type="button" className="web-shortcut" aria-label="Abrir todos os menus" aria-controls="main-navigation" aria-expanded={menusExpanded} onClick={onOpenMenus}>
        <Menu size={22} aria-hidden="true"/>
        <span>Menus</span>
      </button>
    </div>
  </nav>;
}
