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
    StatusBar: {
      // 插件默认 #000000，Android 15 以下会在启动瞬间把状态栏涂黑
      backgroundColor: "#ffffff",
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
