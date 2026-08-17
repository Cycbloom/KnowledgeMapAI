window.__ModuleLoader__.load({
	id: "@knowledgemap/dsh-km-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		// @knowledgemap/dsh-km-ui — client half.
		//
		// KnowledgeMap fusion UI: four product-level slot seats, all additive
		// (replaceRisk: none):
		//   - conversation.composer.dock          常驻六域状态带（复习待办/图谱/任务/等级·连击），点击展开复习队列
		//   - conversation.input.right            🧠 按钮：展开/收起复习队列
		//   - conversation.session.header.utilities  📊 按钮：打开六域总览浮层
		//   - shell.overlay                      六域总览面板（root 作用域，sessionId 由 📊 按钮捕获后传入）
		//
		// Data comes from the host half's slash-commands over the built-in
		// `commands` remote (`/km-ui-overview`, `/km-ui-queue [limit]`); the
		// command result `text` is a JSON payload that is parsed here.
		const inject = ["slots", "remote", "remote.commands"];
		const ID = "@knowledgemap/dsh-km-ui";

		const CSS = `
.km-dock { display:flex; align-items:center; gap:10px; padding:2px 4px; font-size:11.5px; color:var(--text-2,#9ca3af); cursor:pointer; user-select:none; }
.km-dock:hover { color:inherit; }
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
`;
		/** One <style data-plugin> tag per load; the loader removes plugin-owned tags on unload. */
		function injectStyle() {
			const tagId = ID + "/ui.css";
			if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = ID;
				tag.dataset.pluginCss = tagId;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
		}

		function apply(ctx) {
			injectStyle();

			// 模块级共享状态：队列展开 + 总览开关（跨 Slot 组件同步）。
			// shell.overlay 是 root 作用域拿不到 sessionId，由 📊 按钮（session 作用域）在打开时捕获。
			const state = { queueOpen: false, overviewOpen: false, overviewSessionId: null, listeners: [] };
			function setState(patch) {
				Object.assign(state, patch);
				for (const l of state.listeners) { try { l(); } catch (e) { /* ignore */ } }
			}
			function subscribe(fn) {
				state.listeners.push(fn);
				return () => { const i = state.listeners.indexOf(fn); if (i >= 0) state.listeners.splice(i, 1); };
			}

			// RPC：走内置 commands remote；命令结果的 text 为 JSON 载荷。
			// 解析成功返回对象，失败返回 null。
			function call(sessionId, command, limit) {
				const line = limit ? "/" + command + " " + limit : "/" + command;
				return ctx.remote.commands.execute(sessionId, line).then((res) => {
					const value = res && res.ok ? res.value : null;
					const result = value && value.result ? value.result : null;
					if (result && result.kind === "success" && typeof result.text === "string") {
						try { return JSON.parse(result.text); } catch (e) { return null; }
					}
					return null;
				}).catch(() => null);
			}

			function useOverview(sessionId, active) {
				const [data, setData] = react.useState(null);
				const [err, setErr] = react.useState(false);
				react.useEffect(() => {
					if (!sessionId || !active) { setData(null); setErr(false); return; }
					let alive = true;
					setData(null); setErr(false);
					call(sessionId, "km-ui-overview").then((v) => {
						if (!alive) return;
						if (v === null) setErr(true); else setData(v);
					});
					return () => { alive = false; };
				}, [sessionId, active]);
				return { data, err };
			}
			function useQueue(sessionId, limit) {
				const [data, setData] = react.useState(null);
				react.useEffect(() => {
					if (!sessionId) { setData(null); return; }
					let alive = true;
					call(sessionId, "km-ui-queue", limit).then((v) => { if (alive) setData(v); });
					return () => { alive = false; };
				}, [sessionId, limit]);
				return data;
			}

			// 1) composer dock：常驻环境状态带 + 点击展开复习队列
			function Dock(props) {
				const sessionId = props && props.sessionId ? String(props.sessionId) : "";
				const overview = useOverview(sessionId, true);
				const queue = useQueue(sessionId, 5);
				const [, setTick] = react.useState(0);
				react.useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
				const p = overview.data && overview.data.progress;
				const label = !overview.data
					? "🧠 加载中…"
					: "🧠 复习 " + (overview.data.study ? overview.data.study.due_now : 0) +
						" · 图 " + (overview.data.graphs ? overview.data.graphs.nodes : 0) +
						" · 任务 " + (overview.data.tasks ? overview.data.tasks.active : 0) +
						(p ? " · Lv." + p.level + (p.streak ? " 🔥" + p.streak : "") : "");
				return react.createElement("div", null,
					react.createElement("div", { className: "km-dock", title: "点击展开/收起复习队列", onClick: () => setState({ queueOpen: !state.queueOpen }) },
						react.createElement("span", null, label)),
					state.queueOpen
						? react.createElement("div", { className: "km-queue" },
							(queue && queue.queue && queue.queue.length > 0)
								? queue.queue.map((c) => react.createElement("div", { key: c.id, className: "km-qitem" },
									react.createElement("span", { className: "km-qfront" }, c.front),
									react.createElement("span", { className: "km-qtag" }, "[" + c.deck + "·" + c.state + "]")))
								: react.createElement("div", { className: "km-empty" }, "暂无到期复习"))
						: null);
			}

			// 2) input.right：🧠 按钮（展开/收起队列）
			function KmButton() {
				const [, setTick] = react.useState(0);
				react.useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
				const open = state.queueOpen;
				return react.createElement("button", {
					type: "button",
					className: "km-btn",
					title: open ? "收起 KnowledgeMap 复习队列" : "展开 KnowledgeMap 复习队列",
					onClick: () => setState({ queueOpen: !open })
				}, "🧠");
			}

			// 3) header utilities：📊 按钮（打开总览，捕获当前 sessionId 给 root 作用域的浮层）
			function HeaderButton(props) {
				const [, setTick] = react.useState(0);
				react.useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
				const open = state.overviewOpen;
				const sessionId = props && props.sessionId ? String(props.sessionId) : "";
				const onToggle = () => {
					if (!open) setState({ overviewOpen: true, overviewSessionId: sessionId });
					else setState({ overviewOpen: false });
				};
				return react.createElement("button", {
					type: "button",
					className: "km-btn",
					title: "KnowledgeMap 六域总览",
					onClick: onToggle
				}, "📊");
			}

			// 4) shell.overlay：六域总览面板
			function Overview() {
				const [, setTick] = react.useState(0);
				react.useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
				const sessionId = state.overviewSessionId;
				const { data: overview, err } = useOverview(sessionId, state.overviewOpen);
				if (!state.overviewOpen) return null;
				if (err || !overview) {
					return react.createElement("div", { className: "km-overlay" },
						react.createElement("span", { className: "km-close", onClick: () => setState({ overviewOpen: false }) }, "✕"),
						react.createElement("h4", null, "🧠 KnowledgeMap 总览"),
						react.createElement("div", { className: "km-empty" }, err ? "加载失败" : "加载中…"));
				}
				const s = overview.study || {}; const g = overview.graphs || {}; const t = overview.tasks || {};
				const pa = overview.paths || {}; const n = overview.notes || {}; const p = overview.progress;
				const Row = (k, v) => react.createElement("div", { className: "km-row" },
					react.createElement("span", null, k),
					react.createElement("span", { className: "km-v" }, String(v)));
				return react.createElement("div", { className: "km-overlay" },
					react.createElement("span", { className: "km-close", onClick: () => setState({ overviewOpen: false }) }, "✕"),
					react.createElement("h4", null, "🧠 KnowledgeMap 总览"),
					Row("复习待办", s.due_now || 0),
					Row("闪卡总数", s.total || 0),
					Row("图谱 / 节点 / 边", (g.total || 0) + " / " + (g.nodes || 0) + " / " + (g.edges || 0)),
					Row("活跃任务", t.active || 0),
					Row("学习路径（进行中）", pa.active || 0),
					Row("笔记 / wiki 挂载", (n.total || 0) + " / " + (n.wiki_mounts || 0)),
					p ? Row("等级 · 经验 · 连击", "Lv." + p.level + " · " + p.xp + " XP" + (p.streak ? " · 🔥" + p.streak : "")) : null,
					p ? Row("成就", p.achievements + " 个") : null);
			}

			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register(
				{ name: "conversation.composer.dock", id: "km-dock", order: 10, label: "KnowledgeMap 状态带" },
				(props) => react.createElement(Dock, { sessionId: props && props.sessionId })
			));
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register(
				{ name: "conversation.input.right", id: "km-btn", order: 90, label: "KnowledgeMap 队列" },
				(props) => react.createElement(KmButton, null)
			));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
				{ name: "conversation.session.header.utilities", id: "km-overview", order: 30, label: "KnowledgeMap 总览" },
				(props) => react.createElement(HeaderButton, { sessionId: props && props.sessionId })
			));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register(
				{ name: "shell.overlay", id: "km-overview-panel", order: 200, label: "KnowledgeMap 总览面板" },
				(props) => react.createElement(Overview, null)
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
