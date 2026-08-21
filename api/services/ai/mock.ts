export const getMockResponse = (type: string, input: string): string | object => {
  switch (type) {
    case 'content':
      return `## ${input}\n\n这是一个关于 **${input}** 的详细解释。\n\n### 核心概念\n\n1. **定义**: ${input} 是一个重要的概念...\n2. **特点**: 具有以下特点...\n3. **应用**: 在实际中应用于...\n\n### 总结\n\n${input} 是理解该领域的基础。`;
    
    case 'chat':
      return `我理解你想了解关于 "${input}" 的内容。这是一个模拟回复，因为后端没有配置 API Key。`;
    
    case 'expand':
      return {
        suggestions: [
          { title: `${input} 的基础概念`, content: `${input}的基础概念和定义，包括其核心特征和基本原理。` },
          { title: `${input} 的应用场景`, content: `${input}在实际中的应用场景和实践案例。` },
          { title: `${input} 的相关技术`, content: `与${input}相关的技术和扩展知识。` }
        ]
      };
    
    default:
      return `Mock response for: ${input}`;
  }
};

export const getMockCards = (topic: string, types: string[], count: number) => {
  const allCards = [
    { type: 'qa', question: `什么是 ${topic}?`, answer: `${topic} 的定义是...`, explanation: '这是详细解析...', focus_topic: `${topic}·定义与概念` },
    { type: 'choice', question: `${topic} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类', explanation: '解析：因为...', focus_topic: `${topic}·分类归属` },
    { type: 'true_false', question: `${topic} 是一个重要的概念吗?`, answer: 'True', explanation: '解析：是的...', focus_topic: `${topic}·重要性判断` },
    { type: 'multi_choice', question: `${topic} 的特点有哪些?`, options: ['特点A', '特点B', '特点C', '特点D'], answer: '["特点A", "特点B"]', explanation: '解析：AB是正确的...', focus_topic: `${topic}·核心特点` },
    { type: 'fill_in_the_blank', question: `${topic} 是在 ___ 年被提出的。`, answer: '2024', explanation: '解析：根据文献...', focus_topic: `${topic}·提出时间` },
    { type: 'essay', question: `请详细阐述 ${topic} 的原理及其应用。`, answer: '原理是... 应用于...', explanation: '解析：得分点包括...', focus_topic: `${topic}·原理与应用` },
    { type: 'cloze', question: `${topic} 的三大特征是 ___、___ 和 ___。`, answer: '[{"blank":"特征A"},{"blank":"特征B"},{"blank":"特征C"}]', explanation: '解析：三特征为特征A、特征B、特征C...', focus_topic: `${topic}·核心特征` },
    { type: 'select_from_options', question: `${topic} 最核心的要素是 ___。`, options: ['要素A', '要素B', '要素C', '要素D'], answer: '要素A', explanation: '解析：核心要素为要素A...', focus_topic: `${topic}·核心要素` },
    { type: 'matching', question: `将 ${topic} 的相关术语与其定义匹配。`, options: ['术语A', '术语B', '术语C', '术语D'], answer: '[{"left":"术语A","right":"定义A"},{"left":"术语B","right":"定义B"},{"left":"术语C","right":"定义C"},{"left":"术语D","right":"定义D"}]', explanation: '解析：术语A对定义A...', focus_topic: `${topic}·术语定义` },
    { type: 'ordering', question: `请将 ${topic} 的流程步骤按正确顺序排列。`, options: ['步骤1', '步骤2', '步骤3', '步骤4'], answer: '["步骤1","步骤2","步骤3","步骤4"]', explanation: '解析：正确顺序为步骤1→2→3→4...', focus_topic: `${topic}·流程顺序` }
  ];
  
  return allCards.filter(c => types.includes(c.type)).slice(0, count);
};

export const getMockBranchSuggestions = (nodeTitle: string) => [
  { 
    id: 'mock_1', 
    title: `分支 1: ${nodeTitle} 的延伸`, 
    description: '这是一个模拟的分支建议', 
    priority: 'high' as const, 
    estimatedDifficulty: 3, 
    relatedTopics: [] 
  },
  { 
    id: 'mock_2', 
    title: `分支 2: ${nodeTitle} 的应用`, 
    description: '这是另一个模拟的分支建议', 
    priority: 'medium' as const, 
    estimatedDifficulty: 4, 
    relatedTopics: [] 
  },
  { 
    id: 'mock_3', 
    title: `分支 3: ${nodeTitle} 的原理`, 
    description: '这是第三个模拟的分支建议', 
    priority: 'low' as const, 
    estimatedDifficulty: 2, 
    relatedTopics: [] 
  }
];

export const getMockConcepts = () => [
  { title: '概念 1', description: '这是从对话中提取的概念 1', priority: 'high' as const },
  { title: '概念 2', description: '这是从对话中提取的概念 2', priority: 'medium' as const }
];

export const getMockNextTopics = (nodeTitle: string) => [
  { 
    title: `建议主题 1: ${nodeTitle} 的应用`, 
    description: '探索实际应用场景', 
    priority: 'high' as const, 
    estimatedDifficulty: 3 
  },
  { 
    title: `建议主题 2: ${nodeTitle} 的原理`, 
    description: '深入理解核心原理', 
    priority: 'medium' as const, 
    estimatedDifficulty: 4 
  }
];

export const getMockImageGraph = () => ({
  nodes: [
    { id: 'mock_img_1', title: '识别的主题', content: '这是从图片识别的内容', level: 'root' },
    { id: 'mock_img_2', title: '视觉元素 A', content: '图片中的元素 A', level: 'core' }
  ],
  edges: [
    { source: 'mock_img_1', target: 'mock_img_2', relationship: 'contains' }
  ]
});
