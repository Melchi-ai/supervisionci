// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supervisionci.app',
  appName: 'SupervisionCI',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    // SQLite pour le stockage offline natif Android
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases',
    },
    // Accès réseau
    Network: {
      enabled: true,
    },
  },
  // Serveur local pour le dev
  server: {
    androidScheme: 'https',
  },
};

export default config;
