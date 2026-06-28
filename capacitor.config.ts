import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.NODE_ENV !== "production";

const config: CapacitorConfig = {
  appId: "com.knowledgemap.app",
  appName: "KnowledgeMap",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: isDev,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      autoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: isDev,
    captureInput: true,
    webContentsDebuggingEnabled: isDev,
    buildOptions: {
      signingType: "apksigner",
    },
  },
};

export default config;
