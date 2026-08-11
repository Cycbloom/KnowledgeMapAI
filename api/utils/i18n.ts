import i18next from "i18next";
import { logger } from "./logger";

/**
 * API 端 i18next 初始化。
 *
 * 后端进程（api/）不会打包前端 locale 资源（api/ 与 src/ 只能依赖 shared/，
 * 不能互相依赖），因此服务端 i18next.t() 在 i18next >= v23 时对缺失 key
 * 默认返回 null。这会导致自动生成的任务标题为 null，
 * 触发 user_tasks.title NOT NULL 约束违反。
 *
 * 通过 returnNull:false 让缺失 key 回退为 key 字符串（非 null），
 * 避免服务端任务标题为空。该配置在 init() 调用时同步写入 this.options
 * （i18next v23+ 资源加载为异步，但 returnNull 立即生效）。
 */
if (!i18next.isInitialized) {
  void i18next.init({
    returnNull: false,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
  });
  logger.info("[i18n] API i18next initialized with returnNull:false");
}

export default i18next;