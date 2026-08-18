import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Save,
  Eye,
  EyeOff,
  Star,
  StarOff,
  BookOpen,
  Users,
  Network,
  GripVertical,
  Sparkles,
  Wand2,
  Loader2,
  LayoutTemplate,
  FileText,
  ListOrdered,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/services/api";
import { message } from "@/utils/messageHelper";
import { asyncConfirm } from "@/utils/asyncConfirm";
import i18n from "../../i18n";
import type {
  LearningMaterialSchema,
  LearningMaterialSection,
  LearningSchemaScope,
} from "@shared/types";

// ============================================================
// Learning Chapter Schema Editor（增强版）
// ------------------------------------------------------------
// 1. 系统预设 + 我的 + 图谱专属方案管理（CRUD / 默认 / 复制）
// 2. 章节可视化编辑：拖拽排序（@dnd-kit）、增删、上下移
// 3. 章节模板库：一键插入常用章节
// 4. 双模式预览：Markdown 大纲预览 / Prompt 结构预览
// 5. AI 辅助：按主题+学习目标生成整套章节 / 优化现有章节
// ============================================================

interface Props {
  open: boolean;
  onClose: () => void;
  graphId?: string;
  /** 当前选中的方案 ID（可选） */
  selectedSchemaId?: string;
  /** 切换选中方案时回调（父组件记录到本地状态，下次生成学习材料使用） */
  onSelect?: (schemaId: string) => void;
}

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  scope: LearningSchemaScope;
  is_default: boolean;
  sections: LearningMaterialSection[];
  /** 编辑中的原始数据 scope：system=只读，user/graph=可保存 */
  sourceScope: LearningSchemaScope;
  isDirty: boolean;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createBlankSections(): LearningMaterialSection[] {
  return [{ id: uid(), title: "", instruction: "", order: 1 }];
}

/** Prompt 结构预览（等宽文本） */
function buildPreviewPrompt(
  sections: LearningMaterialSection[],
  lang: string,
): string {
  const isZh = lang.startsWith("zh");
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const lines = sorted.map((sec, idx) => {
    const no = idx + 1;
    const title =
      sec.title || i18n.t("learning.material.schema.untitledSection");
    const instruction =
      sec.instruction || i18n.t("learning.material.schema.noInstruction");
    let line = `${no}. **${title}**: ${instruction}`;
    if (sec.min_words && sec.max_words) {
      line += `  (≈${sec.min_words}-${sec.max_words} ${isZh ? "字" : "words"})`;
    } else if (sec.min_words) {
      line += `  (≥${sec.min_words} ${isZh ? "字" : "words"})`;
    } else if (sec.max_words) {
      line += `  (≤${sec.max_words} ${isZh ? "字" : "words"})`;
    }
    return line;
  });
  return lines.join("\n");
}

/** Markdown 大纲预览（模拟生成出的学习材料目录结构） */
function buildOutlineMarkdown(
  sections: LearningMaterialSection[],
  lang: string,
): string {
  const isZh = lang.startsWith("zh");
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const parts = sorted.map((sec, idx) => {
    const range =
      sec.min_words || sec.max_words
        ? `${sec.min_words ?? "?"} – ${sec.max_words ?? "?"}`
        : isZh
          ? "不限"
          : "flexible";
    const wordsLabel = isZh ? `建议篇幅：${range} 字` : `Suggested length: ${range} words`;
    return `## ${idx + 1}. ${sec.title || (isZh ? "（未命名章节）" : "(Untitled)")}\n\n${
      sec.instruction || (isZh ? "*（未填写写作指令）*" : "*(No instruction yet)*")
    }\n\n> ${wordsLabel}`;
  });
  return parts.join("\n\n");
}

// ============================================================
// 章节模板库
// ============================================================
type SectionTemplateKey =
  | "intro"
  | "concepts"
  | "mechanisms"
  | "comparison"
  | "examples"
  | "pitfalls"
  | "exercises"
  | "glossary"
  | "extension"
  | "summary";

