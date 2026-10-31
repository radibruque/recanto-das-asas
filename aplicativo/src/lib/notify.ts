import { Capacitor } from '@capacitor/core';
import type { NavigationTarget } from '../domain/ui-target';
import type { ScheduledNotice } from './notices';

/** Bridge exposed by the Windows app (electron/preload.cjs). */
type DesktopBridge = {
  scheduleNotifications(items: { id: string; at: number; title: string; body: string; target?: NavigationTarget }[]): Promise<void>;
  setKeepInTray(enabled: boolean): Promise<void>;
  getKeepInTray(): Promise<boolean>;
  onOpenTarget(listener: (target: NavigationTarget) => void): void;
};
declare global { interface Window { recantoDesktop?: DesktopBridge } }

export const desktopBridge = () => (typeof window !== 'undefined' ? window.recantoDesktop : undefined);
export const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const numericId = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0; return Math.abs(h) % 2147483000 + 1; };
let webTimers: ReturnType<typeof setTimeout>[] = [];
let lastSignature = '';
const openTarget = (target?: NavigationTarget) => { if (target) window.dispatchEvent(new CustomEvent('recanto:open-target', { detail: target })); };

let listenersReady = false;
async function prepareListeners() {
  if (listenersReady) return; listenersReady = true;
  const desktop = desktopBridge();
  if (desktop) { desktop.onOpenTarget(openTarget); return; }
  if (isAndroid()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.addListener('localNotificationActionPerformed', event => openTarget(event.notification.extra?.target as NavigationTarget | undefined));
  }
}

/** Ask for permission (Android 13+ and browsers). Returns whether notifications can be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (desktopBridge()) return true;
  if (isAndroid()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/** Replace the scheduled notices of this device with the current list. Works offline. */
export async function syncDeviceNotifications(items: ScheduledNotice[]): Promise<void> {
  const signature = JSON.stringify(items.map(i => [i.id, i.at.valueOf(), i.title, i.body]));
  if (signature === lastSignature) return;
  lastSignature = signature;
  try {
    await prepareListeners();
    const desktop = desktopBridge();
    if (desktop) { await desktop.scheduleNotifications(items.map(i => ({ id: i.id, at: i.at.valueOf(), title: i.title, body: i.body, target: i.target }))); return; }
    if (isAndroid()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      if (!items.length) return;
      await LocalNotifications.schedule({ notifications: items.map(i => ({
        id: numericId(i.id), title: i.title, body: i.body, schedule: { at: i.at, allowWhileIdle: true },
        extra: { target: i.target ?? null },
      })) });
      return;
    }
    // Browser fallback: only while the app is open.
    webTimers.forEach(clearTimeout); webTimers = [];
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    for (const i of items) {
      const wait = i.at.valueOf() - Date.now();
      if (wait > 0 && wait < 2147483000) webTimers.push(setTimeout(() => { const n = new Notification(i.title, { body: i.body, icon: '/artes/02_Digital/Monograma_RA_192px.png' }); n.onclick = () => { window.focus(); openTarget(i.target); }; }, wait));
    }
  } catch { lastSignature = ''; /* Avisos são complementares; o app continua funcionando. */ }
}
