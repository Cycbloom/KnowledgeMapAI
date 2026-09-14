/**
 * 代码级注入文本的统一注册表。
 * 这些文本此前散落在各 service（cardGeneration/chat/rag）内，集中于此以便统一维护
 * （未来可迁移为多语言或 DB 模板变量，而无需改动业务调用方）。
 */

// ---------------- 卡片生成 ----------------

export const FOCUS_TOPIC_INSTRUCTION = `FOCUS TOPIC INSTRUCTION: Every card MUST include a "focus_topic" field: a short string (≤30 Chinese characters) that describes the specific fine-grained knowledge point being tested. It MUST NOT be the same as the overall node/topic name. Examples: "损失函数·交叉熵" (not "监督学习"), "变量提升·var机制" (not "JavaScript基础"), "useEffect依赖数组" (not "React Hooks"). Be specific and granular.`;

export const GROUNDING_INSTRUCTION = `GROUNDING: Every card MUST include an "evidence" field: the shortest verbatim phrase or sentence from the provided source material that directly supports / contains the answer. If the answer is not grounded in the source, revise the question or answer until it is. Never fabricate facts not present in the source.`;

export const DIFFICULTY_SELF_ASSESSMENT_INSTRUCTION = `For EVERY card you generate, YOU MUST include a "difficulty" field with one of "easy" | "medium" | "hard", self-assessed against this anchored rubric:
- easy  = Bloom Remembering/Understanding (verbatim recall or direct restatement from the material)
- medium = Bloom Applying/Analyzing (combines 2-3 facts, short concrete scenario)
- hard  = Bloom Evaluating/Creating (multi-step connection, edge case, or novel application)
Assign the difficulty that the card's question ACTUALLY requires to answer — do not force all cards to the same level. The "difficulty" you return is what will be stored, so calibrate it honestly. Provide exactly one of "easy" | "medium" | "hard"; never use other values.`;

export function buildTypeRestriction(types: string[]): string {
  return types.length === 1
    ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
    : `Allowed card types: ${types.join(", ")}. Only generate these types.`;
}

export const TYPE_PROMPTS: Record<string, string> = {
  qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
  choice:
    "For 'choice' type: Create multiple-choice questions with 4 plausible options.",
  true_false:
    "For 'true_false' type: Create statements focusing on common misconceptions.",
  multi_choice:
    "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct.",
  fill_in_the_blank:
    "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks. The 'answer' MUST be a plain string; for multiple blanks, separate the answers with commas (one per blank, in order). Return valid JSON.",
  essay:
    "For 'essay' type: Create complex questions requiring a long-form structured answer.",
  cloze:
    "For 'cloze' type: Create a sentence with one or more '___' blanks. The 'answer' MUST be a JSON array like [{\"blank\":\"correct word\"},...], one entry per blank in order. Return valid JSON.",
  select_from_options:
    "For 'select_from_options' type: Create a sentence with exactly one '___' blank and 4 candidate words in 'options'. The 'answer' MUST be the correct word string. Return valid JSON.",
  matching:
    "For 'matching' type: Create a two-column matching question. Put left items in 'options'. The 'answer' MUST be a JSON array like [{\"left\":\"A\",\"right\":\"matching definition\"},...] pairing every left item to its correct right item. Return valid JSON.",
  ordering:
    "For 'ordering' type: Create a sequence question. Put shuffled items in 'options'. The 'answer' MUST be a JSON array of items in correct order. Return valid JSON.",
};

export const DIFFICULTY_PROMPTS: Record<string, string> = {
  easy: `Difficulty Level: EASY (Bloom Level 1-2: Remembering / Understanding)
Use the source material as the only required knowledge — do NOT import outside facts.
Anchor criteria (a question is EASY if ANY apply):
- Remembering: asks to recall a definition, name, term, list, or a directly-stated fact verbatim from the material.
- Understanding: asks to identify the correct meaning, paraphrase a concept, or pick the statement that correctly restates a sentence in the material.
Question design:
- Draw the answer almost verbatim from a single sentence in the source.
- Use short, plain language; avoid scenario setups longer than one sentence.
- For choice: distractors must be clearly wrong (wrong term, wrong definition, mis-ordered facts), so the correct answer stands out to a careful recall.
- For QA/fill-blank: answers should be a term or one short sentence taken directly from the text.
Do NOT reuse the same sentence for every question in a batch.`,
  medium: `Difficulty Level: MEDIUM (Bloom Level 3-4: Applying / Analyzing)
Use the source material as the context; answers may require combining 2-3 facts from different parts of the material.
Anchor criteria (a question is MEDIUM if ANY apply):
- Applying: needs using a concept or formula in a slightly novel but concrete example provided in the material.
- Analyzing: asks to explain cause→effect, compare/contrast two ideas, order steps, or identify why a statement about the material is true/false.
Question design:
- Combine information from at least 2 related sentences/sections.
- Introduce a short concrete scenario (1-3 sentences) that is NOT a verbatim restatement.
- For choice: distractors should be plausible but break one concept; correct answer requires real understanding to pick.
- For QA/fill-blank: answers need 1-2 sentences that synthesize across parts of the material.`,
  hard: `Difficulty Level: HARD (Bloom Level 5-6: Evaluating / Creating)
Use the source material as the base, but demand higher-order reasoning and multi-step connections.
Anchor criteria (a question is HARD if ANY apply):
- Evaluating: asks to judge/critique a claim, weigh trade-offs, or assess which approach is correct given constraints in the material.
- Creating: asks to design, propose, hypothesize, or apply the material to a novel/unseen case or edge case.
Question design:
- Require connecting 3+ ideas across the material, or reasoning about an edge case / boundary condition.
- Present a realistic complex scenario with implicit distractors (all options plausible at first glance).
- For choice: all options should look correct; only careful multi-step analysis distinguishes the best answer.
- For QA/essay: require a structured, multi-part answer (define, reason, example) demonstrating synthesis.`,
  mixed: `Difficulty Level: MIXED (Bloom Level 1-6, spanning a full cognitive range)
Generate questions whose difficulty varies across easy / medium / hard.
- Roughly distribute: easy (remember/understand) ~1/3, medium (apply/analyze) ~1/3, hard (evaluate/create) ~1/3, unless a count target is given.
- Do not label them all the same difficulty; intentionally span the taxonomy.
- Anchor each card's difficulty using the rubrics above and ONLY assign the difficulty you actually hit.`,
};

// ---------------- 对话 ----------------

export const WEB_SEARCH_SYSTEM_HINT =
  "\n\n【能力提示】你可以调用工具 web_search 联网搜索，获取实时、最新或超出你知识范围的信息。" +
  "当用户提问涉及最新新闻、时效数据、实时资讯，或你无法确定答案时，请优先调用 web_search 后再作答。";

// ---------------- RAG ----------------

export const GRAPH_CONTEXT_HINT =
  '重要提示：以下知识上下文中包含通过图谱关系发现的关联节点（标记为"图谱关联"）。这些节点之间存在图谱关系路径，请利用这些关系进行推理和解释，帮助用户理解知识之间的深层联系。';
