import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Network,
  GraduationCap,
  Zap,
  Bot,
  Smartphone,
  CloudOff,
  LogIn,
  Download,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/hooks";
import { PublicFooter } from "@/components/Layout/PublicFooter";
import { SITE_NAME, APK_DOWNLOAD_URL } from "@/config/siteConfig";

const FEATURES = [
  {
    icon: Network,
    title: "知识图谱",
    desc: "以图谱组织知识节点与关系，让零散信息连成网络，可视化掌握整体脉络。",
    accent: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  },
  {
    icon: GraduationCap,
    title: "智能学习",
    desc: "基于记忆回顾的学习模式，配合自测与练习，把知识真正沉淀下来。",
    accent: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400",
  },
  {
    icon: Zap,
    title: "任务调度",
    desc: "把学习计划交给系统安排，按节奏自动推进，无需自己操心排期。",
    accent: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Bot,
    title: "AI 辅助",
    desc: "接入主流大模型，自动生成图谱与内容，辅助你拓展思路与整理知识。",
    accent: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Smartphone,
    title: "多端同步",
    desc: "手机、桌面与网页数据互通，随时随地把零散想法收集进同一张图里。",
    accent: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
  },
  {
    icon: CloudOff,
    title: "离线可用",
    desc: "支持离线数据模式，无网络时也能记录与浏览，恢复联网后自动同步。",
    accent: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  },
];

/**
 * 门面页（Landing）：网站首页对访客的介绍展示。
 * 无论是否登录都可停留于此，方便下载移动端安装包；提供「进入应用 / 登录」按钮。
 */
export const Landing = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <main
      id="public-main"
      tabIndex={-1}
      className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col focus:outline-none"
    >
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-5 md:px-8 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
            <Network className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {SITE_NAME}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? t("register.switchToLight") : t("register.switchToDark")}
            className="p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {t("configPage.loginTitle")}
          </Link>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-5 md:px-8 pb-12">
        {/* Hero */}
        <section className="text-center pt-10 md:pt-16 pb-10">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-100">
            {SITE_NAME}
            <span className="block mt-3 text-base md:text-xl font-normal text-gray-500 dark:text-gray-400">
              个人知识管理：图谱 · 学习 · 任务调度
            </span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            KnowledgeMap 是一个私有的个人知识管理系统。把知识组织成图谱，
            通过有计划的学习与自测让知识真正沉淀，并可由 AI 辅助生成与拓展内容。
            支持手机、桌面与网页多端使用。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              进入应用
            </Link>
            {APK_DOWNLOAD_URL ? (
              <a
                href={APK_DOWNLOAD_URL}
                download
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-500 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载 Android App
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-500 text-gray-400 dark:text-gray-500 text-sm font-medium cursor-not-allowed">
                <Download className="w-4 h-4" />
                Android App（即将提供）
              </span>
            )}
          </div>
        </section>

        {/* 功能介绍 */}
        <section className="mt-6">
          <h2 className="sr-only">核心功能</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-500 p-5 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${feature.accent}`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
};