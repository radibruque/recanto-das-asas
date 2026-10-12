import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  getAppearanceSnapshot, setAppearancePreference, subscribeAppearance,
  type ThemePreference,
} from '../lib/appearance';

const options = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] satisfies Array<{ value: ThemePreference; label: string; icon: typeof Sun }>;

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference } = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceSnapshot);
  return <div className={`theme-control${compact ? ' compact' : ''}`}>
    <span className="theme-control-label">Aparência</span>
    <div className="theme-options" role="group" aria-label="Tema da interface">
      {options.map(option => <button
        key={option.value}
        type="button"
        className={preference === option.value ? 'selected' : ''}
        aria-pressed={preference === option.value}
        aria-label={option.label}
        title={option.label === 'Sistema' ? 'Acompanhar o tema do sistema' : `Tema ${option.label.toLowerCase()}`}
        onClick={() => setAppearancePreference(option.value)}
      >
        <option.icon size={16} aria-hidden="true" />
        <span>{option.label}</span>
      </button>)}
    </div>
  </div>;
}
