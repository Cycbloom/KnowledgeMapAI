// KnowledgeMap × DSH Harness — Phase 4: 成就/经验系统 + /km 命令入口
// Host half. 对齐 shared/types/scheduler-achievement.ts（Achievement/UserAchievement）。
// XP 曲线对齐 api/services/achievements/achievementEngine.ts：nextLevelThreshold = level * 500。
// Storage: <session cwd>/.deepseek-harness/knowledgemap/progress.json via fs service.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    // ---------- 成就定义（对齐 scheduler-achievement.ts 字段） ----------
    const ACHIEVEMENTS = [
      { code: 'first_review', name: '初识复习', description: '完成第一次闪卡复习', category: 'study', icon: '📇', xp_reward: 20, target: 1, counter: 'reviews' },
      { code: 'review_100', name: '百炼成钢', description: '累计复习 100 张闪卡', category: 'study', icon: '🔥', xp_reward: 200, target: 100, counter: 'reviews' },
      { code: 'review_1000', name: '千锤百炼', description: '累计复习 1000 张闪卡', category: 'study', icon: '🏆', xp_reward: 1000, target: 1000, counter: 'reviews' },
      { code: 'focus_25', name: '初见专注', description: '累计专注 25 分钟', category: 'focus', icon: '⏱️', xp_reward: 30, target: 25, counter: 'focus_min' },
      { code: 'focus_500', name: '深度专注', description: '累计专注 500 分钟', category: 'focus', icon: '🧘', xp_reward: 300, target: 500, counter: 'focus_min' },
      { code: 'task_5', name: '五任务达成', description: '完成 5 个任务', category: 'tasks', icon: '✅', xp_reward: 50, target: 5, counter: 'tasks_done' },
      { code: 'task_50', name: '任务大师', description: '完成 50 个任务', category: 'tasks', icon: '🎯', xp_reward: 400, target: 50, counter: 'tasks_done' },
      { code: 'streak_3', name: '三天打鱼', description: '连续 3 天有学习活动', category: 'streak', icon: '📅', xp_reward: 60, target: 3, counter: 'streak' },
      { code: 'streak_30', name: '持之以恒', description: '连续 30 天有学习活动', category: 'streak', icon: '🗓️', xp_reward: 600, target: 30, counter: 'streak' },
      { code: 'graph_1', name: '图谱初建', description: '创建第一个知识图谱', category: 'creation', icon: '🗺️', xp_reward: 30, target: 1, counter: 'graphs' },
      { code: 'node_20', name: '节点构筑者', description: '累计创建 20 个知识节点', category: 'creation', icon: '🧩', xp_reward: 150, target: 20, counter: 'nodes' },
      { code: 'all_rounder', name: '全能选手', description: '四类活动各至少完成 1 次', category: 'special', icon: '🌈', xp_reward: 100, target: 1, counter: 'all_rounder' },
    ]

    // ---------- 持久化 ----------
    const REL = '.deepseek-harness/knowledgemap/progress.json'
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
      let store = {
        version: 1, xp: 0, level: 1, streak: 0, last_active_date: null, best_streak: 0,
        counters: { reviews: 0, focus_min: 0, tasks_done: 0, graphs: 0, nodes: 0 },
        unlocked: {}, // code -> unlocked_at ISO
      }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && typeof parsed.xp === 'number') {
            store = Object.assign(store, parsed)
            store.counters = Object.assign(store.counters, parsed.counters || {})
            store.unlocked = parsed.unlocked || {}
          }
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

    // ---------- 核心逻辑 ----------
    // 对齐 achievementEngine：nextLevelThreshold = level * 500，升级时扣减
    function applyXp(store, xp) {
      store.xp += xp
      let leveledUp = false
      let threshold = store.level * 500
      while (store.xp >= threshold) {
        store.xp -= threshold
        store.level += 1
        leveledUp = true
        threshold = store.level * 500
      }
      return leveledUp
    }
    // 更新连击：按自然日
    function updateStreak(store, now) {
      const today = now.toISOString().slice(0, 10)
      if (store.last_active_date !== today) {
        const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
        store.streak = store.last_active_date === yesterday ? (store.streak || 0) + 1 : 1
        store.last_active_date = today
        if (store.streak > (store.best_streak || 0)) store.best_streak = store.streak
      }
    }
    function checkAchievements(store, now) {
      const newlyUnlocked = []
      for (const ach of ACHIEVEMENTS) {
        if (store.unlocked[ach.code]) continue
        let current = 0
        if (ach.counter === 'all_rounder') {
          const c = store.counters
          current = (c.reviews > 0 && c.focus_min > 0 && c.tasks_done > 0 && (c.graphs > 0 || c.nodes > 0)) ? 1 : 0
        } else {
          current = store.counters[ach.counter] || 0
        }
        if (current >= ach.target) {
          store.unlocked[ach.code] = now.toISOString()
          applyXp(store, ach.xp_reward)
          newlyUnlocked.push({ code: ach.code, name: ach.name, description: ach.description, category: ach.category, icon: ach.icon, xp_reward: ach.xp_reward, unlocked_at: now.toISOString() })
        }
      }
      return newlyUnlocked
    }
    function achievementProgress(store) {
      return ACHIEVEMENTS.map((ach) => {
        const current = ach.counter === 'all_rounder'
          ? (store.counters.reviews > 0 && store.counters.focus_min > 0 && store.counters.tasks_done > 0 && (store.counters.graphs > 0 || store.counters.nodes > 0) ? 1 : 0)
          : (store.counters[ach.counter] || 0)
        return {
          code: ach.code, name: ach.name, description: ach.description, category: ach.category, icon: ach.icon,
          xp_reward: ach.xp_reward, target: ach.target, current: Math.min(current, ach.target),
          unlocked: !!store.unlocked[ach.code], unlocked_at: store.unlocked[ach.code] || null,
          percentage: Math.min(100, Math.round((current / ach.target) * 100)),
        }
      })
    }
    function progressView(store) {
      const threshold = store.level * 500
      return {
        xp: store.xp, level: store.level,
        next_level_at: threshold, xp_into_level: store.xp,
        streak: store.streak, best_streak: store.best_streak || 0, last_active_date: store.last_active_date,
        counters: store.counters,
        achievements_unlocked: Object.keys(store.unlocked).length,
        achievements_total: ACHIEVEMENTS.length,
      }
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_progress_get',
      description: 'KnowledgeMap 进度总览：经验值、等级（下一级阈值 = 等级×500）、连击、成就解锁情况与各成就进度。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        return { ok: true, progress: progressView(store), achievements: achievementProgress(store), store_path: await storeDisplayPath(exec) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_progress_earn',
      description: '记录一次活动并结算经验/连击/成就。activity: review=复习卡(n张) focus=专注(n分钟) task=完成n个任务 graph=创建n个图谱 node=创建n个节点。返回新增经验、升级与解锁的成就。',
      parameters: {
        activity: { type: 'string', enum: ['review', 'focus', 'task', 'graph', 'node', 'login'], description: '活动类型', required: true },
        amount: { type: 'number', description: '数量：review=张数 focus=分钟 task=任务数 graph=图谱数 node=节点数（默认 1）' },
        note: { type: 'string', description: '备注（可选）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const amount = Math.max(0, Math.floor(args.amount || 1))
        // XP 单价（与 KnowledgeMap 每日任务奖励对齐：review 5/张、focus 2/分钟、task 10/个、graph 30/个、node 30/个、login 20）
        const XP = { review: 5, focus: 2, task: 10, graph: 30, node: 30, login: 20 }
        const counters = store.counters
        if (args.activity === 'review') counters.reviews += amount
        else if (args.activity === 'focus') counters.focus_min += amount
        else if (args.activity === 'task') counters.tasks_done += amount
        else if (args.activity === 'graph') counters.graphs += amount
        else if (args.activity === 'node') counters.nodes += amount
        // login 不累计 counter（只触发活动日/连击）
        const now = new Date()
        updateStreak(store, now)
        const gained = XP[args.activity] * (args.activity === 'login' ? 1 : amount)
        const leveledUp = applyXp(store, gained)
        const newlyUnlocked = checkAchievements(store, now)
        await saveStore(exec, store)
        return {
          ok: true,
          activity: args.activity, amount, xp_gained: gained,
          leveled_up: leveledUp, level: store.level,
          newly_unlocked: newlyUnlocked,
          progress: progressView(store),
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_achievement_list',
      description: '列出全部成就与解锁进度（按类别分组：study/focus/tasks/streak/creation/special）。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const all = achievementProgress(store)
        const groups = {}
        for (const a of all) {
          groups[a.category] = groups[a.category] || []
          groups[a.category].push(a)
        }
        return { ok: true, total: all.length, unlocked: all.filter((a) => a.unlocked).length, groups }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }

    // ---------- /km 命令入口 ----------
    const commands = ctx.get('commands')
    if (commands !== undefined) {
      ctx.effect(() => commands.register({
        name: 'km',
        description: 'KnowledgeMap 进度总览（经验/等级/连击/成就）',
        async handler(invocation) {
          try {
            const store = await loadStore(invocation)
            const v = progressView(store)
            const threshold = v.next_level_at
            return {
              kind: 'success',
              text: `KnowledgeMap · Lv.${v.level}（${v.xp}/${threshold} XP）· 连击 ${v.streak} 天 · 成就 ${v.achievements_unlocked}/${v.achievements_total}\n` +
                `复习 ${v.counters.reviews} · 专注 ${v.counters.focus_min}min · 任务 ${v.counters.tasks_done} · 图谱 ${v.counters.graphs} · 节点 ${v.counters.nodes}`,
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            return { kind: 'error', text: `km 命令失败: ${msg}` }
          }
        },
      }))
    }
  },
}
