import { z } from "zod";

// --- Auth Schemas ---
export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(8, "密码至少需要8位")
    .regex(/[A-Z]/, "密码需要包含大写字母")
    .regex(/[a-z]/, "密码需要包含小写字母")
    .regex(/[0-9]/, "密码需要包含数字"),
  name: z.string().min(1, "姓名不能为空"),
});

export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

// --- Common Schemas ---
export const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID格式"),
});

// --- Graph Schemas ---
export const createGraphSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
});

export const updateGraphSchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

export const shareGraphSchema = z.object({
  is_public: z.boolean({ required_error: "必须指定是否公开" }),
});

// --- Node Schemas ---
export const createNodeSchema = z.object({
  id: z.string().uuid().optional(),
  graph_id: z.string().uuid("无效的图谱ID"),
  title: z.string().min(1, "标题不能为空"),
  content: z.string().optional(),
  x_position: z.number().optional(),
  y_position: z.number().optional(),
  properties: z.record(z.any()).optional(),
  learning_material: z.string().optional(),
  level: z.enum(["root", "core", "sub", "normal", "leaf"]).optional(),
  is_accepted: z.boolean().optional(),
});

export const updateNodeSchema = createNodeSchema
  .partial()
  .omit({ graph_id: true });

export const batchDeleteNodesSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1, "请提供有效的节点ID列表"),
});

export const relatedNodesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5)),
});

// --- Edge Schemas ---
export const createEdgeSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID"),
  source_knowledge_point_id: z.string().uuid("无效的源知识点ID"),
  target_knowledge_point_id: z.string().uuid("无效的目标知识点ID"),
  relationship_type: z.string().optional(),
});

export const updateEdgeSchema = z.object({
  relationship_type: z.string().optional(),
});

// --- Study Schemas ---
export const createCardSchema = z.object({
  knowledge_point_id: z.string().uuid("无效的知识点ID"),
  graph_id: z.string().uuid("无效的图谱ID"),
  question: z.string().min(1, "问题不能为空"),
  answer: z.string().min(1, "答案不能为空"),
});

export const createCardsBatchSchema = z.object({
  cards: z
    .array(
      z.object({
        knowledge_point_id: z.string().uuid("无效的知识点ID"),
        graph_id: z.string().uuid("无效的图谱ID"),
        question: z.string().min(1, "问题不能为空"),
        answer: z.string().min(1, "答案不能为空"),
        type: z.enum(["qa", "choice", "true_false"]).optional(),
        options: z.any().optional(),
      }),
    )
    .min(1, "至少需要一张卡片"),
});

export const updateCardProgressSchema = z.object({
  quality: z.number().min(0).max(5, "质量评分必须在0-5之间"),
});

