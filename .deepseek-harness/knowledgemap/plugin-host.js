// KnowledgeMap × DSH Harness — Phase 1: FSRS 间隔重复闪卡工具集 (v7, final)
// Host half. Faithful port of ts-fsrs 5.4.1 (FSRS-6, 21 params, default config).
// Storage: <session cwd>/.deepseek-harness/knowledgemap/cards.json via fs service,
// with session-resolved sandboxPolicy so writes are allowed.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    // ---------- FSRS-6 faithful port (ts-fsrs 5.4.1 defaults) ----------
    const STATE_NAMES = ['new', 'learning', 'review', 'relearning']
    const RATING_NAMES = { again: 1, hard: 2, good: 3, easy: 4 }
    const default_w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 1e-3, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
    const S_MIN = 1e-3
    const S_MAX = 36500
    const REQUEST_RETENTION = 0.9
    const MAX_INTERVAL = 36500
    const LEARNING_STEPS = ['1m', '10m']
    const RELEARNING_STEPS = ['10m']
    const ENABLE_SHORT_TERM = true

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
    const roundTo = (n, d) => { const f = 10 ** d; return Math.round(n * f) / f }

    function computeDecayFactor(w) {
      const decay = -w[20]
      const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1
      return { decay, factor: roundTo(factor, 8) }
    }
    function forgettingCurve(w, t, s) {
      const { decay, factor } = computeDecayFactor(w)
      return roundTo(Math.pow(1 + (factor * t) / s, decay), 8)
    }
    function intervalModifier(w, rr) {
      const { decay, factor } = computeDecayFactor(w)
      return roundTo((Math.pow(rr, 1 / decay) - 1) / factor, 8)
    }
    function nextInterval(s) {
      return Math.min(Math.max(1, Math.round(s * intervalModifier(default_w, REQUEST_RETENTION))), MAX_INTERVAL)
    }
    function initStability(g) { return Math.max(default_w[g - 1], 0.1) }
    function initDifficulty(g) { return roundTo(default_w[4] - Math.exp((g - 1) * default_w[5]) + 1, 8) }
    function nextDifficulty(d, g) {
      const w = default_w
      const deltaD = -w[6] * (g - 3)
      const nextD = d + (deltaD * (10 - d)) / 9
      const init = initDifficulty(4)
      return clamp(roundTo(w[7] * init + (1 - w[7]) * nextD, 8), 1, 10)
    }
    function nextRecallStability(d, s, r, g) {
      const w = default_w
      const hardPenalty = g === 2 ? w[15] : 1
      const easyBound = g === 4 ? w[16] : 1
      return roundTo(clamp(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBound), S_MIN, 36500), 8)
    }
    function nextForgetStability(d, s, r) {
      const w = default_w
      return roundTo(clamp(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), S_MIN, 36500), 8)
    }
    function nextShortTermStability(s, g) {
      const w = default_w
      const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]))
      const masked = g >= 2 ? Math.max(sinc, 1) : sinc
      return roundTo(clamp(s * masked, S_MIN, 36500), 8)
    }
    function nextState(memory, t, g, r) {
      const w = default_w
      const d = memory ? memory.difficulty : 0
      const s = memory ? memory.stability : 0
      if (d === 0 && s === 0) {
        return { difficulty: clamp(initDifficulty(g), 1, 10), stability: initStability(g) }
      }
      if (g === 0) return { difficulty: d, stability: s }
      r = typeof r === 'number' ? r : forgettingCurve(w, t, s)
      let newS
      if (t === 0 && ENABLE_SHORT_TERM) {
        newS = nextShortTermStability(s, g)
      } else if (g === 1) {
        const sAfterFail = nextForgetStability(d, s, r)
        const [w17, w18] = ENABLE_SHORT_TERM ? [w[17], w[18]] : [0, 0]
        const nextSMin = s / Math.exp(w17 * w18)
        newS = clamp(roundTo(nextSMin, 8), S_MIN, sAfterFail)
      } else {
        newS = nextRecallStability(d, s, r, g)
      }
      return { difficulty: nextDifficulty(d, g), stability: newS }
    }
    function dateDiffInDays(last, cur) {
      const utc1 = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())
      const utc2 = Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate())
      return Math.floor((utc2 - utc1) / 864e5)
    }
    function stepToMinutes(step) {
      const unit = step.slice(-1)
      const value = parseInt(step.slice(0, -1), 10)
      if (unit === 'm') return value
      if (unit === 'h') return value * 60
      if (unit === 'd') return value * 1440
      return 0
    }
    function learningStepsStrategy(state, curStep) {
      const steps = state === 3 || state === 2 ? RELEARNING_STEPS : LEARNING_STEPS
      const len = steps.length
      if (len === 0 || curStep >= len) return {}
      const first = steps[0]
      const result = {}
      if (state === 2) {
        result[1] = { scheduled_minutes: stepToMinutes(steps[Math.max(0, curStep)]), next_step: 0 }
        return result
      }
      result[1] = { scheduled_minutes: stepToMinutes(first), next_step: 0 }
      result[2] = { scheduled_minutes: len === 1 ? Math.round(stepToMinutes(first) * 1.5) : Math.round((stepToMinutes(first) + stepToMinutes(steps[1])) / 2), next_step: curStep }
      const nextInfo = steps[curStep + 1]
      if (nextInfo) {
        const nextMin = stepToMinutes(nextInfo)
        if (nextMin) result[3] = { scheduled_minutes: Math.round(nextMin), next_step: curStep + 1 }
      }
      return result
    }
    function applyLearningSteps(card, grade, toState, curState, curSteps, elapsedDays, nowMs) {
      const strategy = learningStepsStrategy(curState, curSteps)
      const info = strategy[grade]
      const scheduledMinutes = info ? Math.max(0, info.scheduled_minutes || 0) : 0
      const nextSteps = info ? Math.max(0, info.next_step || 0) : 0
      if (scheduledMinutes > 0 && scheduledMinutes < 1440) {
        card.learning_steps = nextSteps
        card.scheduled_days = 0
        card.state = toState
        card.due = nowMs + Math.round(scheduledMinutes) * 60000
      } else if (scheduledMinutes >= 1440) {
        card.state = 2
        card.learning_steps = nextSteps
        card.due = nowMs + Math.round(scheduledMinutes) * 60000
        card.scheduled_days = Math.floor(scheduledMinutes / 1440)
      } else {
        card.state = 2
        card.learning_steps = 0
        const interval = nextInterval(card.stability)
        card.scheduled_days = interval
        card.due = nowMs + interval * 86400000
      }
      return card
    }
    function schedule(card, nowMs, grade) {
      const now = new Date(nowMs)
      const state = card.state
      const elapsedDays = state !== 0 && card.last_review ? dateDiffInDays(new Date(card.last_review), now) : 0
      const cur = Object.assign({}, card, { last_review: nowMs, elapsed_days: elapsedDays, reps: (card.reps || 0) + 1 })
      let next
      if (state === 0) {
        const ns = nextState(null, 0, grade)
        next = Object.assign({}, cur, { difficulty: ns.difficulty, stability: ns.stability })
        applyLearningSteps(next, grade, 1, cur.state, cur.learning_steps || 0, elapsedDays, nowMs)
      } else if (state === 1 || state === 3) {
        const ns = nextState({ difficulty: cur.difficulty, stability: cur.stability }, elapsedDays, grade)
        next = Object.assign({}, cur, { difficulty: ns.difficulty, stability: ns.stability })
        applyLearningSteps(next, grade, cur.state, cur.state, cur.learning_steps || 0, elapsedDays, nowMs)
      } else {
        const interval = elapsedDays
        const r = forgettingCurve(default_w, interval, cur.stability)
        const all = {}
        for (const g of [1, 2, 3, 4]) {
          const ns = nextState({ difficulty: cur.difficulty, stability: cur.stability }, interval, g, r)
          all[g] = Object.assign({}, cur, { difficulty: ns.difficulty, stability: ns.stability })
        }
        let hardIvl = nextInterval(all[2].stability)
        let goodIvl = nextInterval(all[3].stability)
        hardIvl = Math.min(hardIvl, goodIvl)
        goodIvl = Math.max(goodIvl, hardIvl + 1)
        const easyIvl = Math.max(nextInterval(all[4].stability), goodIvl + 1)
        all[2].scheduled_days = hardIvl; all[2].due = nowMs + hardIvl * 86400000
        all[3].scheduled_days = goodIvl; all[3].due = nowMs + goodIvl * 86400000
        all[4].scheduled_days = easyIvl; all[4].due = nowMs + easyIvl * 86400000
        all[2].state = 2; all[2].learning_steps = 0
        all[3].state = 2; all[3].learning_steps = 0
        all[4].state = 2; all[4].learning_steps = 0
        all[1].state = 3; all[1].learning_steps = 0
        if (grade === 1) {
          next = all[1]
          applyLearningSteps(next, 1, 3, 2, 0, elapsedDays, nowMs)
          next.lapses = (cur.lapses || 0) + 1
        } else {
          next = all[grade]
        }
      }
      return next
    }

    // ---------- persistence: session-scoped policy so writes are allowed ----------
    const REL = '.deepseek-harness/knowledgemap/cards.json'
    function sessionRoot(exec) {
      try {
        const cwd = exec && exec.agent && exec.agent.session && exec.agent.session.header ? exec.agent.session.header.cwd : undefined
        if (cwd && typeof cwd === 'string') return cwd
      } catch (e) { /* ignore */ }
      return sandboxPolicy.workspaceRoot
    }
    function writePolicy(exec) {
      try {
        if (exec && exec.agent && exec.agent.session) {
          return sandboxPolicy.resolve({ session: exec.agent.session })
        }
      } catch (e) { /* ignore */ }
      return sandboxPolicy.resolve()
    }
    async function resolveStore(exec) {
      return fs.resolve(REL, { cwd: sessionRoot(exec) })
    }
    async function loadStore(exec) {
      const target = await resolveStore(exec)
      const info = await fs.stat(target)
      let store = { version: 1, cards: [] }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && Array.isArray(parsed.cards)) store = parsed
        } catch (e) { /* fall through */ }
      }
      return store
    }
    async function saveStore(exec, store) {
      const target = await resolveStore(exec)
      const policy = writePolicy(exec)
      await fs.writeText(target, JSON.stringify(store, null, 2), undefined, undefined, policy)
    }
    async function storeDisplayPath(exec) {
      const target = await resolveStore(exec)
      return fs.processPath(target)
    }
    function uid() {
      return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    }
    function cardView(card, includeBack) {
      const view = {
        id: card.id, deck: card.deck, front: card.front, tags: card.tags || [],
        card_type: card.card_type || 'qa', state: STATE_NAMES[card.state] || 'new',
        stability: Number(card.stability.toFixed ? card.stability.toFixed(2) : card.stability),
        difficulty: Number(card.difficulty.toFixed ? card.difficulty.toFixed(2) : card.difficulty),
        interval_days: card.scheduled_days, reps: card.reps || 0, lapses: card.lapses || 0,
        due: card.due, due_iso: new Date(card.due).toISOString(),
      }
      if (includeBack) view.back = card.back
      return view
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

    const tools = []

    tools.push(harness.defineTool({
      name: 'km_card_add',
      description: '添加一张 KnowledgeMap 闪卡（FSRS 间隔重复）。用于把对话中的知识点沉淀为可复习的卡片。返回创建的卡片。',
      parameters: {
        front: { type: 'string', description: '卡片正面：问题/知识点', required: true },
        back: { type: 'string', description: '卡片背面：答案/要点', required: true },
        deck: { type: 'string', description: '牌组名称（默认 general）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表，如 ["fsrs","算法"]' },
        card_type: { type: 'string', enum: ['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay'], description: '卡片类型（默认 qa）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const now = Date.now()
        const card = {
          id: uid(), deck: args.deck || 'general',
          front: args.front, back: args.back,
          tags: args.tags || [], card_type: args.card_type || 'qa',
          state: 0, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
          reps: 0, lapses: 0, learning_steps: 0, due: now, last_review: null,
          created_at: now, history: [],
        }
        store.cards.push(card)
        await saveStore(exec, store)
        return { ok: true, card: cardView(card, true), total: store.cards.length, store_path: await storeDisplayPath(exec) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_card_list',
      description: '列出 KnowledgeMap 闪卡。可按牌组/状态/标签筛选。返回卡片摘要列表。',
      parameters: {
        deck: { type: 'string', description: '按牌组筛选' },
        state: { type: 'string', enum: ['new', 'learning', 'review', 'relearning'], description: '按状态筛选' },
        tag: { type: 'string', description: '按标签筛选（任意匹配）' },
        limit: { type: 'integer', description: '返回条数上限（默认 50，最大 200）' },
        include_back: { type: 'boolean', description: '是否包含答案（默认 false）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let cards = store.cards
        if (args.deck) cards = cards.filter((c) => c.deck === args.deck)
        if (args.state) cards = cards.filter((c) => (STATE_NAMES[c.state] || 'new') === args.state)
        if (args.tag) cards = cards.filter((c) => (c.tags || []).includes(args.tag))
        const limit = Math.min(args.limit || 50, 200)
        const sliced = cards.slice(0, limit)
        return { ok: true, total: cards.length, returned: sliced.length, cards: sliced.map((c) => cardView(c, !!args.include_back)) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_review_queue',
      description: '获取当前到期的复习队列（新卡 + 到期卡片），按到期时间升序。返回每张卡与到期信息，供复习。',
      parameters: {
        deck: { type: 'string', description: '按牌组筛选' },
        limit: { type: 'integer', description: '返回条数上限（默认 10，最大 50）' },
        include_back: { type: 'boolean', description: '是否提前包含答案（默认 false，建议复习时先不显示答案）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const now = Date.now()
        let due = store.cards.filter((c) => {
          if (args.deck && c.deck !== args.deck) return false
          if (c.state === 0) return true
          return c.due <= now
        })
        due = due.sort((a, b) => (a.due || 0) - (b.due || 0))
        const limit = Math.min(args.limit || 10, 50)
        const sliced = due.slice(0, limit)
        const overdue = store.cards.filter((c) => c.state !== 0 && c.due <= now).length
        const fresh = store.cards.filter((c) => c.state === 0).length
        return {
          ok: true, queue_total: due.length, overdue, fresh,
          returned: sliced.length,
          cards: sliced.map((c) => cardView(c, !!args.include_back)),
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_review_rate',
      description: '对一张闪卡评分并执行 FSRS-6 调度，更新下次复习时间。rating: again=忘记/hard=困难/good=良好/easy=轻松。返回更新后的卡片与调度信息。',
      parameters: {
        card_id: { type: 'string', description: '卡片 id', required: true },
        rating: { type: 'string', enum: ['again', 'hard', 'good', 'easy'], description: '评分', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const idx = store.cards.findIndex((c) => c.id === args.card_id)
        if (idx < 0) return { ok: false, error: 'card not found: ' + args.card_id }
        const grade = RATING_NAMES[args.rating]
        if (!grade) return { ok: false, error: 'invalid rating' }
        const now = Date.now()
        const card = store.cards[idx]
        const next = schedule(card, now, grade)
        next.history = (card.history || []).concat([{ rating: args.rating, grade, at: now, interval_days: next.scheduled_days }]).slice(-200)
        store.cards[idx] = next
        await saveStore(exec, store)
        return {
          ok: true,
          card: cardView(next, true),
          scheduling: {
            rating: args.rating, state: STATE_NAMES[next.state] || 'new',
            stability: next.stability, difficulty: next.difficulty,
            interval_days: next.scheduled_days, due_iso: new Date(next.due).toISOString(),
          },
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_review_stats',
      description: 'KnowledgeMap 复习统计：各状态卡片数、今天到期、逾期、牌组分布、平均稳定度/难度。',
      parameters: {
        deck: { type: 'string', description: '只看某个牌组' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let cards = store.cards
        if (args.deck) cards = cards.filter((c) => c.deck === args.deck)
        const now = Date.now()
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = startOfDay.getTime() + 86400000
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 }
        for (const c of cards) byState[STATE_NAMES[c.state] || 'new']++
        const dueToday = cards.filter((c) => c.state !== 0 && c.due >= startOfDay.getTime() && c.due < endOfDay).length
        const overdue = cards.filter((c) => c.state !== 0 && c.due < now).length
        const decks = {}
        for (const c of cards) decks[c.deck || 'general'] = (decks[c.deck || 'general'] || 0) + 1
        const reviewed = cards.filter((c) => (c.reps || 0) > 0)
        const avgStability = reviewed.length ? reviewed.reduce((s, c) => s + (c.stability || 0), 0) / reviewed.length : 0
        const avgDifficulty = reviewed.length ? reviewed.reduce((s, c) => s + (c.difficulty || 0), 0) / reviewed.length : 0
        return {
          ok: true, total: cards.length, by_state: byState, due_today: dueToday, overdue,
          decks, avg_stability: Number(avgStability.toFixed(2)), avg_difficulty: Number(avgDifficulty.toFixed(2)),
          store_path: await storeDisplayPath(exec),
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