interface SectionTemplate {
  key: SectionTemplateKey;
  nameKey: `learning.material.schema.templates.${SectionTemplateKey}`;
  zh: { title: string; instruction: string; min_words: number; max_words: number };
  en: { title: string; instruction: string; min_words: number; max_words: number };
}

const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    key: "intro",
    nameKey: "learning.material.schema.templates.intro",
    zh: {
      title: "引言",
      instruction:
        "简要介绍本章主题是什么、为什么值得学。用一个贴近生活的例子或反常识的事实作为钩子，激发学习兴趣。不要展开技术细节。",
      min_words: 100,
      max_words: 250,
    },
    en: {
      title: "Introduction",
      instruction:
        "Briefly introduce what this topic is and why it matters. Start with a relatable example or a counterintuitive fact as a hook. Do not dive into technical details yet.",
      min_words: 80,
      max_words: 200,
    },
  },
  {
    key: "concepts",
    nameKey: "learning.material.schema.templates.concepts",
    zh: {
      title: "核心概念",
      instruction:
        "系统讲解该主题的核心概念与理论基础。对每个关键概念给出清晰定义，并至少用一个类比帮助理解。用**加粗**标出关键术语。",
      min_words: 300,
      max_words: 600,
    },
    en: {
      title: "Core Concepts",
      instruction:
        "Explain the core concepts and theoretical foundations systematically. Give a clear definition for each key concept and use at least one analogy. Bold key terms.",
      min_words: 250,
      max_words: 500,
    },
  },
  {
    key: "mechanisms",
    nameKey: "learning.material.schema.templates.mechanisms",
    zh: {
      title: "机制详解",
      instruction:
        "深入剖析该主题的工作机制（how it works）。按步骤展开，可用有序列表描述流程；涉及关键流程时说明每一步的输入、处理和输出。",
      min_words: 300,
      max_words: 700,
    },
    en: {
      title: "Key Mechanisms",
      instruction:
        "Deep-dive into how it works. Break down step by step with ordered lists; for each key step explain the input, processing and output.",
      min_words: 250,
      max_words: 600,
    },
  },
  {
    key: "comparison",
    nameKey: "learning.material.schema.templates.comparison",
    zh: {
      title: "对比分析",
      instruction:
        "将该主题与易混淆的相关概念/技术进行对比。用 Markdown 表格从多个维度对比，然后总结各自适用场景，并给出选型建议。",
      min_words: 200,
      max_words: 500,
    },
    en: {
      title: "Comparison",
      instruction:
        "Compare this topic with easily-confused related concepts/technologies. Use a Markdown table across multiple dimensions, then summarize when to use each and give recommendations.",
      min_words: 180,
      max_words: 450,
    },
  },
  {
    key: "examples",
    nameKey: "learning.material.schema.templates.examples",
    zh: {
      title: "实战案例",
      instruction:
        "给出 2-3 个真实世界的应用案例或历史事件。每个案例说明背景、做了什么、结果与启示。案例要具体，避免空泛描述。",
      min_words: 250,
      max_words: 600,
    },
    en: {
      title: "Real-world Examples",
      instruction:
        "Provide 2-3 real-world use cases or historical events. For each case explain the background, what was done, and the outcome/lessons. Be specific, avoid vague descriptions.",
      min_words: 200,
      max_words: 500,
    },
  },
  {
    key: "pitfalls",
    nameKey: "learning.material.schema.templates.pitfalls",
    zh: {
      title: "常见误区",
      instruction:
        "列出学习者在该主题上最常见的 3-5 个误解或错误做法。每个误区先说明错误认知，再解释正确理解，形成鲜明对比。",
      min_words: 150,
      max_words: 400,
    },
    en: {
      title: "Common Pitfalls",
      instruction:
        "List 3-5 most common misconceptions or mistakes learners make on this topic. For each pitfall, first state the wrong belief, then explain the correct understanding.",
      min_words: 120,
      max_words: 350,
    },
  },
  {
    key: "exercises",
    nameKey: "learning.material.schema.templates.exercises",
    zh: {
      title: "练习与自测",
      instruction:
        "设计 3-5 道自测题帮助巩固本章内容：包含 1-2 道概念辨析题、1 道应用场景题、1 道开放思考题。题目附简短答案或提示（用折叠或引用格式）。",
      min_words: 150,
      max_words: 400,
    },
    en: {
      title: "Practice & Self-check",
      instruction:
        "Design 3-5 self-check questions: 1-2 concept discrimination, 1 application scenario, 1 open-ended reflection. Attach brief answers or hints in blockquote format.",
      min_words: 120,
      max_words: 350,
    },
  },
  {
    key: "glossary",
    nameKey: "learning.material.schema.templates.glossary",
    zh: {
      title: "术语表",
      instruction:
        "汇总本章出现的关键术语，用 Markdown 表格列出：术语 | 一句话解释 | 相关术语。按重要程度排序，控制在 8-15 个术语。",
      min_words: 100,
      max_words: 300,
    },
    en: {
      title: "Glossary",
      instruction:
        "Summarize key terms in a Markdown table: Term | One-line explanation | Related terms. Order by importance, keep 8-15 terms.",
      min_words: 80,
      max_words: 250,
    },
  },
  {
    key: "extension",
    nameKey: "learning.material.schema.templates.extension",
    zh: {
      title: "扩展阅读",
      instruction:
        "推荐进一步学习的方向与资源：列出 3-5 个进阶主题（一句话说明为什么值得学）和推荐的资料类型（论文/书籍/课程）。不虚构具体链接。",
      min_words: 80,
      max_words: 250,
    },
    en: {
      title: "Further Reading",
      instruction:
        "Recommend directions for further learning: list 3-5 advanced topics (one line on why each matters) and suggested resource types (papers/books/courses). Do not fabricate links.",
      min_words: 60,
      max_words: 200,
    },
  },
  {
    key: "summary",
    nameKey: "learning.material.schema.templates.summary",
    zh: {
      title: "总结",
      instruction:
        "用要点列表总结本章核心收获（4-6 条），最后给出一句话记忆锚点（mnemonic），方便回顾时快速唤起记忆。",
      min_words: 80,
      max_words: 200,
    },
    en: {
      title: "Summary",
      instruction:
        "Summarize key takeaways with a bullet list (4-6 items), and end with a one-line mnemonic anchor for quick recall.",
      min_words: 60,
      max_words: 180,
    },
  },
];

