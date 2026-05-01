import { useState, useEffect, useContext, createContext, useMemo, useCallback, useReducer, memo, useRef } from "react";

// ═══════════════════════════════════════════════
// GAME CONFIG
// ═══════════════════════════════════════════════
const XP_VALUES = { easy: 25, medium: 50, hard: 100, epic: 200 };
const COINS_PER_TASK = 10;
const calcLevel = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
const xpForLevel = (lvl) => (lvl - 1) * (lvl - 1) * 50;
const xpForNextLevel = (lvl) => lvl * lvl * 50;

const BADGE_DEFS = [
  { id: "first_blood", icon: "⚔️", name: "First Blood",     desc: "Complete your first quest",       condition: (s) => s.completedTasks.length >= 1 },
  { id: "warrior",    icon: "🗡️", name: "Warrior",          desc: "Complete 5 quests",                condition: (s) => s.completedTasks.length >= 5 },
  { id: "champion",   icon: "🏆", name: "Champion",         desc: "Complete 20 quests",               condition: (s) => s.completedTasks.length >= 20 },
  { id: "on_fire",    icon: "🔥", name: "On Fire",          desc: "Reach a 3-day streak",             condition: (s) => s.player.streak >= 3 },
  { id: "lightning",  icon: "⚡", name: "Lightning",        desc: "Reach a 7-day streak",             condition: (s) => s.player.streak >= 7 },
  { id: "diamond",    icon: "💎", name: "Diamond",          desc: "Reach Level 5",                    condition: (s) => calcLevel(s.player.totalXp) >= 5 },
  { id: "perfectionist", icon: "⭐", name: "Perfectionist", desc: "Complete 3 Epic quests",           condition: (s) => s.completedTasks.filter(t => t.difficulty === "epic").length >= 3 },
  { id: "rich",       icon: "💰", name: "Treasure Hunter",  desc: "Earn 100 coins",                   condition: (s) => s.player.coins >= 100 },
  { id: "scholar",    icon: "📚", name: "Scholar",          desc: "Complete 5 Learning quests",       condition: (s) => s.completedTasks.filter(t => t.category === "learning").length >= 5 },
  { id: "guardian",   icon: "🛡️", name: "Guardian",        desc: "Complete 5 Health quests",         condition: (s) => s.completedTasks.filter(t => t.category === "health").length >= 5 },
];

// ═══════════════════════════════════════════════
// STATE / REDUCER
// ═══════════════════════════════════════════════
const initialState = {
  player: { name: "Hero", totalXp: 0, coins: 0, streak: 0, lastCompletedDate: null },
  tasks: [],
  completedTasks: [],
  activeView: "dashboard",
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_STATE":
      return { ...state, ...action.payload };
    case "SET_VIEW":
      return { ...state, activeView: action.payload };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case "EDIT_TASK":
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case "COMPLETE_TASK": {
      const task = state.tasks.find(t => t.id === action.payload);
      if (!task) return state;
      const xpGain = XP_VALUES[task.difficulty] || 25;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const last = state.player.lastCompletedDate;
      const newStreak = last === today ? state.player.streak : last === yesterday ? state.player.streak + 1 : 1;
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.payload),
        completedTasks: [{ ...task, completedAt: Date.now() }, ...state.completedTasks].slice(0, 60),
        player: { ...state.player, totalXp: state.player.totalXp + xpGain, coins: state.player.coins + COINS_PER_TASK, streak: newStreak, lastCompletedDate: today },
      };
    }
    default: return state;
  }
}

// ═══════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════
const GameContext = createContext(null);
const useGame = () => useContext(GameContext);

// ═══════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════
async function saveState(state) {
  try { await window.storage.set("qm_v1", JSON.stringify({ player: state.player, tasks: state.tasks, completedTasks: state.completedTasks })); } catch (_) {}
}
async function loadState() {
  try { const r = await window.storage.get("qm_v1"); return r ? JSON.parse(r.value) : null; } catch (_) { return null; }
}

