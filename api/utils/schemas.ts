import { z } from 'zod';

// ==================== 用户认证 ====================

/** 用户注册 */
export const registerUserSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .min(8, '密码至少需要 8 位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多 100 个字符'),
});

/** 用户登录 */
export const loginUserSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

// ==================== 图谱 ====================

/** 标签数组校验：trim、非空、≤30 字符、≤20 个、去重 */
export const tagsArraySchema = z
  .array(z.string().trim().min(1, '标签不能为空').max(30, '标签最多 30 个字符'))
  .max(20, '标签最多 20 个')
  .transform((tags) => Array.from(new Set(tags)));

/** 创建图谱 */
export const createGraphSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多 200 个字符'),
  description: z
    .string()
    .max(2000, '描述最多 2000 个字符')
    .optional(),
  template_type: z.string().optional(),
  preset_id: z.string().optional(),
  tags: tagsArraySchema.optional(),
  domains: z
    .array(
      z.object({
        domain_id: z.string().uuid('无效的领域 ID'),
        is_primary: z.boolean().optional(),
      }),
    )
    .optional(),
});

/** 更新图谱 */
export const updateGraphSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题最多 200 个字符')
    .optional(),
  description: z
    .string()
    .max(2000, '描述最多 2000 个字符')
    .optional(),
  settings: z.record(z.any()).optional(),
  reference_books: z.any().optional(),
  external_links: z.any().optional(),
  learning_guide: z.string().nullable().optional(),
  podcast_script: z.string().nullable().optional(),
  tags: tagsArraySchema.optional(),
});

// ==================== 节点 ====================

/** 创建节点 */
export const createNodeSchema = z.object({
  graph_id: z.string().uuid('无效的图谱 ID'),
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(500, '标题最多 500 个字符'),
  content: z.string().optional(),
  summary: z
    .string()
    .max(200, '摘要最多 200 个字符')
    .optional(),
  x_position: z.number().optional(),
  y_position: z.number().optional(),
  properties: z.record(z.any()).optional(),
  learning_material: z.record(z.string(), z.string()).optional(),
  level: z
    .enum(['root', 'core', 'sub', 'normal', 'leaf'])
    .optional(),
  is_accepted: z.boolean().optional(),
  keywords: z
    .record(
      z.string(),
      z.array(
        z.object({
          term: z.string().min(1, '关键词不能为空'),
          importance: z.number().min(1).max(5, '重要度范围为 1-5'),
          category: z.string().min(1, '分类不能为空'),
          explanation: z.string().min(1, '解释不能为空'),
        }),
      ),
    )
    .optional(),
});

/** 更新节点 */
export const updateNodeSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(500, '标题最多 500 个字符')
    .optional(),
  content: z.string().optional(),
  summary: z
    .string()
    .max(200, '摘要最多 200 个字符')
    .optional(),
  x_position: z.number().optional(),
  y_position: z.number().optional(),
  properties: z.record(z.any()).optional(),
  learning_material: z.record(z.string(), z.string()).optional(),
  level: z
    .enum(['root', 'core', 'sub', 'normal', 'leaf'])
    .optional(),
  is_accepted: z.boolean().optional(),
  keywords: z
    .record(
      z.string(),
      z.array(
        z.object({
          term: z.string().min(1, '关键词不能为空'),
          importance: z.number().min(1).max(5, '重要度范围为 1-5'),
          category: z.string().min(1, '分类不能为空'),
          explanation: z.string().min(1, '解释不能为空'),
        }),
      ),
    )
    .optional(),
});

// ==================== 通用 ====================

/** UUID 路径参数验证 */
export const uuidParamsSchema = z.object({
  id: z.string().uuid('无效的 ID 格式'),
});

/** 批量操作 */
export const batchOperationSchema = z.object({
  ids: z
    .array(z.string().uuid('无效的 ID 格式'))
    .min(1, '至少需要一个 ID')
    .max(50, '最多 50 个 ID'),
});