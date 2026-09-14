import { useTranslation } from "react-i18next";
import { ICP_FILING } from "@/config/siteConfig";
import { isCapacitorMobile } from "@/config/mobileApiConfig";

/**
 * 公共页面（门面页 / 登录页 / 设置向导等）统一的底部 Footer：
 * 版权信息 + ICP 备案号。备案号须显著展示并链接到工信部系统。
 * Capacitor 手机 App 界面不展示（非强制且不占空间）；传入 className 供调用方调整间距。
 */
export const PublicFooter = ({ className = "" }: { className?: string }) => {
  const { t } = useTranslation();
  if (isCapacitorMobile()) {
    return null;
  }
  return (
    <footer
      role="contentinfo"
      className={`flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-3 text-[11px] text-gray-400 dark:text-slate-500 ${className}`}
    >
      <span>{t("common.footer.copyright")}</span>
      <span aria-hidden="true">·</span>
      <a
        href={ICP_FILING.beianUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {ICP_FILING.number}
      </a>
    </footer>
  );
};