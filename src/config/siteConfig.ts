/**
 * 站点级全局配置：门户信息、ICP 备案号、移动端安装包下载地址。
 * 集中定义，供所有公开页面（门面页 / 登录页 / Footer）与受保护布局统一引用，
 * 避免备案号等处散落硬编码字符串。
 */

export const SITE_NAME = "KnowledgeMap";

export const ICP_FILING = {
  /** ICP 备案号，全站（含各公开页与登录后布局）统一展示。 */
  number: "浙ICP备2026076010号-1",
  /** 工信部备案信息查询系统，备案号须显著展示并链接到此处。 */
  beianUrl: "https://beian.miit.gov.cn",
} as const;

/**
 * Android App 安装包（APK）下载地址。
 * 由部署环境变量 VITE_APK_URL 注入（如指向服务器 `app.cycbloom.cn/downloads/...apk`），
 * 未配置时为 null，门面页对应的下载入口将呈现为不可用占位。
 */
export const APK_DOWNLOAD_URL: string | null =
  (import.meta.env as Record<string, string | undefined>).VITE_APK_URL ?? null;