const SCOPE_META: Record<
  LearningSchemaScope,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  system: {
    label: "learning.material.schema.scopeSystem",
    color: "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700",
    icon: BookOpen,
  },
  user: {
    label: "learning.material.schema.scopeUser",
    color: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-900/30 dark:border-violet-700",
    icon: Users,
  },
  graph: {
    label: "learning.material.schema.scopeGraph",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700",
    icon: Network,
  },
};

// ============================================================
// 可拖拽章节卡片
// ============================================================
interface SortableSectionCardProps {
  sec: LearningMaterialSection;
  idx: number;
  total: number;
  readOnly: boolean;
  disabled?: boolean;
  onFieldChange: (idx: number, patch: Partial<LearningMaterialSection>) => void;
  onMove: (idx: number, delta: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onInsertAfter: (idx: number) => void;
  labelTitle: string;
  labelInstruction: string;
  labelMin: string;
  labelMax: string;
  labelUp: string;
  labelDown: string;
  labelRemove: string;
  labelDrag: string;
  labelInsert: string;
  /** 插入后自动聚焦标题输入框 */
  autoFocusTitle: boolean;
  onTitleFocused: () => void;
}

const SortableSectionCard: React.FC<SortableSectionCardProps> = ({
  sec,
  idx,
  total,
  readOnly,
  disabled,
  onFieldChange,
  onMove,
  onRemove,
  onInsertAfter,
  labelTitle,
  labelInstruction,
  labelMin,
  labelMax,
  labelUp,
  labelDown,
  labelRemove,
  labelDrag,
  labelInsert,
  autoFocusTitle,
  onTitleFocused,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sec.id, disabled: readOnly || disabled });

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocusTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      onTitleFocused();
    }
  }, [autoFocusTitle, onTitleFocused]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={readOnly || disabled}
            className={`p-1 rounded-md text-slate-400 ${
              readOnly || disabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
            }`}
            title={labelDrag}
            aria-label={labelDrag}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary-500 text-white text-sm font-semibold">
            {idx + 1}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {sec.title || labelTitle}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0 || readOnly}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200/60 disabled:opacity-40 dark:hover:bg-slate-700/60 dark:text-slate-300"
            title={labelUp}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(idx, 1)}
            disabled={idx === total - 1 || readOnly}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200/60 disabled:opacity-40 dark:hover:bg-slate-700/60 dark:text-slate-300"
            title={labelDown}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onInsertAfter(idx)}
            disabled={readOnly}
            className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-100 disabled:opacity-40 dark:hover:bg-emerald-900/30"
            title={labelInsert}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            disabled={readOnly}
            className="p-1.5 rounded-md text-rose-500 hover:bg-rose-100 disabled:opacity-40 dark:hover:bg-rose-900/30"
            title={labelRemove}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <input
          ref={titleInputRef}
          type="text"
          value={sec.title}
          onChange={(e) => onFieldChange(idx, { title: e.target.value })}
          disabled={readOnly}
          placeholder={labelTitle}
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
        />
        <textarea
          value={sec.instruction}
          onChange={(e) => onFieldChange(idx, { instruction: e.target.value })}
          disabled={readOnly}
          rows={3}
          placeholder={labelInstruction}
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50 resize-y"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {labelMin}
            </label>
            <input
              type="number"
              min={0}
              value={sec.min_words ?? ""}
              onChange={(e) =>
                onFieldChange(idx, {
                  min_words: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              disabled={readOnly}
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {labelMax}
            </label>
            <input
              type="number"
              min={0}
              value={sec.max_words ?? ""}
              onChange={(e) =>
                onFieldChange(idx, {
                  max_words: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              disabled={readOnly}
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 主组件
// ============================================================
export const LearningChapterSchemaEditor: React.FC<Props> = ({
  open,
  onClose,
  graphId,
  selectedSchemaId,
  onSelect,
}) => {
  const { t, i18n } = useTranslation();
  const [schemas, setSchemas] = useState<LearningMaterialSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<"outline" | "prompt">("outline");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    id: null,
    name: "",
    description: "",
    scope: "user",
    is_default: false,
    sections: createBlankSections(),
    sourceScope: "user",
    isDirty: false,
  });

  // AI 辅助状态
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"generate" | "optimize">("generate");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGoal, setAiGoal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  /** 刚插入、待自动聚焦标题的章节 ID */
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 加载所有可用方案
  const loadSchemas = async () => {
    setLoading(true);
    try {
      const data = await api.learningMaterialSchemas.list(graphId);
      setSchemas(data);
      if (!selectedSchemaId && data.length > 0) {
        const def =
          data.find((s) => s.scope === "graph" && s.is_default) ||
          data.find((s) => s.scope === "user" && s.is_default) ||
          data.find((s) => s.scope === "system" && s.is_default) ||
          data[0];
        if (def) loadSchemaIntoEditor(def);
      } else if (selectedSchemaId) {
        const hit = data.find((s) => s.id === selectedSchemaId);
        if (hit) loadSchemaIntoEditor(hit);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSchemas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, graphId]);

  const loadSchemaIntoEditor = (s: LearningMaterialSchema) => {
    const sections = [...s.sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    setEditor({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      scope: s.scope === "system" ? "user" : s.scope,
      is_default: s.is_default,
      sections,
      sourceScope: s.scope,
      isDirty: false,
    });
    setAiTopic(s.name === "" ? "" : s.name);
    setTemplateMenuOpen(false);
    setAiPanelOpen(false);
  };

  const readOnly = editor.sourceScope === "system";
  const isSystemSchema = readOnly;

  // ---------- 章节编辑操作 ----------
  const updateSection = (idx: number, patch: Partial<LearningMaterialSection>) => {
    setEditor((prev) => {
      const next = [...prev.sections];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, sections: next, isDirty: true };
    });
  };

  const addSection = () => {
    setEditor((prev) => {
      const nextSection: LearningMaterialSection = {
        id: uid(),
        title: "",
        instruction: "",
        order: prev.sections.length + 1,
      };
      return {
        ...prev,
        sections: [...prev.sections, nextSection],
        isDirty: true,
      };
    });
  };

  /** 在指定章节下方插入空章节，并自动聚焦其标题输入框 */
  const insertSectionAfter = (idx: number) => {
    const newId = uid();
    setEditor((prev) => {
      const next = [...prev.sections];
      next.splice(idx + 1, 0, {
        id: newId,
        title: "",
        instruction: "",
        order: idx + 2,
      });
      return {
        ...prev,
        sections: next.map((s, i) => ({ ...s, order: i + 1 })),
        isDirty: true,
      };
    });
    setFocusSectionId(newId);
  };

  const addSectionFromTemplate = (tpl: SectionTemplate) => {
    const isZh = i18n.language.startsWith("zh");
    const content = isZh ? tpl.zh : tpl.en;
    setEditor((prev) => {
      // system 只读时，插入模板相当于开始创建草稿
      const startAsDraft = prev.sourceScope === "system";
      return {
        ...prev,
        id: startAsDraft ? null : prev.id,
        scope: startAsDraft ? (graphId ? "graph" : "user") : prev.scope,
        sourceScope: startAsDraft ? (graphId ? "graph" : "user") : prev.sourceScope,
        sections: [
          ...prev.sections,
          {
            id: uid(),
            title: content.title,
            instruction: content.instruction,
            min_words: content.min_words,
            max_words: content.max_words,
            order: prev.sections.length + 1,
          },
        ],
        isDirty: true,
      };
    });
    setTemplateMenuOpen(false);
  };

  const removeSection = (idx: number) => {
    setEditor((prev) => {
      if (prev.sections.length <= 1) {
        message.warning(t("learning.material.schema.emptySections"));
        return prev;
      }
      const next = prev.sections.filter((_, i) => i !== idx);
      return { ...prev, sections: next, isDirty: true };
    });
  };

  const moveSection = (idx: number, delta: -1 | 1) => {
    setEditor((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.sections.length) return prev;
      const next = arrayMove(prev.sections, idx, target).map((s, i) => ({
        ...s,
        order: i + 1,
      }));
      return { ...prev, sections: next, isDirty: true };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditor((prev) => {
      const oldIndex = prev.sections.findIndex((s) => s.id === active.id);
      const newIndex = prev.sections.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      const next = arrayMove(prev.sections, oldIndex, newIndex).map((s, i) => ({
        ...s,
        order: i + 1,
      }));
      return { ...prev, sections: next, isDirty: true };
    });
  };

  // ---------- AI 辅助 ----------
  const handleRunAI = async () => {
    const topic = aiTopic.trim() || editor.name.trim();
    if (!topic) {
      message.warning(t("learning.material.schema.ai.needTopic"));
      return;
    }
    if (aiMode === "optimize" && editor.sections.length === 0) {
      message.warning(t("learning.material.schema.emptySections"));
      return;
    }
    setAiLoading(true);
    try {
      const resp = await api.ai.assistLearningSchema({
        mode: aiMode,
        topic,
        goal: aiGoal.trim() || undefined,
        graph_id: graphId,
        ...(aiMode === "optimize"
          ? {
              existing_sections: editor.sections.map((s) => ({
                title: s.title,
                instruction: s.instruction,
                min_words: s.min_words,
                max_words: s.max_words,
              })),
            }
          : {}),
      });
      // 应用 AI 结果：system 只读时自动转为草稿
      setEditor((prev) => {
        const startAsDraft = prev.sourceScope === "system";
        return {
          ...prev,
          id: startAsDraft ? null : prev.id,
          scope: startAsDraft ? (graphId ? "graph" : "user") : prev.scope,
          sourceScope: startAsDraft
            ? graphId
              ? "graph"
              : "user"
            : prev.sourceScope,
          name:
            prev.name.trim() ||
            (aiMode === "generate" ? topic.slice(0, 100) : prev.name),
          sections: resp.sections.map((s, i) => ({
            id: uid(),
            title: s.title,
            instruction: s.instruction,
            min_words: s.min_words,
            max_words: s.max_words,
            order: i + 1,
          })),
          isDirty: true,
        };
      });
      message.success(t("learning.material.schema.ai.applied"));
      setAiPanelOpen(false);
    } catch (e) {
      console.error(e);
      message.error(t("learning.material.schema.ai.failed"));
    } finally {
      setAiLoading(false);
    }
  };

  // ---------- 保存 / 删除 / 复制 ----------
  const handleSave = async () => {
    if (!editor.name.trim()) {
      message.warning(t("learning.material.schema.duplicateName"));
      return;
    }
    if (editor.sections.length === 0) {
      message.warning(t("learning.material.schema.emptySections"));
      return;
    }
    if (isSystemSchema) {
      message.warning(t("learning.material.schema.cannotEditSystem"));
      return;
    }

    const sections = editor.sections.map((s, i) => ({ ...s, order: i + 1 }));

    try {
      if (editor.id) {
        const updated = await api.learningMaterialSchemas.update(editor.id, {
          name: editor.name,
          description: editor.description,
          sections,
          is_default: editor.is_default,
        });
        message.success(t("learning.material.schema.saved"));
        setEditor((prev) => ({ ...prev, isDirty: false }));
        onSelect?.(updated.id);
      } else {
        const created = await api.learningMaterialSchemas.create({
          name: editor.name,
          description: editor.description,
          scope: editor.scope,
          graph_id: editor.scope === "graph" ? graphId : undefined,
          sections,
          is_default: editor.is_default,
        });
        message.success(t("learning.material.schema.saved"));
        setEditor({
          id: created.id,
          name: created.name,
          description: created.description ?? "",
          scope: created.scope,
          is_default: created.is_default,
          sections: created.sections,
          sourceScope: created.scope,
          isDirty: false,
        });
        onSelect?.(created.id);
      }
      await loadSchemas();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!editor.id) return;
    if (isSystemSchema) {
      message.warning(t("learning.material.schema.cannotDeleteSystem"));
      return;
    }
    const ok = await asyncConfirm({
      title: t("common.confirm.deleteTitle"),
      message: t("learning.material.schema.deleteConfirm"),
      isDangerous: true,
    });
    if (!ok) return;
    try {
      await api.learningMaterialSchemas.delete(editor.id);
      message.success(t("learning.material.schema.deleted"));
      setEditor({
        id: null,
        name: "",
        description: "",
        scope: "user",
        is_default: false,
        sections: createBlankSections(),
        sourceScope: "user",
        isDirty: false,
      });
      await loadSchemas();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = () => {
    setEditor((prev) => ({
      id: null,
      name:
        prev.name.trim() +
        (i18n.language.startsWith("zh") ? "（副本）" : " (Copy)"),
      description: prev.description,
      scope: graphId ? "graph" : "user",
      is_default: false,
      sections: prev.sections.map((s, i) => ({ ...s, id: uid(), order: i + 1 })),
      sourceScope: graphId ? "graph" : "user",
      isDirty: true,
    }));
  };

  // ---------- 预览 ----------
  const outlineMarkdown = useMemo(
    () => buildOutlineMarkdown(editor.sections, i18n.language),
    [editor.sections, i18n.language],
  );
  const promptContent = useMemo(
    () => buildPreviewPrompt(editor.sections, i18n.language),
    [editor.sections, i18n.language],
  );

  if (!open) return null;

  const ScopeBadge: React.FC<{ scope: LearningSchemaScope }> = ({ scope }) => {
    const meta = SCOPE_META[scope];
    const Icon = meta.icon;
    const labelKey = (() => {
      switch (scope) {
        case "system":
          return "learning.material.schema.scopeSystem" as const;
        case "user":
          return "learning.material.schema.scopeUser" as const;
        case "graph":
          return "learning.material.schema.scopeGraph" as const;
      }
    })();
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${meta.color}`}
      >
        <Icon className="w-3 h-3" />
        {t(labelKey)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {t("learning.material.schema.editorTitle")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("learning.material.schema.editorSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAiPanelOpen((p) => !p);
                if (!aiPanelOpen && editor.name) setAiTopic(editor.name);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                aiPanelOpen
                  ? "bg-violet-600 text-white"
                  : "border border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:text-violet-300 dark:hover:bg-violet-900/30"
              }`}
              title={t("learning.material.schema.ai.title")}
            >
              <Sparkles className="w-4 h-4" />
              {t("learning.material.schema.ai.title")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: 左侧方案列表 | 右侧编辑器 */}
        <div className="flex-1 grid grid-cols-12 min-h-0">
          {/* Left: Schema list */}
          <aside className="col-span-4 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("learning.material.schema.title")}
              </div>
              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">
                  {t("learning.loading")}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {schemas.map((s) => {
                    const selected =
                      editor.id === s.id ||
                      (selectedSchemaId === s.id && !editor.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            loadSchemaIntoEditor(s);
                            onSelect?.(s.id);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                            selected
                              ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500/60 ring-2 ring-primary-100 dark:ring-primary-900/30"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {s.name}
                            </span>
                            {s.is_default && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {t("learning.material.schema.defaultBadge")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <ScopeBadge scope={s.scope} />
                            <span className="text-xs text-slate-400">
                              {s.sections.length}{" "}
                              {t("learning.material.schema.sectionCount")}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Right: Editor */}
          <section className="col-span-8 flex flex-col min-h-0">
            {/* AI 辅助面板 */}
            {aiPanelOpen && (
              <div className="px-6 py-4 border-b border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-800 dark:text-violet-200">
                    <Wand2 className="w-4 h-4" />
                    {t("learning.material.schema.ai.title")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiPanelOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Close AI panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* mode 切换 */}
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "generate", key: "learning.material.schema.ai.generate" },
                      { value: "optimize", key: "learning.material.schema.ai.optimize" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setAiMode(m.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors ${
                        aiMode === m.value
                          ? "border-violet-400 bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      {t(m.key)}
                      <div className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                        {t(
                          m.value === "generate"
                            ? "learning.material.schema.ai.generateDesc"
                            : "learning.material.schema.ai.optimizeDesc",
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t("learning.material.schema.ai.topic")}
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder={t("learning.material.schema.ai.topicPlaceholder")}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t("learning.material.schema.ai.goal")}
                  </label>
                  <textarea
                    value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)}
                    rows={2}
                    placeholder={t("learning.material.schema.ai.goalPlaceholder")}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    {t("learning.material.schema.ai.hint")}
                  </span>
                  <button
                    type="button"
                    onClick={handleRunAI}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 text-sm font-medium transition-colors"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {aiLoading
                      ? t("learning.material.schema.ai.running")
                      : t("learning.material.schema.ai.run")}
                  </button>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t("learning.material.schema.schemaName")}
                    </label>
                    <input
                      type="text"
                      value={editor.name}
                      onChange={(e) =>
                        setEditor((prev) => ({
                          ...prev,
                          name: e.target.value,
                          isDirty: true,
                        }))
                      }
                      disabled={readOnly}
                      placeholder={t("learning.material.schema.schemaName")}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t("learning.material.schema.schemaScope")}
                    </label>
                    <select
                      value={editor.scope}
                      disabled={readOnly || !!editor.id}
                      onChange={(e) =>
                        setEditor((prev) => ({
                          ...prev,
                          scope: e.target.value as LearningSchemaScope,
                          isDirty: true,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                    >
                      <option value="user">
                        {t("learning.material.schema.scopeUser")}
                      </option>
                      {graphId && (
                        <option value="graph">
                          {t("learning.material.schema.scopeGraph")}
                        </option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editor.is_default}
                      disabled={readOnly}
                      onChange={(e) =>
                        setEditor((prev) => ({
                          ...prev,
                          is_default: e.target.checked,
                          isDirty: true,
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400 disabled:opacity-60"
                    />
                    {editor.is_default ? (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <StarOff className="w-4 h-4 text-slate-400" />
                    )}
                    {t("learning.material.schema.setAsDefault")}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {t("learning.material.schema.schemaDescription")}
                </label>
                <input
                  type="text"
                  value={editor.description}
                  onChange={(e) =>
                    setEditor((prev) => ({
                      ...prev,
                      description: e.target.value,
                      isDirty: true,
                    }))
                  }
                  disabled={readOnly}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                />
              </div>
              {readOnly && (
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-md px-3 py-2 flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {t("learning.material.schema.cannotEditSystem")} —{" "}
                    {t("learning.material.schema.systemHint")}
                  </span>
                </div>
              )}
            </div>

            {/* Sections list（拖拽排序） */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={editor.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {editor.sections.map((sec, idx) => (
                    <SortableSectionCard
                      key={sec.id}
                      sec={sec}
                      idx={idx}
                      total={editor.sections.length}
                      readOnly={readOnly}
                      disabled={aiLoading}
                      onFieldChange={updateSection}
                      onMove={moveSection}
                      onRemove={removeSection}
                      onInsertAfter={insertSectionAfter}
                      labelTitle={t("learning.material.schema.sectionTitle")}
                      labelInstruction={t(
                        "learning.material.schema.sectionInstruction",
                      )}
                      labelMin={t("learning.material.schema.sectionMinWords")}
                      labelMax={t("learning.material.schema.sectionMaxWords")}
                      labelUp={t("learning.material.schema.moveUp")}
                      labelDown={t("learning.material.schema.moveDown")}
                      labelRemove={t("learning.material.schema.removeSection")}
                      labelDrag={t("learning.material.schema.dragHandle")}
                      labelInsert={t("learning.material.schema.insertBelow")}
                      autoFocusTitle={sec.id === focusSectionId}
                      onTitleFocused={() => setFocusSectionId(null)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* 添加章节 + 模板库 */}
              <div className="relative grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={addSection}
                  disabled={readOnly}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {t("learning.material.schema.addSection")}
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen((p) => !p)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  {t("learning.material.schema.templateMenu")}
                </button>

                {templateMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Close template menu"
                      onClick={() => setTemplateMenuOpen(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-2 z-20 w-full max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-2 space-y-1">
                      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                        {t("learning.material.schema.templateTitle")}
                      </div>
                      {SECTION_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.key}
                          type="button"
                          onClick={() => addSectionFromTemplate(tpl)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {t(tpl.nameKey)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {i18n.language.startsWith("zh") ? tpl.zh.title : tpl.en.title}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {i18n.language.startsWith("zh")
                              ? tpl.zh.instruction
                              : tpl.en.instruction}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 预览 */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview((p) => !p)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPreview ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    {showPreview
                      ? t("learning.material.schema.hidePreview")
                      : t("learning.material.schema.previewTitle")}
                  </button>
                  {showPreview && (
                    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                      {(
                        [
                          { value: "outline", key: "learning.material.schema.previewOutline", Icon: FileText },
                          { value: "prompt", key: "learning.material.schema.previewPromptTab", Icon: ListOrdered },
                        ] as const
                      ).map(({ value, key, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreviewTab(value)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                            previewTab === value
                              ? "bg-primary-600 text-white"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t(key)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {showPreview &&
                  (previewTab === "outline" ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {outlineMarkdown}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs whitespace-pre-wrap border border-slate-700">
                      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                        {t("learning.material.schema.previewHint")}
                      </div>
                      {promptContent}
                    </div>
                  ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ScopeBadge scope={editor.sourceScope} />
            {editor.isDirty && (
              <span className="text-amber-600 dark:text-amber-400">
                {t("learning.material.schema.unsaved")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSystemSchema ? (
              <button
                type="button"
                onClick={handleDuplicate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-violet-300 text-violet-700 dark:border-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
                {t("learning.material.schema.duplicate")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!editor.id}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-rose-300 text-rose-700 dark:border-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t("learning.material.schema.delete")}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={readOnly || !editor.isDirty}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 text-sm font-medium shadow-sm shadow-primary-500/20 transition-colors"
            >
              <Save className="w-4 h-4" />
              {t("learning.material.schema.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningChapterSchemaEditor;
