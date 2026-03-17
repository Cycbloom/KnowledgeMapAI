import { FileText, BrainCircuit, BookOpen, GraduationCap } from 'lucide-react';

export interface PromptScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  variables: string[];
  defaultTemplate: string;
  category: 'creation' | 'generation' | 'analysis';
  supportsThreeTier?: boolean;
}

export const PROMPT_SCENARIOS: PromptScenario[] = [
  {
    id: 'learning_material',
    name: '学习资料生成',
    description: '生成学习教材时的提示词模板',
    icon: <GraduationCap size={20} />,
    variables: ['topic', 'context', 'level'],
    defaultTemplate: `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

Target Audience: University students or professionals learning this concept.

Structure:
1. **Introduction (Hook)**: Briefly explain what this is and why it matters.
2. **Core Concepts (Deep Dive)**: Explain the theoretical foundations. Use analogies.
3. **Key Mechanisms/Details**: Technical details, 'how it works', or step-by-step logic.
4. **Real-world Examples**: Concrete use cases or historical context.
5. **Summary**: Key takeaways.

Formatting:
- Use Markdown headers (##, ###).
- Use bolding for key terms.
- **IMPORTANT**: Wrap ALL mathematical formulas in LaTeX: $inline$ or $$block$$.
- Use lists and bullet points for readability.
- Length: Comprehensive (approx 800-1500 words).

Topic: {{topic}}
Context/Background: {{context}}
{{#if level}}Knowledge Level: {{level}}{{/if}}`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'graph_creation',
    name: '图谱创建',
    description: '创建新知识图谱时的AI生成提示词',
    icon: <BookOpen size={20} />,
    variables: ['graphTitle', 'description', 'relatedGraph', 'relationType'],
    defaultTemplate: `请根据以下信息创建知识图谱：

图谱标题：{{graphTitle}}
描述：{{description}}
{{#if relatedGraph}}
关联图谱：{{relatedGraph}}
关系类型：{{relationType}}
{{/if}}

请生成该知识图谱的初始知识点结构，包括：
1. 核心概念（3-5个）
2. 每个概念的简要说明
3. 概念之间的关系

要求：
- 内容准确、专业
- 结构清晰、层次分明
- 适合学习者理解`,
    category: 'creation',
  },
  {
    id: 'quiz_generation',
    name: '测验生成',
    description: 'AI生成测验题目时的提示词',
    icon: <BrainCircuit size={20} />,
    variables: [
      'quizTitle',
      'knowledgePoints',
      'difficulty',
      'questionTypes',
      'cardsPerType',
    ],
    defaultTemplate: `请根据以下知识点生成测验题目：

测验标题：{{quizTitle}}
知识点：{{knowledgePoints}}
难度：{{difficulty}}
题型配置：{{questionTypes}}
每类题目数量：{{cardsPerType}}

请按照以下要求生成题目：
1. 题目内容准确，符合知识点
2. 难度适中，符合设定的难度级别
3. 题目表述清晰，无歧义
4. 选择题选项具有迷惑性但不刁钻
5. 问答题答案完整、准确

注意：
- 确保题目覆盖所有选定的知识点
- 避免重复或相似的题目
- 题目应具有实际应用价值`,
    category: 'generation',
  },
  {
    id: 'content_expansion',
    name: '内容扩充',
    description: '扩充知识点内容时的提示词',
    icon: <FileText size={20} />,
    variables: ['nodeTitle', 'nodeContent', 'parentContext', 'childContext'],
    defaultTemplate: `请扩充以下知识点的内容：

标题：{{nodeTitle}}
当前内容：{{nodeContent}}
{{#if parentContext}}
上级知识点：{{parentContext}}
{{/if}}
{{#if childContext}}
下级知识点：{{childContext}}
{{/if}}

请从以下方面扩充内容：
1. 概念定义的完善
2. 核心要点的提炼
3. 实际应用案例
4. 常见误区说明
5. 学习建议

要求：
- 内容专业、准确
- 语言简洁明了
- 适合学习者理解`,
    category: 'generation',
  },
];

export const getScenarioById = (id: string): PromptScenario | undefined => {
  return PROMPT_SCENARIOS.find((s) => s.id === id);
};

export const getScenariosByCategory = (
  category: PromptScenario['category']
): PromptScenario[] => {
  return PROMPT_SCENARIOS.filter((s) => s.category === category);
};
