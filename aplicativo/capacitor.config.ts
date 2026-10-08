import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.recantodasasas.app',
  appName: 'Recanto das Asas',
  webDir: 'dist',
  // Never point a production build at a remote server: it must start offline.
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { path: 'native/android', allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
