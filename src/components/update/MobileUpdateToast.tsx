import { useEffect, useRef } from "react";
import { checkForUpdate } from "@/services/update/updateService";
import { message } from "@/utils/messageHelper";

/**
 * 移动端启动时的自动更新检查（仅渲染一次，不产生 UI）。
 * 每次 App 启动检查一次；仅当发现比上次提示过更新的版本号时才提醒，
 * 避免同一版本反复打扰，同时保证新版本一到就会推送。
 */
export function MobileUpdateToast() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void checkForUpdate().then((result) => {
      if (!result.hasUpdate || !result.latest) return;

      let notified = -1;
      try {
        notified = Number(localStorage.getItem("km:update:notifiedVersion") || "-1");
      } catch {
        /* ignore */
      }

      if (result.latest.versionCode <= notified) return;
      try {
        localStorage.setItem(
          "km:update:notifiedVersion",
          String(result.latest.versionCode),
        );
      } catch {
        /* ignore */
      }

      message.warning(
        `发现新版本 v${result.latest.versionName}（${result.latest.versionCode}），请到「设置 → 检查更新」更新`,
      );
    });
  }, []);

  return null;
}