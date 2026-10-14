import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type BiometricStatus = { available: boolean; enabled: boolean; reason: string };
type BiometricBridge = {
  status(): Promise<BiometricStatus>;
  enroll(options: { password: string }): Promise<{ enabled: boolean }>;
  unlock(): Promise<{ password: string }>;
  disable(): Promise<{ enabled: boolean }>;
};
type NavigationBridge = {
  addListener(event: 'backRequested', listener: () => void): Promise<PluginListenerHandle>;
  minimizeApp(): Promise<{ minimized: boolean }>;
  finishApp(): Promise<void>;
};
const biometrics = registerPlugin<BiometricBridge>('RecantoBiometrics');
const navigation = registerPlugin<NavigationBridge>('RecantoNavigation');
const unsupported = 'O acesso biométrico está disponível somente no aplicativo Android compatível. Use a senha da base.';
export const hasNativeBiometrics = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

function requireAndroid(): void {
  if (!hasNativeBiometrics()) throw new Error(unsupported);
}

export function biometricErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'E_BIOMETRIC_CANCELLED') return 'Biometria cancelada. Use a senha da base.';
  if (code === 'E_BIOMETRIC_BUSY') return 'Conclua ou cancele a confirmação de biometria que já está aberta.';
  if (code === 'E_BIOMETRIC_KEY') return 'Reative a biometria em Configurações depois de abrir com a senha da base.';
  if (code === 'E_BIOMETRIC_DATA') return 'Confira a senha da base. O acesso biométrico aceita senhas de até 1.024 caracteres.';
  if (code === 'E_BIOMETRIC_UNAVAILABLE') return 'A biometria segura não está disponível agora. Use a senha da base.';
  return 'Não foi possível concluir a biometria. A senha da base continua disponível.';
}

export async function biometricStatus(): Promise<BiometricStatus> {
  if (!hasNativeBiometrics()) return { available: false, enabled: false, reason: unsupported };
  try {
    const result = await biometrics.status();
    if (typeof result.available !== 'boolean' || typeof result.enabled !== 'boolean') throw new Error('Invalid native result');
    return { available: result.available, enabled: result.enabled, reason: typeof result.reason === 'string' ? result.reason.slice(0, 250) : '' };
  } catch {
    return { available: false, enabled: false, reason: 'Não foi possível consultar a biometria neste telefone. Use a senha da base.' };
  }
}

const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('recanto:biometrics-changed')); };

/** Validate against the current vault before sending an opt-in credential to the native prompt. */
export async function enableBiometrics(password: string, validatePassword: (password: string) => Promise<void>): Promise<void> {
  requireAndroid();
  if (!password || password.length > 1024) throw new Error('Informe a senha atual da base, com até 1.024 caracteres para o acesso biométrico.');
  await validatePassword(password);
  try {
    const result = await biometrics.enroll({ password });
    if (result.enabled !== true) throw new Error('Enrollment was not confirmed');
    changed();
  } catch (error) { throw new Error(biometricErrorMessage(error)); }
}

/** The credential lives only in this call and the already-existing in-memory vault session. */
export async function unlockWithBiometrics(unlockPassword: (password: string) => Promise<void>): Promise<void> {
  requireAndroid();
  let password: string;
  try {
    const result = await biometrics.unlock();
    if (typeof result.password !== 'string' || !result.password || result.password.length > 1024) throw new Error('Invalid biometric credential');
    password = result.password;
  } catch (error) { throw new Error(biometricErrorMessage(error)); }
  // Vault still verifies the credential. Native success alone never authenticates a different base.
  await unlockPassword(password);
}

export async function disableBiometrics(): Promise<void> {
  requireAndroid();
  try {
    const result = await biometrics.disable();
    if (result.enabled !== false) throw new Error('Removal was not confirmed');
    changed();
  } catch (error) { throw new Error(biometricErrorMessage(error)); }
}

/** No secret is carried in navigation events. Removing the listener restores native minimize fallback. */
export async function watchNativeBack(): Promise<() => void> {
  if (!hasNativeBiometrics()) return () => {};
  const handle = await navigation.addListener('backRequested', () => {
    window.dispatchEvent(new Event('recanto:native-back'));
  });
  return () => { void handle.remove(); };
}

export async function minimizeNativeApp(): Promise<void> {
  requireAndroid();
  const result = await navigation.minimizeApp();
  if (!result.minimized) throw new Error('Não foi possível minimizar o aplicativo.');
}

/** Call only after an explicit user exit and after locking the in-memory vault. */
export async function finishNativeApp(): Promise<void> {
  requireAndroid();
  await navigation.finishApp();
}