// ═══════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════
const IS = { background: "#0d1b2a", border: "1px solid #1e3a5f", borderRadius: 7, padding: "10px 13px", color: "#e2e8f0", fontFamily: "'Rajdhani', sans-serif", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const SS = { ...IS };
const BS = { padding: "10px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", fontSize: 14, fontWeight: 700, transition: "all 0.18s ease" };

// ═══════════════════════════════════════════════
// XP BAR
// ═══════════════════════════════════════════════
const XPBar = memo(({ totalXp }) => {
  const lvl = calcLevel(totalXp);
  const start = xpForLevel(lvl), end = xpForNextLevel(lvl);
  const pct = Math.min(((totalXp - start) / (end - start)) * 100, 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 5, fontFamily: "'Rajdhani',sans-serif" }}>
        <span style={{ color: "#f59e0b" }}>LVL {lvl}</span>
        <span>{totalXp - start} / {end - start} XP</span>
      </div>
      <div style={{ background: "#0a1525", borderRadius: 4, height: 9, border: "1px solid #1e3a5f", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#b45309,#f59e0b,#fde68a)", borderRadius: 4, transition: "width .6s ease", boxShadow: "0 0 10px #f59e0b88" }} />
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════
// XP TOAST
// ═══════════════════════════════════════════════
function Toast({ xp, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, background: "linear-gradient(135deg,#92400e,#f59e0b)", color: "#000", padding: "13px 22px", borderRadius: 10, fontFamily: "'Press Start 2P',monospace", fontSize: 11, boxShadow: "0 0 30px #f59e0b88", animation: "toastIn .3s ease", pointerEvents: "none" }}>
      ⚡ +{xp} XP!
    </div>
  );
}

// ═══════════════════════════════════════════════
// TASK CARD
// ═══════════════════════════════════════════════
const DIFF_CLR = { easy: "#4ade80", medium: "#fb923c", hard: "#f87171", epic: "#c084fc" };
const CAT_ICO  = { work: "💼", personal: "👤", health: "❤️", learning: "📚", other: "⚙️" };

const TaskCard = memo(({ task, onComplete, onDelete, onEdit }) => {
  const [hoverBtn, setHoverBtn] = useState(false);
  const c = DIFF_CLR[task.difficulty] || "#94a3b8";
  return (
    <div style={{ background: "linear-gradient(135deg,#0a1828 0%,#0f1e35 100%)", border: `1px solid ${c}25`, borderLeft: `3px solid ${c}`, borderRadius: 9, padding: "13px 15px", marginBottom: 9, transition: "transform .15s ease" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateX(4px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <button onClick={() => onComplete(task.id)}
          onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
          style={{ width: 23, height: 23, borderRadius: "50%", border: `2px solid ${c}`, background: hoverBtn ? c : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: hoverBtn ? "#000" : "transparent", transition: "all .18s", fontWeight: 900 }}>✓</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "#e2e8f0", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15 }}>{task.title}</span>
            <span style={{ fontSize: 13 }}>{CAT_ICO[task.category] || "⚙️"}</span>
          </div>
          {task.description && <p style={{ color: "#4a6080", fontSize: 12, marginTop: 3, fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.4 }}>{task.description}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: `${c}18`, color: c, fontSize: 10, padding: "2px 9px", borderRadius: 12, border: `1px solid ${c}40`, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{task.difficulty}</span>
            <span style={{ color: "#f59e0b", fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>+{XP_VALUES[task.difficulty]} XP</span>
            {task.dueDate && <span style={{ color: "#334d6e", fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }}>📅 {task.dueDate}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <Ico onClick={() => onEdit(task)} title="Edit">✏️</Ico>
          <Ico onClick={() => onDelete(task.id)} title="Delete">🗑️</Ico>
        </div>
      </div>
    </div>
  );
});

function Ico({ children, onClick, title }) {
  const [h, sH] = useState(false);
  return <button onClick={onClick} title={title} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: h ? 1 : 0.45, transition: "opacity .15s" }}>{children}</button>;
}

// ═══════════════════════════════════════════════
// TASK FORM MODAL
// ═══════════════════════════════════════════════
function TaskForm({ task, onSave, onClose }) {
  const [f, sF] = useState(task || { title: "", description: "", difficulty: "easy", category: "work", dueDate: "" });
  const submit = useCallback(() => { if (!f.title.trim()) return; onSave({ ...f, id: task?.id || Date.now().toString() }); }, [f, task, onSave]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#071220", border: "1px solid #f59e0b44", borderRadius: 14, padding: 28, width: "92%", maxWidth: 460, boxShadow: "0 0 60px #f59e0b18" }}>
        <h3 style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 11, marginBottom: 22 }}>{task ? "✏️ EDIT QUEST" : "⚔️ NEW QUEST"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={f.title} onChange={e => sF(p => ({ ...p, title: e.target.value }))} placeholder="Quest title*" style={IS} />
          <textarea value={f.description} onChange={e => sF(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" rows={2} style={{ ...IS, resize: "none" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={f.difficulty} onChange={e => sF(p => ({ ...p, difficulty: e.target.value }))} style={SS}>
              <option value="easy">⚡ Easy +25 XP</option>
              <option value="medium">🔥 Medium +50 XP</option>
              <option value="hard">💥 Hard +100 XP</option>
              <option value="epic">👑 Epic +200 XP</option>
            </select>
            <select value={f.category} onChange={e => sF(p => ({ ...p, category: e.target.value }))} style={SS}>
              <option value="work">💼 Work</option>
              <option value="personal">👤 Personal</option>
              <option value="health">❤️ Health</option>
              <option value="learning">📚 Learning</option>
              <option value="other">⚙️ Other</option>
            </select>
          </div>
          <input type="date" value={f.dueDate} onChange={e => sF(p => ({ ...p, dueDate: e.target.value }))} style={IS} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...BS, background: "transparent", border: "1px solid #1e3a5f", color: "#64748b" }}>Cancel</button>
          <button onClick={submit} style={{ ...BS, background: "linear-gradient(135deg,#92400e,#f59e0b)", color: "#000" }}>
            {task ? "Save Changes" : "Add Quest"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════
function DashboardView() {
  const { state } = useGame();
  const { player, tasks, completedTasks } = state;

  const weekActivity = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return { label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], count: completedTasks.filter(t => new Date(t.completedAt).toDateString() === d.toDateString()).length };
    });
  }, [completedTasks]);

  const diffStats = useMemo(() => {
    const c = { easy: 0, medium: 0, hard: 0, epic: 0 };
    completedTasks.forEach(t => { if (c[t.difficulty] !== undefined) c[t.difficulty]++; });
    return c;
  }, [completedTasks]);

  const maxBar = Math.max(...weekActivity.map(d => d.count), 1);
  const earnedCount = BADGE_DEFS.filter(b => b.condition(state)).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 22 }}>
        {[
          { icon: "⚔️", label: "Active Quests", val: tasks.length, c: "#38bdf8" },
          { icon: "✅", label: "Completed", val: completedTasks.length, c: "#4ade80" },
          { icon: "🔥", label: "Day Streak", val: `${player.streak}d`, c: "#fb923c" },
          { icon: "💰", label: "Gold Coins", val: player.coins, c: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ background: "linear-gradient(135deg,#071220,#0d1e35)", border: `1px solid ${s.c}22`, borderRadius: 11, padding: 18 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ color: s.c, fontFamily: "'Press Start 2P',monospace", fontSize: 13 }}>{s.val}</div>
            <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 12, marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
        <div style={{ background: "linear-gradient(135deg,#071220,#0d1e35)", border: "1px solid #0f2540", borderRadius: 11, padding: 18 }}>
          <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Weekly Activity</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {weekActivity.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div title={`${d.count} quests`} style={{ width: "100%", background: d.count > 0 ? "linear-gradient(180deg,#fde68a,#f59e0b)" : "#0d1e35", borderRadius: "3px 3px 0 0", height: `${(d.count / maxBar) * 68 + (d.count > 0 ? 8 : 4)}%`, minHeight: 4, transition: "height .5s ease", boxShadow: d.count > 0 ? "0 0 8px #f59e0b55" : "none" }} />
                <span style={{ color: "#334d6e", fontSize: 9, fontFamily: "'Rajdhani',sans-serif" }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg,#071220,#0d1e35)", border: "1px solid #0f2540", borderRadius: 11, padding: 18 }}>
          <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Quest Distribution</div>
          {[["Easy", diffStats.easy, "#4ade80"], ["Medium", diffStats.medium, "#fb923c"], ["Hard", diffStats.hard, "#f87171"], ["Epic", diffStats.epic, "#c084fc"]].map(([lbl, cnt, clr]) => (
            <div key={lbl} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#64748b", fontFamily: "'Rajdhani',sans-serif", fontSize: 12 }}>{lbl}</span>
                <span style={{ color: clr, fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 700 }}>{cnt}</span>
              </div>
              <div style={{ background: "#0a1828", borderRadius: 3, height: 5 }}>
                <div style={{ width: `${completedTasks.length ? (cnt / completedTasks.length) * 100 : 0}%`, height: "100%", background: clr, borderRadius: 3, transition: "width .6s ease", boxShadow: `0 0 6px ${clr}66` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg,#071220,#0d1e35)", border: "1px solid #0f2540", borderRadius: 11, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>Achievements</div>
          <div style={{ color: "#f59e0b", fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 700 }}>{earnedCount}/{BADGE_DEFS.length}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BADGE_DEFS.map(b => {
            const earned = b.condition(state);
            return (
              <div key={b.id} title={`${b.name}: ${b.desc}`} style={{ width: 46, height: 46, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, background: earned ? "linear-gradient(135deg,#0f1e35,#142a45)" : "#071018", border: earned ? "1px solid #f59e0b55" : "1px solid #0d1e35", filter: earned ? "none" : "grayscale(1) opacity(.25)", boxShadow: earned ? "0 0 14px #f59e0b20" : "none", transition: "all .2s" }}>
                {b.icon}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// QUESTS VIEW
// ═══════════════════════════════════════════════
function QuestsView() {
  const { state, dispatch } = useGame();
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const onSearch = useCallback((v) => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(v), 300);
  }, []);

  const filtered = useMemo(() => {
    let t = state.tasks.filter(task => {
      const ms = task.title.toLowerCase().includes(debSearch.toLowerCase()) || (task.description || "").toLowerCase().includes(debSearch.toLowerCase());
      const mf = filter === "all" || task.difficulty === filter || task.category === filter;
      return ms && mf;
    });
    if (sort === "newest") t = [...t].reverse();
    else if (sort === "xp_hi") t = [...t].sort((a, b) => XP_VALUES[b.difficulty] - XP_VALUES[a.difficulty]);
    else if (sort === "xp_lo") t = [...t].sort((a, b) => XP_VALUES[a.difficulty] - XP_VALUES[b.difficulty]);
    else if (sort === "az") t = [...t].sort((a, b) => a.title.localeCompare(b.title));
    return t;
  }, [state.tasks, debSearch, filter, sort]);

  const handleComplete = useCallback((id) => {
    const task = state.tasks.find(t => t.id === id);
    if (task) { dispatch({ type: "COMPLETE_TASK", payload: id }); setToast(XP_VALUES[task.difficulty]); }
  }, [state.tasks, dispatch]);

  const handleSave = useCallback((task) => {
    if (editTask) { dispatch({ type: "EDIT_TASK", payload: task }); setEditTask(null); }
    else dispatch({ type: "ADD_TASK", payload: { ...task, createdAt: Date.now() } });
    setShowForm(false);
  }, [editTask, dispatch]);

  return (
    <div>
      {toast && <Toast xp={toast} onDone={() => setToast(null)} />}
      {(showForm || editTask) && <TaskForm task={editTask} onSave={handleSave} onClose={() => { setShowForm(false); setEditTask(null); }} />}

      <div style={{ display: "flex", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="🔍  Search quests..." style={{ ...IS, flex: 1, minWidth: 150 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...SS, width: "auto" }}>
          <option value="all">All Types</option>
          <option value="easy">Easy</option><option value="medium">Medium</option>
          <option value="hard">Hard</option><option value="epic">Epic</option>
          <option value="work">Work</option><option value="health">Health</option>
          <option value="personal">Personal</option><option value="learning">Learning</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...SS, width: "auto" }}>
          <option value="newest">Newest First</option>
          <option value="xp_hi">Highest XP</option>
          <option value="xp_lo">Lowest XP</option>
          <option value="az">A → Z</option>
        </select>
        <button onClick={() => setShowForm(true)} style={{ ...BS, background: "linear-gradient(135deg,#92400e,#f59e0b)", color: "#000", whiteSpace: "nowrap" }}>
          ＋ New Quest
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0", color: "#1e3a5f" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⚔️</div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: "#1e3a5f" }}>
            {state.tasks.length === 0 ? "No quests yet!" : "No results found"}
          </div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: "#162840", marginTop: 10 }}>
            {state.tasks.length === 0 ? "Click '+ New Quest' to begin your adventure" : "Adjust your search or filters"}
          </div>
        </div>
      ) : (
        filtered.map(task => (
          <TaskCard key={task.id} task={task}
            onComplete={handleComplete}
            onDelete={id => dispatch({ type: "DELETE_TASK", payload: id })}
            onEdit={t => { setEditTask(t); setShowForm(false); }}
          />
        ))
      )}

      {state.completedTasks.length > 0 && (
        <div style={{ marginTop: 24, borderTop: "1px solid #0f2540", paddingTop: 18 }}>
          <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            ✅ Recently Completed ({state.completedTasks.slice(0, 5).length})
          </div>
          {state.completedTasks.slice(0, 5).map(task => (
            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, background: "#071018", border: "1px solid #0d1e35", marginBottom: 7, opacity: 0.6 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ color: "#4a6080", fontFamily: "'Rajdhani',sans-serif", fontSize: 14, flex: 1, textDecoration: "line-through" }}>{task.title}</span>
              <span style={{ color: "#f59e0b", fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }}>+{XP_VALUES[task.difficulty]} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ACHIEVEMENTS VIEW
// ═══════════════════════════════════════════════
function AchievementsView() {
  const { state } = useGame();
  const earned = BADGE_DEFS.filter(b => b.condition(state));
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg,#071220,#0d1e35)", border: "1px solid #0f2540", borderRadius: 11, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20 }}>🏆</div>
        <div>
          <div style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 12 }}>{earned.length} / {BADGE_DEFS.length}</div>
          <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 12, marginTop: 4 }}>Achievements Unlocked</div>
        </div>
        <div style={{ flex: 1, marginLeft: 8 }}>
          <div style={{ background: "#0a1828", borderRadius: 4, height: 8 }}>
            <div style={{ width: `${(earned.length / BADGE_DEFS.length) * 100}%`, height: "100%", background: "linear-gradient(90deg,#b45309,#f59e0b)", borderRadius: 4, transition: "width .6s ease", boxShadow: "0 0 8px #f59e0b55" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 13 }}>
        {BADGE_DEFS.map(b => {
          const e = b.condition(state);
          return (
            <div key={b.id} style={{ background: e ? "linear-gradient(135deg,#071220,#0d1e35)" : "#040c18", border: e ? "1px solid #f59e0b55" : "1px solid #0a1828", borderRadius: 12, padding: 20, textAlign: "center", filter: e ? "none" : "opacity(.45)", boxShadow: e ? "0 0 24px #f59e0b12" : "none", transition: "all .3s", position: "relative" }}>
              {e && <div style={{ position: "absolute", top: 9, right: 11, fontSize: 10, color: "#4ade80" }}>✓</div>}
              <div style={{ fontSize: 38, marginBottom: 11 }}>{b.icon}</div>
              <div style={{ color: e ? "#f59e0b" : "#1e3a5f", fontFamily: "'Press Start 2P',monospace", fontSize: 9, lineHeight: 1.7, marginBottom: 8 }}>{b.name}</div>
              <div style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{b.desc}</div>
              {e && <div style={{ marginTop: 11, color: "#4ade80", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 700 }}>UNLOCKED</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// AI ADVISOR VIEW  ─ FIXED
// ═══════════════════════════════════════════════
function AIAdvisorView() {
  const { state } = useGame();
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: "ai", text: "⚔️ Greetings, brave adventurer! I am your AI Quest Advisor, forged by ancient algorithms. Ask me for quest ideas, productivity strategies, or a morale boost!" },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput("");
    setError(null);

    // Add user message immediately
    const nextMsgs = [...msgs, { role: "user", text: txt }];
    setMsgs(nextMsgs);
    setLoading(true);

    try {
      const lvl = calcLevel(state.player.totalXp);

      const systemPrompt = `You are a wise RPG quest advisor inside a gamified productivity app called Quest Master.
The player is Level ${lvl} with ${state.player.totalXp} XP total, a ${state.player.streak}-day streak,
${state.tasks.length} active quests, and ${state.completedTasks.length} quests completed.
Speak in a fun, motivating RPG fantasy style with occasional medieval flair.
Keep responses to 2-4 sentences max. Be specific, actionable, and energizing.`;

      // Build full conversation history for the API (skip opening AI greeting)
      const apiMessages = nextMsgs
        .slice(1)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 300,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const reply =
        data.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("") || "The oracle is silent...";

      setMsgs((m) => [...m, { role: "ai", text: reply }]);
    } catch (e) {
      const errMsg =
        e.message?.includes("overloaded") || e.message?.includes("529")
          ? "⚠️ The oracle is overwhelmed with seekers! Try again in a moment."
          : `⚠️ My crystal ball is cloudy: ${e.message}`;
      setError(errMsg);
      setMsgs((m) => [...m, { role: "ai", text: errMsg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, msgs, state]);

  const QUICK = ["Give me 3 quest ideas", "How do I level up faster?", "Motivate me!", "What should I focus on today?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 380 }}>
      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 13 }}>
            {m.role === "ai" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0f1e35,#1e3a5f)", border: "1px solid #f59e0b44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, marginRight: 9, marginTop: 2 }}>
                🔮
              </div>
            )}
            <div style={{
              maxWidth: "76%",
              background: m.role === "user" ? "linear-gradient(135deg,#92400e,#f59e0b)" : "linear-gradient(135deg,#071220,#0d1e35)",
              border: m.role === "user" ? "none" : "1px solid #0f2540",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "12px 16px",
              color: m.role === "user" ? "#000" : "#c8d8ec",
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: m.role === "user" ? 700 : 400,
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 41px" }}>
            <span style={{ color: "#334d6e", fontFamily: "'Rajdhani',sans-serif", fontSize: 13 }}>Consulting the oracle</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", animation: `pulse 0.8s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#f87171", fontFamily: "'Rajdhani',sans-serif", fontSize: 13 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#4a6080", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        {QUICK.map((p, i) => (
          <button key={i} onClick={() => setInput(p)}
            style={{ background: "#071220", border: "1px solid #0f2540", borderRadius: 20, padding: "5px 12px", color: "#4a6080", fontSize: 11, cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", transition: "all .18s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f59e0b55"; e.currentTarget.style.color = "#f59e0b"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#0f2540"; e.currentTarget.style.color = "#4a6080"; }}>
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 9 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask your quest advisor..."
          style={{ ...IS, flex: 1 }}
          disabled={loading} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ ...BS, background: (!loading && input.trim()) ? "linear-gradient(135deg,#92400e,#f59e0b)" : "#071220", color: (!loading && input.trim()) ? "#000" : "#334d6e", minWidth: 52, padding: "10px 14px", cursor: loading || !input.trim() ? "not-allowed" : "pointer" }}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════
import { Component } from "react";
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: "center", color: "#f87171", fontFamily: "'Rajdhani',sans-serif" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, marginBottom: 12 }}>CRITICAL ERROR</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>{this.state.error.message}</div>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, ...BS, background: "#f87171", color: "#fff" }}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════
const NAV = [
  { id: "dashboard", icon: "🏰", label: "Dashboard" },
  { id: "quests", icon: "⚔️", label: "Quests" },
  { id: "achievements", icon: "🏆", label: "Achievements" },
  { id: "advisor", icon: "🔮", label: "AI Advisor" },
];

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState().then(saved => { if (saved) dispatch({ type: "LOAD_STATE", payload: saved }); setLoaded(true); });
  }, []);

  useEffect(() => { if (loaded) saveState(state); }, [state.player, state.tasks, state.completedTasks, loaded]);

  if (!loaded) return (
    <div style={{ height: "100vh", background: "#030a14", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 12 }}>Loading...</div>
    </div>
  );

  const lvl = calcLevel(state.player.totalXp);
  const current = NAV.find(n => n.id === state.activeView);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;scrollbar-width:thin;scrollbar-color:#0d1e35 #030a14}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#030a14}
        ::-webkit-scrollbar-thumb{background:#0d1e35;border-radius:3px}
        input,select,textarea{color-scheme:dark}
        @keyframes toastIn{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1.3)}}
        input:focus,select:focus,textarea:focus{outline:none!important;border-color:#1e4a7f!important;box-shadow:0 0 0 2px #1e4a7f44!important}
        button:hover{opacity:.9}
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "#030a14", overflow: "hidden", fontFamily: "'Rajdhani',sans-serif" }}>
        {/* SIDEBAR */}
        <div style={{ width: 215, background: "linear-gradient(180deg,#07111e,#030a14)", borderRight: "1px solid #0a1828", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #07111e" }}>
            <div style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 9, lineHeight: 1.9, letterSpacing: 1 }}>QUEST<br/>MASTER</div>
            <div style={{ color: "#1e3a5f", fontSize: 11, marginTop: 2, fontFamily: "'Rajdhani',sans-serif" }}>Gamified Task Manager</div>
          </div>

          <div style={{ padding: "14px 16px", borderBottom: "1px solid #07111e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#92400e,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, boxShadow: "0 0 16px #f59e0b44" }}>⚔️</div>
              <div>
                <div style={{ color: "#d1e0f0", fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700 }}>{state.player.name}</div>
                <div style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 9 }}>Level {lvl}</div>
              </div>
            </div>
            <XPBar totalXp={state.player.totalXp} />
          </div>

          <nav style={{ flex: 1, paddingTop: 6, overflowY: "auto" }}>
            {NAV.map(item => {
              const active = state.activeView === item.id;
              return (
                <button key={item.id} onClick={() => dispatch({ type: "SET_VIEW", payload: item.id })}
                  style={{ width: "100%", textAlign: "left", padding: "12px 17px", border: "none", cursor: "pointer", background: active ? "linear-gradient(90deg,#f59e0b18,transparent)" : "transparent", borderLeft: `2px solid ${active ? "#f59e0b" : "transparent"}`, color: active ? "#f59e0b" : "#2d4a6a", display: "flex", alignItems: "center", gap: 10, fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, transition: "all .18s" }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#5a7fa0"; e.currentTarget.style.background = "#071018"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#2d4a6a"; e.currentTarget.style.background = "transparent"; }}}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ padding: "12px 16px", borderTop: "1px solid #07111e", fontFamily: "'Rajdhani',sans-serif", fontSize: 12 }}>
            <span style={{ color: "#1e3a5f" }}>🔥 <span style={{ color: "#fb923c" }}>{state.player.streak}d</span>  💰 <span style={{ color: "#f59e0b" }}>{state.player.coins}</span></span>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "15px 24px", borderBottom: "1px solid #07111e", background: "#030a14", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ color: "#d1e0f0", fontFamily: "'Press Start 2P',monospace", fontSize: 11, letterSpacing: 1 }}>
                {current?.icon} {current?.label.toUpperCase()}
              </h1>
              <p style={{ color: "#1e3a5f", fontSize: 12, fontFamily: "'Rajdhani',sans-serif", marginTop: 4 }}>
                {state.activeView === "dashboard" && "Your adventure at a glance"}
                {state.activeView === "quests" && `${state.tasks.length} active quest${state.tasks.length !== 1 ? "s" : ""} · ${state.completedTasks.length} completed`}
                {state.activeView === "achievements" && `${BADGE_DEFS.filter(b => b.condition(state)).length} of ${BADGE_DEFS.length} achievements unlocked`}
                {state.activeView === "advisor" && "Powered by Claude AI · Ask anything"}
              </p>
            </div>
            <div style={{ background: "#071220", border: "1px solid #0f2540", borderRadius: 9, padding: "9px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "#f59e0b", fontFamily: "'Press Start 2P',monospace", fontSize: 10 }}>LVL {lvl}</span>
              <span style={{ color: "#0f2540" }}>|</span>
              <span style={{ color: "#94a3b8", fontFamily: "'Rajdhani',sans-serif", fontSize: 13 }}>{state.player.totalXp.toLocaleString()} XP</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
            <ErrorBoundary>
              {state.activeView === "dashboard" && <DashboardView />}
              {state.activeView === "quests" && <QuestsView />}
              {state.activeView === "achievements" && <AchievementsView />}
              {state.activeView === "advisor" && <AIAdvisorView />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </GameContext.Provider>
  );
}