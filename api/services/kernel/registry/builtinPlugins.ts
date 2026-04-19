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
    description: "Export knowledge graphs to Markdown files with customizable templates. Supports single graph export, batch export, and nested structure preservation.",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    permissions: ["graph:read", "storage:write"],
    keywords: ["export", "markdown", "documentation"],
    category: "productivity",
    homepage: "https://github.com/knowledgemap/markdown-exporter",
    installCount: 128,
    avgRating: 4.5,
    ratingCount: 23,
  },
  {
    name: "daily-digest",
    version: "1.1.0",
    description: "Generate daily knowledge digests based on your learning progress. Get a personalized summary of what you learned, what needs review, and suggested next steps.",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    dependencies: ["study"],
    permissions: ["study:read", "scheduler:read", "ai:write"],
    keywords: ["digest", "summary", "daily", "review"],
    category: "productivity",
    homepage: "https://github.com/knowledgemap/daily-digest",
    installCount: 89,
    avgRating: 4.2,
    ratingCount: 15,
  },
  {
    name: "graph-themes",
    version: "1.0.0",
    description: "Customize your knowledge graph appearance with beautiful themes. Includes dark mode, neon glow, nature, and minimal themes. Create and share your own themes.",
    author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
    main: "./index.js",
    permissions: ["graph:read", "storage:write"],
    keywords: ["theme", "visual", "dark-mode", "customization"],
    category: "visualization",
    homepage: "https://github.com/knowledgemap/graph-themes",
    installCount: 256,
    avgRating: 4.8,
    ratingCount: 42,
  },
];
