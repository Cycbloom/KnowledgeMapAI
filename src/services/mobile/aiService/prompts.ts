export interface Keyword {
  term: string;
  importance: number;
  category: string;
  explanation: string;
}

export interface GenerateLearningMaterialResult {
  content: string;
  keywords: Keyword[];
}

export const TYPE_PROMPTS: Record<string, string> = {
  qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
  choice:
    "For 'choice' type: Create multiple-choice questions with 4 plausible options. Mark the correct answer index.",
  true_false:
    "For 'true_false' type: Create statements focusing on common misconceptions.",
  multi_choice:
    "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct. Return correct_indices array.",
  fill_in_the_blank:
    "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks.",
};

export const DIFFICULTY_PROMPTS: Record<string, string> = {
  easy: `Difficulty Level: EASY
- Focus on basic concept recognition and memory recall
- Questions should directly test knowledge point definitions and basic facts
- Use straightforward language without complex scenarios`,
  medium: `Difficulty Level: MEDIUM
- Focus on understanding and application of concepts
- Questions should require comprehension, not just memorization
- Include simple scenarios or examples to test understanding`,
  hard: `Difficulty Level: HARD
- Focus on analysis, synthesis, and complex problem-solving
- Questions should require deep understanding and connecting multiple concepts
- Include complex scenarios, edge cases, or require multi-step reasoning`,
};

export const getLearningMaterialSystemPrompt = (language?: string): string => {
  const isEnglish = language === "en-US" || language === "en";

  if (isEnglish) {
    return `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

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

You must respond with a JSON object containing:
1. 'content': The learning material in Markdown format (as a string)
2. 'keywords': An array of 5-15 keywords extracted from the content

Each keyword object must have:
- 'term': The keyword text (string)
- 'importance': Importance level 1-5 (number, where 5 is most important)
- 'category': Category type - one of: 'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology' (string)
- 'explanation': Brief explanation of the keyword (string, max 50 chars)

IMPORTANT: All keyword fields (term, category, explanation) must be in English.

Please respond in English.`;
  }

  return `你是一位杰出的教材作者和教育家。请为给定的主题编写一个全面、结构化的学习模块。

目标受众：大学生或正在学习这一概念的专业人士。

结构要求：
1. **引言（吸引点）**：简要解释这是什么以及为什么重要。
2. **核心概念（深入探讨）**：解释理论基础。使用类比。
3. **关键机制/细节**：技术细节、"如何工作"或逐步逻辑。
4. **现实世界示例**：具体用例或历史背景。
5. **总结**：关键要点。

格式要求：
- 使用 Markdown 标题（##, ###）。
- 对关键术语使用粗体。
- **重要**：将所有数学公式用 LaTeX 包裹：$行内$ 或 $$块级$$。
- 使用列表和项目符号提高可读性。
- 长度：全面（约 800-1500 字）。

你必须返回一个 JSON 对象，包含：
1. 'content'：Markdown 格式的学习内容（字符串）
2. 'keywords'：从内容中提取的 5-15 个关键词数组

每个关键词对象必须包含：
- 'term'：关键词文本（字符串）
- 'importance'：重要性级别 1-5（数字，5 最重要）
- 'category'：类别类型 - 以下之一：'定义', '概念', '方法', '结论', '原理', '应用', '术语'（字符串）
- 'explanation'：关键词的简要解释（字符串，最多 50 字符）

IMPORTANT: All keyword fields (term, category, explanation) must be in Chinese.

请用中文回答。`;
};
