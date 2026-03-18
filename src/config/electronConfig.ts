export function isElectron(): boolean {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return true;
  }
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.electron
  ) {
    return true;
  }
  return false;
}

export function isElectronProduction(): boolean {
  if (!isElectron()) {
    return false;
  }
  return !import.meta.env.VITE_DEV_SERVER_URL;
}

export async function getApiPort(): Promise<number> {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    try {
      const port = await (window as any).electronAPI.ipc.invoke("api:getPort");
      return port || 3001;
    } catch {
      return 3001;
    }
  }
  return 3001;
}

export async function getElectronApiUrl(): Promise<string> {
  if (!isElectron()) {
    return "/api";
  }
  if (isElectronProduction()) {
    const port = await getApiPort();
    return `http://localhost:${port}/api`;
  }
  return "/api";
}
