// KnowledgeMap × DSH Harness — Phase 8: 语义 RAG（km_ask）
// Host half. 检索四域知识（cards/graphs/tasks）→ 组装上下文 → 调 llm.stream 合成答案。
// Storage: 读取 <session cwd>/.deepseek-harness/knowledgemap/{cards,graphs,tasks,progress}.json
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const llm = ctx.get('llm')
    const agentDefaultModel = ctx.get('agentDefaultModel')
    if (fs === undefined || sandboxPolicy === undefined) return

    // ---------- 持久化 ----------
    const BASE = '.deepseek-harness/knowledgemap'
    const FILES = { cards: 'cards.json', graphs: 'graphs.json', tasks: 'tasks.json' }
    function sessionRoot(exec) {
      try {
        const cwd = exec && exec.agent && exec.agent.session && exec.agent.session.header ? exec.agent.session.header.cwd : undefined
        if (cwd && typeof cwd === 'string') return cwd
      } catch (e) { /* ignore */ }
      return sandboxPolicy.workspaceRoot
    }
    async function readStore(exec, key) {
      const rel = BASE + '/' + FILES[key]
      const target = await fs.resolve(rel, { cwd: sessionRoot(exec) })
      const info = await fs.stat(target)
      if (!info) return {}
      try {
        const parsed = JSON.parse(await fs.readText(target))
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) { /* fall through */ }
      return {}
    }
    async function readAll(exec) {
      const cards = await readStore(exec, 'cards')
      const graphs = await readStore(exec, 'graphs')
      const tasks = await readStore(exec, 'tasks')
      const notes = await readStore(exec, 'notes')
      return { cards: cards.cards || [], graphs: graphs.graphs || [], nodes: graphs.nodes || [], tasks: tasks.tasks || [], notes: notes.notes || [] }
    }
    function renderText(args, value) {
      return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
    }
    function guard(fn) {
      return async (args, exec) => {
        try {
          return await fn(args, exec)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { ok: false, error: msg, stack: e instanceof Error ? (e.stack || '').split('\n').slice(0, 6).join('\n') : undefined }
        }
      }
    }
    function score(text, q) {
      if (!text) return 0
      return String(text).toLowerCase().includes(q) ? 1 : 0
    }
    // 分词匹配：RAG 检索需要。英文按空白/标点切词；中文按相邻二字 bigram 切，
    // 任一命中即算匹配（中文无空格，整句单 token 会漏检）
    function tokenize(q) {
      const s = String(q || '').toLowerCase()
      const tokens = new Set()
      // ASCII 词（≥2 字母/数字）
      const words = s.split(/[\s，。？！、,.;:：'"“”‘’()（）[\]【】\-_/\\+×=]+/).filter((t) => /[a-z0-9]/.test(t) && t.length >= 2)
      for (const w of words) tokens.add(w)
      // 中文 bigram：连续 CJK 字符的相邻对
      const cjk = s.match(/[\u4e00-\u9fff]+/g) || []
      for (const chunk of cjk) {
        if (chunk.length <= 2) tokens.add(chunk)
        for (let i = 0; i < chunk.length - 1; i++) tokens.add(chunk.slice(i, i + 2))
      }
      return [...tokens]
    }
    function anyTokenHit(text, tokens) {
      if (!text) return false
      const t = String(text).toLowerCase()
      return tokens.some((tok) => t.includes(tok))
    }
    function extractWikiLinks(content) {
      const out = []
      const re = /\[\[([^\[\]]+)\]\]/g
      let m
      while ((m = re.exec(content || '')) !== null) {
        const title = m[1].trim().split('|')[0].split('#')[0].trim()
        if (title) out.push(title)
      }
      return out
    }
    async function retrieveContext(exec, query, limit) {
      const data = await readAll(exec)
      const tokens = tokenize(query)
      if (tokens.length === 0) tokens.push(String(query || '').toLowerCase())
      const cap = Math.min(limit || 6, 12)
      const parts = []
      for (const c of data.cards) {
        if (anyTokenHit(c.front, tokens) || anyTokenHit(c.back, tokens)) {
          parts.push(`[闪卡·${c.deck || 'general'}] Q: ${c.front}\n  A: ${c.back}`)
        }
      }
      const graphTitles = {}
      for (const g of data.graphs) graphTitles[g.id] = g.title
      for (const n of data.nodes) {
        if (anyTokenHit(n.title, tokens) || anyTokenHit(n.content, tokens) || (n.tags || []).some((t) => anyTokenHit(t, tokens))) {
          parts.push(`[图谱节点·${graphTitles[n.graph_id] || ''}] ${n.title}\n  ${n.content || ''}`)
        }
      }
      for (const t of data.tasks) {
        if (anyTokenHit(t.title, tokens) || anyTokenHit(t.description, tokens)) {
          parts.push(`[任务] ${t.title}\n  ${t.description || ''}（${t.status || 'pending'}）`)
        }
      }
      for (const n of data.notes) {
        if (anyTokenHit(n.title, tokens) || anyTokenHit(n.content, tokens) || (n.tags || []).some((t) => anyTokenHit(t, tokens))) {
          const links = extractWikiLinks(n.content)
          parts.push(`[笔记·${n.type || 'note'}] ${n.title}\n  ${(n.content || '').slice(0, 300)}${links.length ? '\n  wiki: ' + links.join(' / ') : ''}`)
        }
      }
      return parts.slice(0, cap)
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_ask',
      description: '基于 KnowledgeMap 知识库的语义问答（RAG）：检索闪卡/图谱节点/任务/笔记中的相关内容，调用 LLM 合成带依据的答案。',
      parameters: {
        question: { type: 'string', description: '要问的问题', required: true },
        top_k: { type: 'integer', description: '检索上下文条数（默认 6，最大 12）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        // 1. 检索
        const context = await retrieveContext(exec, args.question, args.top_k)
        if (context.length === 0) {
          return { ok: true, answer: '知识库中暂无与问题相关的条目。可先用 km_card_add / km_graph_node_add / km_note_add 沉淀知识，或换一种问法。', sources: [], used_llm: false }
        }
        // 2. 组装提示词
        const prompt =
          '你是 KnowledgeMap 知识库助手。请仅依据下面检索到的知识条目回答问题；若条目不足以回答，请明确说明。\n\n' +
          '【知识条目】\n' + context.map((c, i) => `${i + 1}. ${c}`).join('\n\n') +
          '\n\n【问题】\n' + args.question

        // 3. 若无 llm 服务或无法取到当前模型，返回检索结果供上层作答
        if (llm === undefined || agentDefaultModel === undefined) {
          return { ok: true, answer: '（llm 服务不可用）以下为检索到的相关条目，请据此回答。', sources: context, used_llm: false }
        }
        let selection
        try { selection = agentDefaultModel.currentSelection() } catch (e) { selection = undefined }
        if (!selection || !selection.provider || !selection.model) {
          return { ok: true, answer: '（未取到当前模型路由）以下为检索到的相关条目，请据此回答。', sources: context, used_llm: false }
        }
        // 4. 调 llm.stream 合成
        const message = {
          id: 'km-ask-' + Date.now(),
          role: 'user',
          content: [{ type: 'text', text: prompt }],
          source: { kind: 'user' },
        }
        let answer = ''
        let error = null
        try {
          for await (const chunk of llm.stream({
            provider: selection.provider,
            model: selection.model,
            messages: [message],
            maxTokens: 1024,
          })) {
            if (chunk && chunk.type === 'text-delta') answer += chunk.text
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e)
        }
        if (error) {
          return { ok: false, error: 'llm 调用失败: ' + error, sources: context }
        }
        return { ok: true, answer: answer.trim(), sources: context, used_llm: true, model: selection.model }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_ask_sources',
      description: '查看 km_ask 将检索到的知识来源（不带 LLM 调用，纯检索预览）。',
      parameters: {
        question: { type: 'string', description: '检索问题', required: true },
        top_k: { type: 'integer', description: '条数上限（默认 6，最大 12）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const context = await retrieveContext(exec, args.question, args.top_k)
        return { ok: true, total: context.length, sources: context }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
