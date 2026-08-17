// KnowledgeMap × DSH Harness — UI 改造 v2：产品级 Slot 融合
// Host: harness.handle 提供六域聚合数据（km-ui-overview / km-ui-queue）。
// Client: 注册三个产品级 Slot：
//   - conversation.composer.dock      常驻环境状态带（复习待办/图谱/任务/等级·连击），点击展开复习队列
//   - conversation.input.right        输入栏 🧠 按钮（展开/收起队列）
//   - conversation.session.header.utilities  会话头部工具按钮（打开总览浮层）
//   - shell.overlay                   可拖拽六域总览面板
// Usage: 传 code.host + code.client 给 cordis_define，然后 cordis_run。

// ============================ HOST ============================
const HOST = function () {
  return {
    apply(ctx) {
      const fs = ctx.get('fs')
      const sandboxPolicy = ctx.get('sandboxPolicy')
      if (fs === undefined || sandboxPolicy === undefined) return

      const BASE = '.deepseek-harness/knowledgemap'
      const FILES = { cards: 'cards.json', graphs: 'graphs.json', tasks: 'tasks.json', progress: 'progress.json', paths: 'paths.json', notes: 'notes.json' }

      function resolveRoot(args) {
        try {
          const sid = args && args.sessionId
          if (sid) {
            const sessions = ctx.get('sessions')
            const session = sessions ? sessions.get(sid) : undefined
            const cwd = session && session.header ? session.header.cwd : undefined
            if (cwd && typeof cwd === 'string') return cwd
          }
        } catch (e) { /* ignore */ }
        return sandboxPolicy.workspaceRoot
      }
      async function readStore(root, key) {
        const rel = BASE + '/' + FILES[key]
        const target = await fs.resolve(rel, { cwd: root })
        const info = await fs.stat(target)
        if (!info) return {}
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && typeof parsed === 'object') return parsed
        } catch (e) { /* fall through */ }
        return {}
      }
      async function readAll(args) {
        const root = resolveRoot(args)
        const cards = await readStore(root, 'cards')
        const graphs = await readStore(root, 'graphs')
        const tasks = await readStore(root, 'tasks')
        const progress = await readStore(root, 'progress')
        const paths = await readStore(root, 'paths')
        const notes = await readStore(root, 'notes')
        return {
          root,
          cards: cards.cards || [], graphs: graphs.graphs || [], nodes: graphs.nodes || [], edges: graphs.edges || [],
          tasks: tasks.tasks || [], paths: paths.paths || [], notes: notes.notes || [], noteLinks: notes.links || [],
          progress: progress.xp !== undefined ? progress : null,
        }
      }
      function buildOverview(d) {
        const now = Date.now()
        const dueNow = d.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now)).length
        const activeTasks = d.tasks.filter((t) => ['pending', 'in_progress', 'paused'].includes(t.status)).length
        const activePaths = d.paths.filter((p) => p.status === 'active').length
        const p = d.progress
        return {
          study: { total: d.cards.length, due_now: dueNow },
          graphs: { total: d.graphs.length, nodes: d.nodes.length, edges: d.edges.length },
          tasks: { total: d.tasks.length, active: activeTasks },
          paths: { total: d.paths.length, active: activePaths },
          notes: { total: d.notes.length, wiki_mounts: d.noteLinks.length },
          progress: p ? { level: p.level, xp: p.xp, streak: p.streak, achievements: Object.keys(p.unlocked || {}).length } : null,
          updated_at: new Date().toISOString(),
        }
      }
      function buildQueue(d, limit) {
        const now = Date.now()
        const due = d.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now))
          .sort((a, b) => (a.due || 0) - (b.due || 0))
          .slice(0, limit || 5)
          .map((c) => ({ id: c.id, deck: c.deck, front: c.front, state: ['new', 'learning', 'review', 'relearning'][c.state] || 'new', due: c.due }))
        return { queue: due, total: d.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now)).length }
      }

      ctx.effect(() => harness.handle('km-ui-overview', async (args) => buildOverview(await readAll(args || {}))))
      ctx.effect(() => harness.handle('km-ui-queue', async (args) => buildQueue(await readAll(args || {}), (args || {}).limit)))
    },
  }
}

