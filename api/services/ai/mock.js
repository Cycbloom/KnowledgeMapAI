export const getMockResponse = (type, input) => {
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
export const getMockCards = (topic, types, count) => {
    const allCards = [
        { type: 'qa', question: `什么是 ${topic}?`, answer: `${topic} 的定义是...`, explanation: '这是详细解析...' },
        { type: 'choice', question: `${topic} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类', explanation: '解析：因为...' },
        { type: 'true_false', question: `${topic} 是一个重要的概念吗?`, answer: 'True', explanation: '解析：是的...' },
        { type: 'multi_choice', question: `${topic} 的特点有哪些?`, options: ['特点A', '特点B', '特点C', '特点D'], answer: '["特点A", "特点B"]', explanation: '解析：AB是正确的...' },
        { type: 'fill_in_the_blank', question: `${topic} 是在 ___ 年被提出的。`, answer: '2024', explanation: '解析：根据文献...' },
        { type: 'essay', question: `请详细阐述 ${topic} 的原理及其应用。`, answer: '原理是... 应用于...', explanation: '解析：得分点包括...' }
    ];
    return allCards.filter(c => types.includes(c.type)).slice(0, count);
};
export const getMockBranchSuggestions = (nodeTitle) => [
    {
        id: 'mock_1',
        title: `分支 1: ${nodeTitle} 的延伸`,
        description: '这是一个模拟的分支建议',
        priority: 'high',
        estimatedDifficulty: 3,
        relatedTopics: []
    },
    {
        id: 'mock_2',
        title: `分支 2: ${nodeTitle} 的应用`,
        description: '这是另一个模拟的分支建议',
        priority: 'medium',
        estimatedDifficulty: 4,
        relatedTopics: []
    },
    {
        id: 'mock_3',
        title: `分支 3: ${nodeTitle} 的原理`,
        description: '这是第三个模拟的分支建议',
        priority: 'low',
        estimatedDifficulty: 2,
        relatedTopics: []
    }
];
export const getMockConcepts = () => [
    { title: '概念 1', description: '这是从对话中提取的概念 1', priority: 'high' },
    { title: '概念 2', description: '这是从对话中提取的概念 2', priority: 'medium' }
];
export const getMockNextTopics = (nodeTitle) => [
    {
        title: `建议主题 1: ${nodeTitle} 的应用`,
        description: '探索实际应用场景',
        priority: 'high',
        estimatedDifficulty: 3
    },
    {
        title: `建议主题 2: ${nodeTitle} 的原理`,
        description: '深入理解核心原理',
        priority: 'medium',
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
//# sourceMappingURL=mock.js.map