import i18next from "i18next";
import { logger } from "./logger";
import {
  BACKEND_DEFAULT_LANGUAGE,
  BACKEND_NAMESPACES,
  zhNameSpaces,
  enNameSpaces,
} from "../../shared/i18n";

/**
 * API 端 i18next 初始化（方案 B）。
 *
 * 早期后端没有加载任何 locale 资源，i18next.t() 对缺失 key 返回原始 key
 * 字符串（returnNull:false），导致持久化任务标题为 `scheduler.graphTask.x`
 * 这类 key。现在通过 shared/i18n/index.ts 加载后端实际用到的命名空间资源，
 * i18next.t() 返回真实翻译，后端标题/错误/推荐等文案无需再各自硬编码。
 */
if (!i18next.isInitialized) {
  void i18next.init({
    // 默认语言与前端 DEFAULT_LANGUAGE 保持一致
    lng: BACKEND_DEFAULT_LANGUAGE,
    fallbackLng: BACKEND_DEFAULT_LANGUAGE,
    defaultNS: "translation",
    returnNull: false,
    interpolation: { escapeValue: false },
  });

  // 用 addResourceBundle 注入后端用到的命名空间资源（避免 i18next Resource 类型强约束）
  for (const ns of BACKEND_NAMESPACES) {
    i18next.addResourceBundle(
      "zh-CN",
      "translation",
      { [ns]: zhNameSpaces[ns] },
      true,
      true,
    );
    i18next.addResourceBundle(
      "en-US",
      "translation",
      { [ns]: enNameSpaces[ns] },
      true,
      true,
    );
  }

  logger.info("[i18n] API i18next initialized with backend resources (方案B)");
}

export default i18next;