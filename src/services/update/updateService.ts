import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * 应用内自动更新：
 * - 读取本地版本（AutoUpdate 原生插件）
 * - 拉取服务器版本清单 latest.json（版本号 + APK 地址）
 * - 比较 versionCode，当前版本低于清单时判定有更新
 *
 * 仅 Capacitor 原生（移动端）支持；Web/Electron 端不激活。
 */

interface AutoUpdate {
  getLocalVersion(): Promise<{ versionName: string; versionCode: number }>;
  downloadAndInstall(options: { url: string; fileName?: string }): Promise<void>;
}

/** 原生插件包装：仅原生平台存在，Web 端保持 null（不调用注册）。 */
const native: AutoUpdate | null = Capacitor.isNativePlatform()
  ? Capacitor.registerPlugin<AutoUpdate>("AutoUpdate")
  : null;

export interface UpdateManifest {
  versionName: string;
  versionCode: number;
  url: string;
  notes?: string;
}

export interface LocalVersion {
  versionName: string;
  versionCode: number;
}

export interface UpdateCheckResult {
  supported: boolean;
  current: LocalVersion | null;
  latest: UpdateManifest | null;
  hasUpdate: boolean;
}

/** 服务器上的版本清单（与 APK 一起放在 /opt/km/web/downloads/）。 */
export const UPDATE_MANIFEST_URL = "https://app.cycbloom.cn/downloads/latest.json";

export const isAppUpdateSupported = (): boolean => native !== null;

export async function getLocalVersion(): Promise<LocalVersion | null> {
  if (native) {
    try {
      return await native.getLocalVersion();
    } catch {
      // 自定义插件异常时回退到官方 App 插件读取版本名
    }
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      if (info?.version) {
        // versionCode 未知时置 0：hasUpdate 会据此排除误报（仅用于展示版本名）
        return { versionName: info.version, versionCode: 0 };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function fetchUpdateManifest(): Promise<UpdateManifest | null> {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<UpdateManifest>;
    if (
      typeof data.versionCode === "number" &&
      typeof data.versionName === "string" &&
      typeof data.url === "string"
    ) {
      return data as UpdateManifest;
    }
    return null;
  } catch {
    return null;
  }
}

/** 语义化版本比较：返回 >0 表示 a 更新，<0 表示 a 更旧，===0 表示相等。 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = await getLocalVersion();
  const latest = await fetchUpdateManifest();
  // 双保险：优先用 versionCode（自研插件可读时）；读不到（versionCode=0）则退回
  // versionName 语义化比较，避免误报「已是最新」。
  const hasUpdate = Boolean(
    current &&
      latest &&
      ((current.versionCode > 0 && latest.versionCode > current.versionCode) ||
        (current.versionCode === 0 &&
          compareVersions(latest.versionName, current.versionName) > 0)),
  );
  return { supported: native !== null, current, latest, hasUpdate };
}

export async function downloadAndInstall(url: string): Promise<void> {
  if (!native) throw new Error("This device does not support in-app updates");
  await native.downloadAndInstall({ url });
}