// ============================ CLIENT ============================
const CLIENT = function () {
  return {
    apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      // 模块级共享状态：队列展开 + 总览浮层开关（跨 Slot 组件同步）
      const state = { queueOpen: false, overviewOpen: false, listeners: [] }
      function setState(patch) {
        Object.assign(state, patch)
        for (const l of state.listeners) { try { l() } catch (e) { /* ignore */ } }
      }
      function subscribe(fn) {
        state.listeners.push(fn)
        return () => { const i = state.listeners.indexOf(fn); if (i >= 0) state.listeners.splice(i, 1) }
      }

      const CSS = `
.km-dock { display:flex; align-items:center; gap:10px; padding:2px 4px; font-size:11.5px; color:var(--text-2,#9ca3af); cursor:pointer; user-select:none; }
.km-dock:hover { color:inherit; }
.km-dock .km-dot { color:var(--text-2,#9ca3af); }
.km-dock .km-strong { font-weight:600; color:var(--text-1,#e5e7eb); }
.km-btn { display:inline-flex; align-items:center; gap:4px; height:24px; border:1px solid rgba(127,127,127,.35); background:transparent; color:inherit; border-radius:999px; padding:0 9px; font-size:12px; line-height:1; cursor:pointer; opacity:.8; white-space:nowrap; }
.km-btn:hover { opacity:1; background:rgba(127,127,127,.12); }
.km-queue { display:flex; flex-direction:column; gap:4px; padding:4px 8px; border-top:1px solid rgba(127,127,127,.15); font-size:12px; }
.km-queue .km-qitem { display:flex; gap:8px; align-items:baseline; }
.km-queue .km-qfront { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.km-queue .km-qtag { font-size:10.5px; color:var(--text-2,#9ca3af); flex:none; }
.km-overlay { position:fixed; right:16px; bottom:72px; z-index:9999; width:340px; max-height:70vh; overflow:auto;
  background:var(--bg-1,#1f2937); border:1px solid rgba(127,127,127,.35); border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.35); padding:12px; }
.km-overlay h4 { margin:0 0 8px; font-size:13px; }
.km-overlay .km-row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; }
.km-overlay .km-row .km-v { font-weight:600; }
.km-overlay .km-close { float:right; border:1px solid rgba(127,127,127,.3); background:transparent; color:inherit; border-radius:6px; cursor:pointer; font-size:11px; padding:1px 7px; }
.km-empty { font-size:12px; color:var(--text-2,#9ca3af); padding:4px 0; }
`

      // 数据 hooks
      function useOverview(sessionId) {
        const [data, setData] = React.useState(null)
        const [tick, setTick] = React.useState(0)
        React.useEffect(() => {
          let alive = true
          const load = () => host.call('km-ui-overview', sessionId ? { sessionId } : {}).then((v) => { if (alive) setData(v) }).catch(() => {})
          load()
          return () => { alive = false }
        }, [sessionId, tick])
        return data
      }
      function useQueue(sessionId, limit) {
        const [data, setData] = React.useState(null)
        const [tick, setTick] = React.useState(0)
        React.useEffect(() => {
          let alive = true
          host.call('km-ui-queue', Object.assign({ limit: limit || 5 }, sessionId ? { sessionId } : {})).then((v) => { if (alive) setData(v) }).catch(() => {})
          return () => { alive = false }
        }, [sessionId, limit, tick])
        return data
      }

      // 1) composer dock：常驻环境状态带 + 点击展开复习队列
      function Dock(props) {
        const sessionId = props && props.sessionId
        const overview = useOverview(sessionId)
        const queue = useQueue(sessionId, 5)
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick((x) => x + 1)), [])
        const p = overview && overview.progress
        const label = !overview
          ? '🧠 加载中…'
          : '🧠 复习 ' + (overview.study ? overview.study.due_now : 0) +
            ' · 图 ' + (overview.graphs ? overview.graphs.nodes : 0) +
            ' · 任务 ' + (overview.tasks ? overview.tasks.active : 0) +
            (p ? ' · Lv.' + p.level + (p.streak ? ' 🔥' + p.streak : '') : '')
        return React.createElement('div', null,
          React.createElement('div', { className: 'km-dock', title: '点击展开/收起复习队列', onClick: () => setState({ queueOpen: !state.queueOpen }) },
            React.createElement('span', null, label),
          ),
          state.queueOpen
            ? React.createElement('div', { className: 'km-queue' },
                (queue && queue.queue && queue.queue.length > 0)
                  ? queue.queue.map((c) => React.createElement('div', { key: c.id, className: 'km-qitem' },
                      React.createElement('span', { className: 'km-qfront' }, c.front),
                      React.createElement('span', { className: 'km-qtag' }, '[' + c.deck + '·' + c.state + ']'),
                    ))
                  : React.createElement('div', { className: 'km-empty' }, '暂无到期复习'),
              )
            : null,
        )
      }

      // 2) input.right：🧠 按钮（展开/收起队列）
      function KmButton(props) {
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick((x) => x + 1)), [])
        const open = state.queueOpen
        return React.createElement('button', {
          type: 'button', className: 'km-btn', title: open ? '收起 KnowledgeMap 复习队列' : '展开 KnowledgeMap 复习队列',
          onClick: () => setState({ queueOpen: !open }),
        }, '🧠')
      }

      // 3) header utilities：总览按钮
      function HeaderButton(props) {
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick((x) => x + 1)), [])
        const open = state.overviewOpen
        return React.createElement('button', {
          type: 'button', className: 'km-btn', title: 'KnowledgeMap 六域总览',
          onClick: () => setState({ overviewOpen: !open }),
        }, '📊')
      }

      // 4) shell.overlay：六域总览面板
      function Overview(props) {
        const sessionId = props && props.sessionId
        const overview = useOverview(sessionId)
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick((x) => x + 1)), [])
        if (!state.overviewOpen) return null
        if (!overview) return React.createElement('div', { className: 'km-overlay' }, React.createElement('span', { className: 'km-close', onClick: () => setState({ overviewOpen: false }) }, '✕'), '加载中…')
        const s = overview.study || {}; const g = overview.graphs || {}; const t = overview.tasks || {}
        const pa = overview.paths || {}; const n = overview.notes || {}; const p = overview.progress
        const Row = (k, v) => React.createElement('div', { className: 'km-row' }, React.createElement('span', null, k), React.createElement('span', { className: 'km-v' }, String(v)))
        return React.createElement('div', { className: 'km-overlay' },
          React.createElement('span', { className: 'km-close', onClick: () => setState({ overviewOpen: false }) }, '✕'),
          React.createElement('h4', null, '🧠 KnowledgeMap 总览'),
          Row('复习待办', s.due_now || 0),
          Row('闪卡总数', s.total || 0),
          Row('图谱 / 节点 / 边', (g.total || 0) + ' / ' + (g.nodes || 0) + ' / ' + (g.edges || 0)),
          Row('活跃任务', t.active || 0),
          Row('学习路径（进行中）', pa.active || 0),
          Row('笔记 / wiki 挂载', (n.total || 0) + ' / ' + (n.wiki_mounts || 0)),
          p ? Row('等级 · 经验 · 连击', 'Lv.' + p.level + ' · ' + p.xp + ' XP' + (p.streak ? ' · 🔥' + p.streak : '')) : null,
          p ? Row('成就', p.achievements + ' 个') : null,
        )
      }

      slots.inject('conversation.composer.dock', () => slots.register(
        { name: 'conversation.composer.dock', id: 'km-dock', order: 10, label: 'KnowledgeMap 状态带' },
        (props) => React.createElement(Dock, { sessionId: props && props.sessionId }),
      ))
      slots.inject('conversation.input.right', () => slots.register(
        { name: 'conversation.input.right', id: 'km-btn', order: 90, label: 'KnowledgeMap 队列' },
        (props) => React.createElement(KmButton, null),
      ))
      slots.inject('conversation.session.header.utilities', () => slots.register(
        { name: 'conversation.session.header.utilities', id: 'km-overview', order: 30, label: 'KnowledgeMap 总览' },
        (props) => React.createElement(HeaderButton, null),
      ))
      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'km-overview-panel', order: 200, label: 'KnowledgeMap 总览面板' },
        (props) => React.createElement(Overview, { sessionId: props && props.sessionId }),
      ))

      ctx.effect(() => styles.insert(CSS))
    },
  }
}

// cordis_define 需要独立 host/client 字段；此文件供本地参考，
// 实际注册请把上面两个 const 的「函数体」分别传给 code.host / code.client。
export { HOST, CLIENT }
