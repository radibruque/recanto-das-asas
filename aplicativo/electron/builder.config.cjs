const path = require('node:path');
const manifest = require('../package.json');
const releaseSigningConfigured = Boolean(process.env.CSC_LINK);

module.exports = {
  appId: 'br.com.recantodasasas.app',
  productName: 'Recanto das Asas',
  electronVersion: manifest.devDependencies.electron,
  directories: { app: 'release/staging', output: 'release/windows' },
  asar: true,
  toolsets: { wine: '1.0.1' },
  files: ['!node_modules/**/*', 'dist/**/*', 'electron/main.cjs', 'native/icon.png', 'package.json'],
  artifactName: 'Recanto-das-Asas-${version}-${arch}-Setup.${ext}',
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: path.resolve(__dirname, '../native/icon.ico'),
    // Cross-compilation can produce an explicitly unsigned installer without Wine.
    signAndEditExecutable: releaseSigningConfigured,
    forceCodeSigning: releaseSigningConfigured,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Recanto das Asas',
    deleteAppDataOnUninstall: false,
    runAfterFinish: false,
    include: path.resolve(__dirname, 'installer.nsh'),
  },
};
