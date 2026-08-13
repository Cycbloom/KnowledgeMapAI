// =====================================================
// Mobile AI Prompt 降级安全网（DEFAULT_PROMPTS / OUTPUT_SCHEMAS）
// -----------------------------------------------------
// DB（prompt_templates 表）是 prompt 的唯一权威来源，所有 prompt 必须通过
// supabase/migrations/53_seed_prompt_templates.sql 写入 DB。
// 本文件的 DEFAULT_PROMPTS 和 OUTPUT_SCHEMAS 仅作 DB 不可用时的降级安全网
// （如离线场景），不应被视为主要 prompt 来源。
// 新增 prompt 请优先写入 DB seed，而非本文件。
// =====================================================
export const GENERATE_CARDS_SCHEMA = `
Return a JSON object with a 'cards' array. Each card object must have: 
- 'type' (qa|choice|true_false|multi_choice|fill_in_the_blank|essay)
- 'question'
- 'answer'
- 'explanation' (Detailed analysis/reasoning)
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)

Please respond in Chinese.`;

export const DEFAULT_PROMPTS: Record<string, string> = {
  learning_material: `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

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
};
