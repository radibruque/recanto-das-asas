/**
 * The user chose to open the app without a password screen. The base password is
 * asked once per device and kept on this device so the app opens directly.
 * Backups and synchronization stay encrypted with that same password, so a
 * backup from Windows opens on Android and vice versa.
 */
const KEY = 'recanto.device.base-key.v1';

export function readDeviceKey(): string {
  try { return window.localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function saveDeviceKey(password: string): void {
  try { window.localStorage.setItem(KEY, password); } catch { /* the app keeps working for this session */ }
}

export function clearDeviceKey(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

/** Random base password for a brand-new installation (shown later in Sincronização). */
export function generateBaseKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{1,5}/g)!.join('-');
}
