import type { PluginManifest } from "../types";

export interface RegistryPluginEntry extends PluginManifest {
  installCount: number;
  avgRating: number;
  ratingCount: number;
}

export const builtinPlugins: RegistryPluginEntry[] = [
  {
    name: "markdown-exporter",
    version: "1.0.0",
    description: "将知识图谱导出为 Markdown 文件，支持自定义模板。支持单个图谱导出、批量导出，以及嵌套结构保留。",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    permissions: ["graph:read", "storage:write"],
    keywords: ["导出", "markdown", "文档"],
    category: "productivity",
    homepage: "https://github.com/knowledgemap/markdown-exporter",
    installCount: 128,
    avgRating: 4.5,
    ratingCount: 23,
  },
  {
    name: "daily-digest",
    version: "1.1.0",
    description: "基于学习进度生成每日知识摘要。获取个性化的学习总结，包括已学内容、待复习内容和下一步建议。",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    dependencies: ["study"],
    permissions: ["study:read", "scheduler:read", "ai:write"],
    keywords: ["摘要", "总结", "每日", "复习"],
    category: "productivity",
    homepage: "https://github.com/knowledgemap/daily-digest",
    installCount: 89,
    avgRating: 4.2,
    ratingCount: 15,
  },
  {
    name: "graph-themes",
    version: "1.0.0",
    description: "使用精美主题自定义知识图谱外观。包含深色模式、霓虹光效、自然风格和极简主题。创建并分享你自己的主题。",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    permissions: ["graph:read", "storage:write"],
    keywords: ["主题", "视觉", "深色模式", "自定义"],
    category: "visualization",
    homepage: "https://github.com/knowledgemap/graph-themes",
    installCount: 256,
    avgRating: 4.8,
    ratingCount: 42,
  },
];
