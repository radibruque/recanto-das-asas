import { useSyncExternalStore } from 'react';

/** Preferences of this device only. They never enter the encrypted base or sync. */
export type Preferences = {
  deviceId: string;
  ownerName: string;
  deviceName: string;
  notifications: boolean;
  notifyTasks: boolean;
  notifyHatch: boolean;
  notifyBills: boolean;
  notifyDeliveries: boolean;
  taskAdvanceMinutes: number;
  dailyNoticeHour: number;
  reportReminders: boolean;
  keepInTray: boolean;
  dismissedReports: string[];
};

const KEY = 'recanto.preferences.v1';
const defaults: Preferences = {
  deviceId: '', ownerName: '', deviceName: '', notifications: true, notifyTasks: true, notifyHatch: true, notifyBills: true, notifyDeliveries: true,
  taskAdvanceMinutes: 15, dailyNoticeHour: 8, reportReminders: true, keepInTray: false, dismissedReports: [],
};

let current: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  let value: Preferences;
  try {
    const raw = window.localStorage.getItem(KEY);
    value = raw ? { ...defaults, ...JSON.parse(raw) as Partial<Preferences> } : { ...defaults };
  } catch { value = { ...defaults }; }
  if (!value.deviceId) {
    value.deviceId = crypto.randomUUID();
    try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* session only */ }
  }
  return value;
}

export function getPreferences(): Preferences { return current; }

export function setPreferences(change: Partial<Preferences>): void {
  current = { ...current, ...change };
  try { window.localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* session only */ }
  listeners.forEach(l => l());
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, getPreferences, getPreferences);
}

export function devicePlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (location.protocol === 'app:' || /Electron/i.test(ua)) return 'Windows';
  return 'Navegador';
}

export function defaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Celular Android';
  if (/Windows/i.test(ua)) return 'Computador Windows';
  return 'Este aparelho';
}
