import { useEffect, useState, type FormEvent } from 'react';
import { Fingerprint } from 'lucide-react';
import { biometricStatus, disableBiometrics, enableBiometrics, hasNativeBiometrics, unlockWithBiometrics, type BiometricStatus } from '../lib/biometrics';

function useBiometricStatus() {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  useEffect(() => {
    if (!hasNativeBiometrics()) return;
    let active = true;
    const update = () => { void biometricStatus().then(value => { if (active) setStatus(value); }); };
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    update();
    window.addEventListener('recanto:biometrics-changed', update);
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.removeEventListener('recanto:biometrics-changed', update); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return status;
}

type Feedback = { notify: (message: string) => void };

/** Login remains password-capable even when a biometric attempt is cancelled or invalidated. */
export function BiometricsButton({ onUnlockPassword, notify, disabled = false, onBusyChange }: Feedback & {
  onUnlockPassword: (password: string) => Promise<void>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const status = useBiometricStatus(), [busy, setBusy] = useState(false);
  if (!status?.enabled) return null;
  const unlock = async () => {
    if (busy || disabled) return;
    setBusy(true);
    onBusyChange?.(true);
    try { await unlockWithBiometrics(onUnlockPassword); }
    catch (error) { notify(error instanceof Error ? error.message : 'Use a senha da base para abrir seus registros.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  return <button type="button" className="button secondary" disabled={disabled || busy || !status.available} onClick={() => { void unlock(); }}>
    <Fingerprint size={20} aria-hidden="true" />{busy ? 'Confirmando biometria…' : 'Abrir com biometria'}
  </button>;
}

/** Enrollment is local to this phone and never joins sync data or backup documents. */
export function BiometricsManage({ onValidatePassword, notify }: Feedback & {
  onValidatePassword: (password: string) => Promise<void>;
}) {
  const status = useBiometricStatus(), [password, setPassword] = useState(''), [busy, setBusy] = useState(false);
  if (!hasNativeBiometrics()) return null;
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const candidate = password;
    setPassword('');
    try {
      await enableBiometrics(candidate, onValidatePassword);
      notify('Biometria ativada somente neste telefone. Continue guardando a senha da base para outros aparelhos e backups.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível ativar a biometria. Use a senha da base.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    setPassword('');
    try { await disableBiometrics(); notify('Acesso biométrico removido deste telefone. A senha da base permanece igual.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível remover a biometria.'); }
    finally { setBusy(false); }
  }
  return <section className="card stack settings-card" aria-label="Acesso biométrico">
    <h2 className="section-title">Acesso com biometria</h2>
    <p>A biometria do Android pode abrir a base neste telefone. A senha fica protegida pelo sistema e só é liberada após sua confirmação biométrica.</p>
    {!status && <p role="status">Verificando disponibilidade…</p>}
    {status && <p>{status.enabled ? 'Ativada neste telefone.' : 'Ainda não ativada.'}{!status.available && ` ${status.reason}`}</p>}
    {status?.enabled ? <button type="button" className="button secondary" disabled={busy} onClick={() => { void remove(); }}>{busy ? 'Removendo…' : 'Remover acesso biométrico'}</button> :
      <form className="stack" onSubmit={event => { void enroll(event); }}>
        <label className="field">Confirme a senha atual da base<input name="biometricPassword" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={1024} required disabled={busy || !status?.available} /></label>
        <button className="button secondary" disabled={busy || !status?.available}><Fingerprint size={20} aria-hidden="true" />{busy ? 'Confirmando…' : 'Ativar biometria neste telefone'}</button>
      </form>}
    <p className="muted">A senha continua necessária para backups e outros aparelhos. Minimizar preserva a sessão enquanto o Android mantiver o aplicativo aberto; se o sistema encerrar o processo, será necessário abrir a base novamente.</p>
  </section>;
}