// --- AI Schemas ---
export const generateContentSchema = z.object({
  topic: z.string().min(1, "主题不能为空"),
  context: z.string().optional(),
  level: z.string().optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const generateLearningMaterialSchema = z.object({
  topic: z.string().min(1, "主题不能为空"),
  context: z.string().optional(),
  level: z.string().optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const expandKnowledgeSchema = z.object({
  node_title: z.string().min(1, "节点标题不能为空"),
  node_content: z.string().optional(),
  node_level: z.string().optional(),
  existing_titles: z.array(z.string()).optional(),
  current_children: z.array(z.string()).optional(),
  expand_prompt: z.string().optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const generateCardsSchema = z.object({
  node_title: z.string().min(1, "节点标题不能为空"),
  node_content: z.string().optional(),
  count: z.number().min(1).max(50).optional(),
  types: z
    .array(
      z.enum([
        "qa",
        "choice",
        "true_false",
        "multi_choice",
        "fill_in_the_blank",
        "essay",
      ]),
    )
    .optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const generateCardsBatchSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1),
  config: z
    .object({
      types: z
        .array(
          z.enum([
            "qa",
            "choice",
            "true_false",
            "multi_choice",
            "fill_in_the_blank",
            "essay",
          ]),
        )
        .optional(),
      count: z.number().min(1).max(50).optional(), // Increased max count for packs
      pack_template: z
        .enum(["standard", "comprehensive", "exam", "quick"])
        .optional(),
      provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export const textToGraphSchema = z.object({
  text: z.string().optional(),
  graph_id: z.string().uuid("无效的图谱ID"),
  action: z.enum(["analyze", "save"]).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1, "消息不能为空"),
  graph_id: z.string().uuid("无效的图谱ID"),
  history: z.array(z.any()).optional(),
  context_node_ids: z.array(z.string().uuid()).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const recommendConnectionsSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID"),
  node_title: z.string().min(1, "节点标题不能为空"),
  node_content: z.string().optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const documentToGraphSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID"),
});

export const branchSuggestionsSchema = z.object({
  node_title: z.string().min(1, "节点标题不能为空"),
  node_content: z.string().optional(),
  existing_nodes: z.array(z.string()).optional(),
  child_nodes: z.array(z.string()).optional(),
  context_level: z.string().optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const tutorChatSchema = z.object({
  message: z.string().min(1, "消息不能为空"),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  history: z.array(z.any()).optional(),
  context_node_ids: z.array(z.string().uuid()).optional(),
  mode: z.enum(["free", "guided"]).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const extractConceptsSchema = z.object({
  text: z.string().min(1, "文本不能为空"),
  existing_nodes: z.array(z.string()).optional(),
  max_concepts: z.number().min(1).max(10).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const suggestNextTopicSchema = z.object({
  node_title: z.string().min(1, "节点标题不能为空"),
  node_content: z.string().optional(),
  existing_nodes: z.array(z.string()).optional(),
  user_progress: z
    .object({
      mastered_count: z.number().optional(),
      due_count: z.number().optional(),
      current_level: z.string().optional(),
    })
    .optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

// --- Data Schemas ---
export const importDataSchema = z.object({
  graph_title: z.string().min(1, "图谱标题不能为空"),
  nodes: z
    .array(
      z.object({
        id: z.string().optional(), // Old ID for mapping
        title: z.string().min(1, "节点标题不能为空"),
        content: z.string().optional(),
        x_position: z.number().optional(),
        y_position: z.number().optional(),
        color: z.string().optional(),
        level: z.string().optional(),
      }),
    )
    .optional(),
  edges: z
    .array(
      z.object({
        source: z.string(), // ID or index
        target: z.string(), // ID or index
        relationship: z.string().optional(),
      }),
    )
    .optional(),
});

// --- Template Schemas ---
export const createTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空"),
  description: z.string().optional(),
  category: z.enum(["learning", "story", "project", "analysis", "custom"]),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1, "节点ID不能为空"),
        title: z.string().min(1, "节点标题不能为空"),
        level: z.enum(["root", "core", "sub", "normal", "leaf"]),
        parentId: z.string().optional(),
        aiPrompt: z.string().optional(),
        color: z.string().optional(),
        x_position: z.number().optional(),
        y_position: z.number().optional(),
        position_zone: z.string().optional(),
      }),
    )
    .min(1, "至少需要一个节点"),
  edges: z
    .array(
      z.object({
        source: z.string().min(1, "源节点ID不能为空"),
        target: z.string().min(1, "目标节点ID不能为空"),
        relationship_type: z.string().optional(),
      }),
    )
    .optional(),
  layout: z
    .object({
      type: z.enum(["default", "quadrant", "timeline", "flowchart", "mindmap"]),
      showAxes: z.boolean().optional(),
      showGrid: z.boolean().optional(),
      showLabels: z.boolean().optional(),
      axes: z
        .object({
          x: z
            .object({
              label: z.string().optional(),
              min: z.number().optional(),
              max: z.number().optional(),
            })
            .optional(),
          y: z
            .object({
              label: z.string().optional(),
              min: z.number().optional(),
              max: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
      zones: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            bounds: z.object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
            }),
            color: z.string().optional(),
          }),
        )
        .optional(),
      timeline: z
        .object({
          direction: z.enum(["horizontal", "vertical"]),
          startLabel: z.string().optional(),
          endLabel: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createGraphFromTemplateSchema = z.object({
  template_id: z.string().uuid("无效的模板ID"),
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
});

// --- TTS Schemas ---
export const ttsSchema = z.object({
  text: z.string().min(1, "文本不能为空").max(5000, "文本过长"),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  output_format: z.enum(["mp3", "wav"]).optional(),
});

export const ttsVoicesSchema = z.object({});

// --- Additional AI Schemas ---
export const annotateTermsSchema = z.object({
  content: z.string().min(1, "内容不能为空"),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const podcastScriptSchema = z.object({
  topic: z.string().min(1, "主题不能为空"),
  content: z.string().optional(),
  style: z.enum(["conversational", "lecture", "interview"]).optional(),
  duration_minutes: z.number().min(1).max(60).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const batchExpandGraphSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID"),
  node_ids: z.array(z.string().uuid()).min(1, "至少需要一个节点"),
  max_depth: z.number().min(1).max(5).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});

export const urlToTextSchema = z.object({
  url: z.string().url("无效的URL格式"),
});

// --- Auto Graph Schemas ---
export const saveNodesSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID"),
  nodes: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1, "节点标题不能为空"),
        content: z.string().optional(),
        level: z.enum(["root", "core", "sub", "normal", "leaf"]).optional(),
        parentId: z.string().optional(),
      }),
    )
    .min(1, "至少需要一个节点"),
});

// --- Node Batch Operations ---
export const batchUpdatePositionsSchema = z.object({
  positions: z
    .array(
      z.object({
        id: z.string().uuid("无效的节点ID"),
        x_position: z.number(),
        y_position: z.number(),
      }),
    )
    .min(1, "至少需要一个节点位置"),
});

// --- Data Import Schemas ---
export const importMarkdownSchema = z.object({
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  title: z.string().min(1, "标题不能为空").optional(),
});

// --- Achievement Schemas ---
export const checkAchievementsSchema = z.object({
  type: z.enum(["study", "focus", "graph", "streak"]).optional(),
});

export const dailyCheckInSchema = z.object({});

// --- AI Actions Schemas ---
export const createAIActionSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string().optional(),
  trigger: z.enum(["manual", "auto", "scheduled"]),
  config: z.record(z.any()).optional(),
});

export const updateAIActionSchema = z.object({
  name: z.string().min(1, "名称不能为空").optional(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const executeAIActionSchema = z.object({
  action_id: z.string().uuid("无效的操作ID"),
  params: z.record(z.any()).optional(),
});

// --- Prompt Schemas ---
export const createPromptSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  content: z.string().min(1, "内容不能为空"),
  category: z.enum(["graph", "study", "chat", "custom"]).optional(),
  variables: z.array(z.string()).optional(),
});

export const optimizePromptSchema = z.object({
  prompt: z.string().min(1, "提示词不能为空"),
  goal: z
    .enum(["clarity", "specificity", "creativity", "structure"])
    .optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
});

// --- Task Schemas ---
export const createTaskSchema = z.object({
  task_type: z.enum([
    "one_time",
    "long_term",
    "periodic",
    "learning",
    "async",
  ]),
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
  queue_id: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  estimated_duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
  context: z.string().max(2000).optional(),
});

// --- Relation Delete Schemas ---
export const deleteRelationSchema = z.object({
  relationId: z.string().uuid("无效的关系ID"),
});

// --- Scheduler Schemas ---
export const createScheduledTaskSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
  queue_level: z.number().int().min(0).max(2).optional(),
  estimated_duration: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  knowledge_point_id: z.string().uuid().optional(),
  priority: z.number().int().optional(),
  task_type: z
    .enum(["one_time", "long_term", "periodic", "learning"])
    .optional(),
  total_duration: z.number().int().positive().optional(),
  progress_mode: z
    .enum(["average", "decreasing", "increasing", "custom"])
    .optional(),
  context: z.string().max(2000).optional(),
  parent_task_id: z.string().uuid().optional(),
});

export const updateScheduledTaskSchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  description: z.string().optional(),
  queue_level: z.number().int().min(0).max(2).optional(),
  position: z.number().int().optional(),
  estimated_duration: z.number().int().positive().optional(),
  actual_duration: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
  status: z
    .enum(["pending", "in_progress", "paused", "completed", "cancelled"])
    .optional(),
  tags: z.array(z.string()).optional(),
  knowledge_point_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().optional(),
  task_type: z
    .enum(["one_time", "long_term", "periodic", "learning"])
    .optional(),
  total_duration: z.number().int().positive().optional(),
  progress_mode: z
    .enum(["average", "decreasing", "increasing", "custom"])
    .optional(),
  context: z.string().max(2000).optional(),
  parent_task_id: z.string().uuid().optional(),
  scheduled_start: z.string().datetime().optional(),
  scheduled_end: z.string().datetime().optional(),
});

export const moveTaskSchema = z.object({
  target_queue: z.number().int().min(0).max(2, "队列级别必须在0-2之间"),
});

export const reorderTasksSchema = z.object({
  queue_level: z.number().int().min(0).max(2),
  task_ids: z.array(z.string().uuid()).min(1, "至少需要一个任务ID"),
});

export const relationshipCategorySchema = z.enum([
  "hierarchical",
  "dependency",
  "semantic",
  "temporal",
  "interaction",
  "causal",
  "custom",
]);

export const edgeLineStyleSchema = z.enum([
  "solid",
  "dashed",
  "dotted",
  "double",
]);

export const createRelationshipTypeSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称最多50个字符"),
  display_name: z
    .string()
    .min(1, "显示名称不能为空")
    .max(100, "显示名称最多100个字符"),
  category: relationshipCategorySchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效"),
  line_style: edgeLineStyleSchema,
  show_arrow: z.union([z.boolean(), z.literal("auto")]),
});

export const updateRelationshipTypeSchema = z.object({
  display_name: z
    .string()
    .min(1, "显示名称不能为空")
    .max(100, "显示名称最多100个字符")
    .optional(),
  category: relationshipCategorySchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效")
    .optional(),
  line_style: edgeLineStyleSchema.optional(),
  show_arrow: z.union([z.boolean(), z.literal("auto")]).optional(),
});

export const createTaskDependencySchema = z.object({
  depends_on_task_id: z.string().uuid("无效的依赖任务ID"),
  dependency_type: z.enum(["strict", "soft"]).default("strict"),
});

export const taskDependencyParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  dependencyId: z.string().uuid("无效的依赖ID"),
});

export const createTaskScheduleSchema = z.object({
  task_template_id: z.string().uuid("无效的任务模板ID"),
  schedule_type: z.enum(["daily", "weekly", "custom", "smart"]),
  schedule_config: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const updateTaskScheduleSchema = z.object({
  schedule_config: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const taskScheduleParamsSchema = z.object({
  id: z.string().uuid("无效的调度ID"),
});

export const createProgressPlanSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  progress_mode: z.enum(["average", "decreasing", "increasing", "custom"]),
  custom_allocations: z
    .array(
      z.object({
        date: z.string(),
        percentage: z.number().min(0).max(100),
      }),
    )
    .optional(),
});

export const updateProgressSchema = z.object({
  date: z.string().optional(),
  percentage: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export const createTimeSlotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "时间格式应为 HH:MM"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "时间格式应为 HH:MM"),
  is_available: z.boolean().optional(),
  label: z.string().max(50).optional(),
});

export const updateTimeSlotSchema = z.object({
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "时间格式应为 HH:MM")
    .optional(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "时间格式应为 HH:MM")
    .optional(),
  is_available: z.boolean().optional(),
  label: z.string().max(50).optional(),
});

export const timeSlotParamsSchema = z.object({
  id: z.string().uuid("无效的时间段ID"),
});

export const createQuizSetSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符"),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
});

export const updateQuizSetSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符").optional(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export const generateQuizSchema = z.object({
  quiz_set_id: z.string().uuid("无效的测验集合ID"),
  node_ids: z.array(z.string().uuid("无效的知识点ID")).min(1, "至少选择一个知识点"),
  config: z
    .object({
      types: z
        .array(
          z.enum([
            "qa",
            "choice",
            "true_false",
            "multi_choice",
            "fill_in_the_blank",
            "essay",
          ])
        )
        .optional(),
      count_per_node: z.number().min(1).max(20).optional(),
      provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export const regenerateCardSchema = z.object({
  id: z.string().uuid("无效的测验集合ID"),
  cardId: z.string().uuid("无效的卡片ID"),
});
