// 学习路径路由共享 schemas 与常量

import { z } from "zod";

// 通用的 ID 参数 schema（学习路径 ID）
export const uuidParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
});

// 学习路径节点相关参数 schema（路径 ID + 节点 ID）
export const nodeIdParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
  nodeId: z.string().uuid("无效的节点ID"),
});

// 日期参数 schema（路径 ID + 日期）
export const dateParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD"),
});

// 图谱 ID 参数 schema
export const graphIdParamSchema = z.object({
  graphId: z.string().uuid("无效的图谱ID"),
});
