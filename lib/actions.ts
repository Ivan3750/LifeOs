import { catOf, learn, unlearn } from './timeuse';
import type { DayOff, Goal, HealthField, Meal, OffKind, State } from './types';
import { AREAS, TK, toMin } from './util';
import { parseTask } from './tasks';
import { moodCause } from './correlations';

export const goalStep = (target: number) => (target >= 200 ? Math.round(target / 20) : target >= 40 ? 5 : 1);

export type ActionDeps = {
  update: (fn: (s: State) => void) => void;
  /** Always the latest state, also right after update() in the same event. */
  getS: () => State;
  toast: (msg: string) => void;
  notify: (msg: string) => void;
  /** update() that also offers to take the deletion back. */
  del: (fn: (s: State) => void, msg?: string) => void;
};

/** All the ways the UI changes the state. Each one is a small function over a draft copy of the state. */
export function makeActions({ update, getS, toast, notify, del }: ActionDeps) {
  const hday = (s: State, k = TK()) => s.health[k] || (s.health[k] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0 });
  const LIM: Record<HealthField, [number, number]> = { water: [0, 20], sleep: [0, 16], steps: [0, 80000], workout: [0, 600], weight: [0, 350], mood: [0, 5] };
  function addTask(text: string, p: 'hi' | 'lo' = 'lo', goal?: number, due?: string) { text = text.trim(); if (!text) return; update(s => { s.tasks.unshift({ id: s.nextId++, t: text, p, d: false, ...(goal ? { goal } : {}), ...(due ? { due } : {}) }); }); toast('Задачу додано'); }
  return {
    setH(f: HealthField, v: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(v * 10) / 10)); delete h.demo; }); },
    addH(f: HealthField, d: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(((h[f] || 0) + d) * 10) / 10)); delete h.demo; }); },
    addTask,
    /** Saves the main things of today. */
    setPlan(ids: number[], k = TK()) { update(s => { s.plan = { date: k, ids: ids.slice(0, 5) }; }); },
    /** Takes one task out of today's plan and puts the next most pressing one in its place (if there is one). */
    swapPlan(id: number, replacement?: number) {
      update(s => {
        const k = TK(), ids = s.plan.date === k ? [...s.plan.ids] : [];
        const i = ids.indexOf(id);
        if (i < 0) return;
        if (replacement) ids[i] = replacement; else ids.splice(i, 1);
        s.plan = { date: k, ids };
      });
    },
    /** One line about what went well on day k (empty removes it). */
    setWin(text: string, k = TK()) { update(s => { const t = text.trim(); if (t) s.wins[k] = t; else delete s.wins[k]; }); },
    /** Adds a task from one line of text: «!» makes it important, a trailing «завтра» or «25.11» sets the date. */
    addTaskLine(line: string, goal?: number) { const q = parseTask(line); if (!q.t) return false; addTask(q.t, q.p, goal, q.due); return true; },
    setTaskGoal(id: number, goal?: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; if (goal) t.goal = goal; else delete t.goal; }); },
    updateTask(id: number, v: { t: string; p: 'hi' | 'lo'; goal?: number; due?: string }) {
      const text = v.t.trim(); if (!text) return;
      update(s => {
        const t = s.tasks.find(x => x.id === id); if (!t) return;
        // a focus run started on this task keeps following it after a rename
        if (s.timer.task === t.t) s.timer.task = text;
        t.t = text; t.p = v.p; delete t.demo; if (v.goal) t.goal = v.goal; else delete t.goal; if (v.due) t.due = v.due; else delete t.due;
      });
      toast('Задачу оновлено');
    },
    toggleTask(id: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; t.d = !t.d; if (t.d) { t.doneAt = Date.now(); if (s.timer.task === t.t) s.timer.task = ''; } else delete t.doneAt; }); },
    togglePriority(id: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (t) { t.p = t.p === 'hi' ? 'lo' : 'hi'; delete t.demo; } }); },
    setTaskDue(id: number, due?: string) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; if (due) t.due = due; else delete t.due; }); },
    /** Removes every finished task in one go (can be undone). */
    clearDoneTasks() { del(s => { s.tasks = s.tasks.filter(x => !x.d); }, 'Виконані задачі видалено'); },
    delTask(id: number) { del(s => { s.tasks = s.tasks.filter(x => x.id !== id); }); },
    addEvent(v: { title: string; date: string; s: string; e: string; c: string }) {
      if (toMin(v.e) <= toMin(v.s)) { toast('Кінець має бути пізніше за початок'); return false; }
      update(s => { s.events.push({ id: s.nextId++, ...v }); }); toast('Подію додано'); return true;
    },
    updateEvent(id: number, v: { title: string; date: string; s: string; e: string; c: string }) {
      if (toMin(v.e) <= toMin(v.s)) { toast('Кінець має бути пізніше за початок'); return false; }
      update(s => { const x = s.events.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Подію оновлено'); return true;
    },
    delEvent(id: number) { del(s => { s.events = s.events.filter(x => x.id !== id); }); },
    /** Hides an event of a subscribed calendar on this site only: the calendar itself is not touched. key: one occurrence, or the whole series of a repeating event. */
    hideExt(key: string, all = false) {
      del(s => { (s.hiddenExt ||= {})[key] = 1; }, all ? 'Усі повтори приховано тут. У самому календарі вони лишились' : 'Подію приховано тут. У самому календарі вона лишилась');
    },
    showExt(key?: string) { update(s => { if (key) delete s.hiddenExt?.[key]; else delete s.hiddenExt; }); toast(key ? 'Подію показано знову' : 'Усі приховані події показано знову'); },
    /** A daytime sleep (after lunch…) for day k, extra to the night's sleep. */
    addNap(s0: string, e0: string, k = TK()) {
      if (!s0 || !e0 || toMin(e0) <= toMin(s0)) { toast('Кінець денного сну має бути пізніше за початок'); return false; }
      update(s => { const h = hday(s, k); (h.naps ||= []).push({ id: s.nextId++, s: s0, e: e0 }); h.naps.sort((a, b) => toMin(a.s) - toMin(b.s)); delete h.demo; });
      toast('Денний сон додано'); return true;
    },
    delNap(id: number, k = TK()) { del(s => { const h = s.health[k]; if (h?.naps) { h.naps = h.naps.filter(n => n.id !== id); if (!h.naps.length) delete h.naps; } }, 'Денний сон видалено'); },
    addHabit(name: string) { name = name.trim(); if (!name) return; update(s => { s.habits.push({ id: s.nextId++, name, days: {} }); }); toast('Звичку додано'); },
    renameHabit(id: number, name: string) { name = name.trim(); if (!name) return; update(s => { const h = s.habits.find(x => x.id === id); if (h) { h.name = name; delete h.demo; } }); toast('Звичку перейменовано'); },
    toggleHabit(id: number, k = TK()) {
        const willAllDone = k === TK() && getS().habits.every(h => h.id === id ? !h.days[k] : h.days[k]);
      update(s => { const h = s.habits.find(x => x.id === id); if (!h) return; if (h.days[k]) delete h.days[k]; else h.days[k] = 1; });
      if (willAllDone) toast('Усі звички на сьогодні виконано!');
    },
    delHabit(id: number) { del(s => { s.habits = s.habits.filter(x => x.id !== id); }); },
    /** Adds a note and returns its id. The first line becomes the title when no title is given. */
    addNote(text: string, title = '') {
      const t = Date.now(), lines = text.trim().split('\n');
      if (!title && lines.length > 1) { title = lines[0].slice(0, 80); text = lines.slice(1).join('\n').trim(); }
      update(s => { s.noteList.unshift({ id: t, title: title.trim(), text, created: t, updated: t }); });
      if (text || title) toast('Нотатку збережено');
      return t;
    },
    saveNote(id: number, v: { title?: string; text?: string }) { update(s => { const n = s.noteList.find(x => x.id === id); if (!n) return; Object.assign(n, v); n.updated = Date.now(); delete n.demo; }); },
    dropEmptyNote(id: number) { update(s => { s.noteList = s.noteList.filter(x => x.id !== id || x.title.trim() || x.text.trim()); }); },
    pinNote(id: number) { update(s => { const n = s.noteList.find(x => x.id === id); if (n) n.pinned = !n.pinned; }); },
    delNote(id: number, quiet = false) { update(s => { s.noteList = s.noteList.filter(x => x.id !== id); }); if (!quiet) toast('Нотатку видалено'); },
    startAct(kind: string, title: string) { update(s => { s.act = { kind, title: title.trim(), start: Date.now() }; }); },
    /** Saves the running activity; runs shorter than a minute are dropped. */
    stopAct() {
      const a = getS().act;
      if (!a) return;
      const end = Date.now(), m = Math.round((end - a.start) / 6e4);
      update(s => { if (m >= 1) s.activities.push({ id: s.nextId++, ...a, end }); s.act = null; });
      toast(m >= 1 ? `${a.kind}: ${m} хв записано` : 'Менше хвилини, не записано');
    },
    cancelAct() { update(s => { s.act = null; }); },
    addActivity(v: { kind: string; title: string; start: number; end: number }) {
      if (v.end <= v.start) { toast('Кінець має бути пізніше за початок'); return false; }
      update(s => { s.activities.push({ id: s.nextId++, ...v, title: v.title.trim() }); s.activities.sort((a, b) => a.start - b.start); });
      toast(`${v.kind}: ${Math.round((v.end - v.start) / 6e4)} хв записано`); return true;
    },
    /** The user says what an event is; the app remembers it for the same title and for similar words. */
    assignEvent(title: string, cat: string) { update(s => learn(s, title, cat)); toast(`«${title}»: ${catOf(cat).label}`); },
    /** Teaches several titles at once (the whole question list answered in one tap). */
    assignEvents(titles: string[], cat: string) { update(s => { for (const t of titles) learn(s, t, cat); }); toast(`${titles.length} ${titles.length === 1 ? 'подію' : 'подій'}: ${catOf(cat).label}`); },
    forgetEvent(title: string) { update(s => unlearn(s, title)); },
    /** Time on a social network. Minutes are rounded to whole minutes; one entry is at most 12 hours. */
    addSocial(v: { platform: string; min: number; why?: string; cmp?: boolean; date?: string }) {
      const min = Math.round(v.min); if (!(min > 0)) return false;
      update(s => { s.social.push({ id: s.nextId++, date: v.date || TK(), platform: v.platform, min: Math.min(720, min), ...(v.why ? { why: v.why } : {}), ...(v.cmp ? { cmp: 1 as const } : {}) }); });
      toast(`${v.platform}: ${min} хв записано`); return true;
    },
    delSocial(id: number) { del(s => { s.social = s.social.filter(x => x.id !== id); }); },
    /** Marks that after this entry you compared your life with someone else's. */
    toggleCompare(id: number) { update(s => { const x = s.social.find(e => e.id === id); if (!x) return; if (x.cmp) delete x.cmp; else x.cmp = 1; delete x.demo; }); },
    setSocialGoal(platform: string, min: number) { update(s => { s.socialGoals[platform] = Math.max(0, Math.min(600, Math.round(min))); }); },
    /** A habit to quit; the clean streak starts now. */
    addBad(name: string) { name = name.trim(); if (!name) return false; update(s => { s.badHabits.push({ id: s.nextId++, name, start: Date.now(), best: 0, slips: [] }); }); toast('Рахую дні без зривів із цього моменту'); return true; },
    renameBad(id: number, name: string) { name = name.trim(); if (name) update(s => { const h = s.badHabits.find(x => x.id === id); if (h) { h.name = name; delete h.demo; } }); },
    delBad(id: number) { del(s => { s.badHabits = s.badHabits.filter(x => x.id !== id); s.cravings = s.cravings.filter(x => x.habit !== id); }, 'Звичку видалено'); },
    /** A craving: noted with what set it off, and whether it was held. A held craving costs nothing; a slip restarts the streak but keeps the best one and the total. */
    logCraving(habit: number, trigger: string, outcome: 'resisted' | 'slipped' = 'resisted', tool?: string) {
      update(s => { s.cravings.push({ id: s.nextId++, t: Date.now(), habit, trigger, outcome, ...(tool ? { tool } : {}) }); });
      if (outcome === 'resisted') toast('Витримав. Кожен такий раз робить наступний легшим');
    },
    slipBad(habit: number, trigger = 'Інше', tool?: string) {
      const before = getS().badHabits.find(x => x.id === habit); if (!before) return;
      del(s => {
        const h = s.badHabits.find(x => x.id === habit); if (!h) return;
        h.best = Math.max(h.best, Math.floor((Date.now() - Math.max(h.start, ...h.slips)) / 864e5)); h.slips.push(Date.now()); delete h.demo;
        s.cravings.push({ id: s.nextId++, t: Date.now(), habit, trigger, outcome: 'slipped', ...(tool ? { tool } : {}) });
      }, 'Зрив записано. Найкраща серія й усі чисті дні збережені');
    },
    delCraving(id: number) { del(s => { s.cravings = s.cravings.filter(x => x.id !== id); }); },
    delActivity(id: number) { del(s => { s.activities = s.activities.filter(x => x.id !== id); }); },
    /** Focus time entered by hand, e.g. work done away from the timer. */
    addFocus(start: number, end: number) {
      const m = Math.round((end - start) / 6e4);
      if (m < 1) { toast('Кінець має бути пізніше за початок'); return false; }
      update(s => { s.sessions.push({ t: start, m }); s.sessions.sort((a, b) => a.t - b.t); });
      toast(`Фокус ${m} хв додано`); return true;
    },
    delSession(t: number) { del(s => { s.sessions = s.sessions.filter(x => x.t !== t); if (s.timer.sid === t) s.timer.sid = 0; }); },
    addMood(v: { t: number; v: number; energy: number; tags: string[]; note: string }) {
      update(s => { s.moods.push({ id: s.nextId++, ...v, note: v.note.trim() }); s.moods.sort((a, b) => a.t - b.t); });
      // a low mood is a good moment to look for the reason in what was logged: poor sleep, little water, no movement
      const why = v.v <= 4 ? moodCause(getS()) : null;
      if (why?.cause) notify(`Настрій низький. Схоже, причина: ${why.cause}. ${why.action}`); else toast('Настрій записано');
    },
    updateMood(id: number, v: { t: number; v: number; energy: number; tags: string[]; note: string }) {
      update(s => { const m = s.moods.find(x => x.id === id); if (!m) return; Object.assign(m, v, { note: v.note.trim() }); delete m.demo; s.moods.sort((a, b) => a.t - b.t); });
      toast('Запис настрою оновлено');
    },
    delMood(id: number) { del(s => { s.moods = s.moods.filter(x => x.id !== id); }); },
    setMeal(key: Meal['key'], v: Partial<Pick<Meal, 's' | 'e' | 'on'>>) { update(s => { const m = s.meals.find(x => x.key === key); if (m) Object.assign(m, v); }); },
    /** Bed and wake time for the night that ended on day k. Sleep hours follow from them. */
    setSleepTimes(bed: string, wake: string, k = TK()) {
      update(s => {
        const h = hday(s, k); h.bed = bed || undefined; h.wake = wake || undefined; delete h.demo;
        if (bed && wake) h.sleep = Math.round((((toMin(wake) - toMin(bed)) + 1440) % 1440) / 6) / 10;
      });
    },
    addGoal(v: { title: string; area: string; target: number; unit: string; due: string; steps?: string[]; kind?: 'rating' }) {
      update(s => {
        const { steps, kind, ...rest } = v;
        // a rating goal starts from where the life area stands now
        const now = kind ? s.wheel[AREAS.indexOf(v.area)] ?? 5 : 0;
        s.goals.push({ id: s.nextId++, cur: now, ...rest, ...(kind ? { kind, from: now } : {}), ...(steps?.length ? { steps: steps.map(t => ({ id: s.nextId++, t, d: false })) } : {}) });
      });
      toast('Ціль додано');
    },
    /** Rates a life area 1–10; goals that follow this area's rating move with it. */
    setWheel(i: number, v: number) {
      v = Math.max(1, Math.min(10, Math.round(v)));
      update(s => { s.wheel[i] = v; s.goals.forEach(g => { if (g.kind === 'rating' && g.area === AREAS[i]) { g.cur = v; delete g.demo; } }); });
    },
    updateGoal(id: number, v: Partial<Pick<Goal, 'title' | 'area' | 'target' | 'unit' | 'due'>>) { update(s => { const g = s.goals.find(x => x.id === id); if (g) { Object.assign(g, v); delete g.demo; } }); },
    addStep(gid: number, t: string) { t = t.trim(); if (!t) return; update(s => { const g = s.goals.find(x => x.id === gid); if (g) (g.steps ||= []).push({ id: s.nextId++, t, d: false }); }); },
    toggleStep(gid: number, sid: number) {
      const g = getS().goals.find(x => x.id === gid), st = g?.steps?.find(x => x.id === sid);
      update(s => { const x = s.goals.find(y => y.id === gid)?.steps?.find(y => y.id === sid); if (x) x.d = !x.d; });
      if (g && st && !st.d && g.steps!.every(x => x.id === sid || x.d)) notify('Ціль досягнуто: ' + g.title);
    },
    delStep(gid: number, sid: number) { del(s => { const g = s.goals.find(x => x.id === gid); if (g?.steps) g.steps = g.steps.filter(x => x.id !== sid); }); },
    stepGoal(id: number, dir: number) {
        const g = getS().goals.find(x => x.id === id); if (!g) return;
      const step = goalStep(g.target), cur = Math.max(0, Math.round((g.cur + dir * step) * 100) / 100);
      update(s => { const x = s.goals.find(y => y.id === id)!; x.cur = cur; delete x.demo; });
      if (g.cur < g.target && cur >= g.target) notify('Ціль досягнуто: ' + g.title);
    },
    delGoal(id: number) { del(s => { s.goals = s.goals.filter(x => x.id !== id); s.tasks.forEach(t => { if (t.goal === id) delete t.goal; }); }); },
    /** Marks a day as sick, emergency, rest or trip (null clears it); the day score is judged more gently on it. */
    setDayOff(k: string, kind: OffKind | null, note?: string) {
      update(s => {
        const o: Record<string, DayOff> = { ...(s.offDays || {}) };
        if (kind) o[k] = { kind, note: note ?? o[k]?.note ?? '' }; else delete o[k];
        s.offDays = o;
      });
      toast(kind ? 'День позначено: оцінка буде м’якшою' : 'Позначку дня знято');
    },
  };
}

export type Actions = ReturnType<typeof makeActions>;
