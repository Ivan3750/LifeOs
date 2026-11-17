import { catOf, learn, unlearn } from './timeuse';
import type { Task, AccId, Account, AdSpend, Client, Recurring, DayOff, Deal, Goal, HealthField, Invoice, Lead, LeadStatus, Meal, Member, OffKind, Project, State, Tx } from './types';
import { XFER_CAT, account, fmtCur, pendingRecurring, potSaved, recDate, shiftMk, toDKK } from './money';
import { addD, AREAS, money, STAGES, TK, toMin, wStart, ymd } from './util';
import type { Machine, Need, NeedLog, Person, Place, Review } from './types';
import type { Slot } from './planner';
import { GOAL_TEMPLATES } from './goalplan';
import type { Suggestion } from './review';
import { parseTask } from './tasks';
import { moodCause } from './correlations';
import { norm } from './clients';

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
  function addTask(text: string, p: 'hi' | 'lo' = 'lo', goal?: number, due?: string, rep?: Task['rep']) { text = text.trim(); if (!text) return; update(s => { s.tasks.unshift({ id: s.nextId++, t: text, p, d: false, ...(goal ? { goal } : {}), ...(due ? { due } : {}), ...(rep ? { rep, due: due || TK() } : {}) }); }); toast(rep ? 'Повторювану задачу додано' : 'Задачу додано'); }
  return {
    setH(f: HealthField, v: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(v * 10) / 10)); delete h.demo; }); },
    addH(f: HealthField, d: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(((h[f] || 0) + d) * 10) / 10)); delete h.demo; }); },
    addTask,
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
    toggleTask(id: number) {
      update(s => {
        const t = s.tasks.find(x => x.id === id); if (!t) return;
        t.d = !t.d;
        if (t.d) {
          t.doneAt = Date.now(); if (s.timer.task === t.t) s.timer.task = '';
          // a repeating task comes back: the next one is due a day, a week or a month after this one (never in the past)
          if (t.rep) {
            const from = new Date((t.due && t.due > TK() ? t.due : TK()) + 'T00:00');
            if (t.rep === 'month') from.setMonth(from.getMonth() + 1); else from.setDate(from.getDate() + (t.rep === 'week' ? 7 : 1));
            s.tasks.unshift({ id: s.nextId++, t: t.t, p: t.p, d: false, rep: t.rep, due: ymd(from), ...(t.goal ? { goal: t.goal } : {}) });
          }
        } else delete t.doneAt;
      });
    },
    /** Moves everything that is late to today, without a word of blame. */
    moveOverdueToToday() { update(s => { for (const t of s.tasks) if (!t.d && t.due && t.due < TK()) t.due = TK(); }); toast('Прострочене перенесено на сьогодні'); },
    /** A note becomes a task: its title, or its first line. */
    noteToTask(id: number) {
      const n = getS().noteList.find(x => x.id === id); if (!n) return false;
      const text = (n.title.trim() || n.text.trim().split('\n')[0]).slice(0, 120); if (!text) return false;
      addTask(text); return true;
    },
    /** An affirmation was read aloud today. Three different ones make the morning ritual. */
    readAff(text: string, k = TK()) { update(s => { const a = (s.aff ||= { own: [], fav: [], read: {} }); const l = (a.read[k] ||= []); if (!l.includes(text)) l.push(text); for (const d of Object.keys(a.read).sort().slice(0, -60)) delete a.read[d]; }); },
    toggleAffFav(text: string) { update(s => { const a = (s.aff ||= { own: [], fav: [], read: {} }); a.fav = a.fav.includes(text) ? a.fav.filter(x => x !== text) : [...a.fav, text]; }); },
    addAffOwn(text: string) { text = text.trim().slice(0, 240); if (!text) return false; update(s => { const a = (s.aff ||= { own: [], fav: [], read: {} }); if (!a.own.includes(text)) a.own.push(text); }); toast('Твою афірмацію додано'); return true; },
    delAffOwn(text: string) { update(s => { const a = s.aff; if (a) { a.own = a.own.filter(x => x !== text); a.fav = a.fav.filter(x => x !== text); } }); },
    setBadCost(id: number, kr: number) { update(s => { const h = s.badHabits.find(x => x.id === id); if (!h) return; if (kr > 0) h.cost = Math.min(100000, Math.round(kr)); else delete h.cost; }); },
    togglePriority(id: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (t) { t.p = t.p === 'hi' ? 'lo' : 'hi'; delete t.demo; } }); },
    setTaskDue(id: number, due?: string) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; if (due) t.due = due; else delete t.due; }); },
    /** Removes every finished task in one go (can be undone). */
    clearDoneTasks() { del(s => { s.tasks = s.tasks.filter(x => !x.d); }, 'Виконані задачі видалено'); },
    delTask(id: number) { del(s => { s.tasks = s.tasks.filter(x => x.id !== id); }); },
    addTx(type: 'in' | 'out', amt: number, cat: string, note: string, date: string, acc: AccId = 'dk') {
      if (!(amt > 0)) return;
      update(s => { s.money.tx.push({ id: s.nextId++, type, amt, cat, note: (note || '').trim(), date, acc }); });
      toast((type === 'out' ? 'Витрату' : 'Дохід') + ' записано: ' + fmtCur(amt, account(getS(), acc).cur));
    },
    /** Changes a record; for one half of a transfer only the note and date follow to the other half. */
    updateTx(id: number, v: Partial<Pick<Tx, 'type' | 'amt' | 'cat' | 'note' | 'date' | 'acc'>>) {
      update(s => {
        const t = s.money.tx.find(x => x.id === id); if (!t) return;
        Object.assign(t, v, v.note !== undefined ? { note: v.note.trim() } : {}); delete t.demo;
        if (t.xfer) s.money.tx.filter(x => x.xfer === t.xfer && x.id !== id).forEach(o => { o.date = t.date; o.note = t.note; });
      });
      toast('Запис оновлено');
    },
    /** Moves money between own accounts: one record out of `from`, one into `to` (received may differ after conversion). */
    addTransfer(from: AccId, to: AccId, amt: number, received: number, date: string, note: string) {
      if (!(amt > 0) || !(received > 0) || from === to) return;
      update(s => {
        const x = s.nextId++;
        s.money.tx.push({ id: s.nextId++, type: 'out', amt, cat: XFER_CAT, note: note.trim(), date, acc: from, xfer: x });
        s.money.tx.push({ id: s.nextId++, type: 'in', amt: received, cat: XFER_CAT, note: note.trim(), date, acc: to, xfer: x });
      });
      toast(`Переказ: ${fmtCur(amt, account(getS(), from).cur)} → ${fmtCur(received, account(getS(), to).cur)}`);
    },
    /** Creates the records of regular payments that have come due (one per month, only once). Returns how many were added. */
    applyRecurring() {
      // two devices can create the same month's record before they sync: keep the oldest one only
      const seen = new Set<string>(), extra = new Set<number>();
      for (const t of [...getS().money.tx].sort((a, b) => a.id - b.id)) if (t.rec) { const k = t.rec + '|' + t.date.slice(0, 7); if (seen.has(k)) extra.add(t.id); else seen.add(k); }
      if (extra.size) update(s => { s.money.tx = s.money.tx.filter(t => !extra.has(t.id)); });
      const due = pendingRecurring(getS()); if (!due.length) return 0;
      update(s => { for (const { r, date } of due) s.money.tx.push({ id: s.nextId++, type: r.type, amt: r.amt, cat: r.cat, note: r.name, date, acc: r.acc, rec: r.id }); });
      toast(`Додано регулярних записів: ${due.length}`);
      return due.length;
    },
    addRecurring(v: Omit<Recurring, 'id' | 'from' | 'active'> & { from?: string }) {
      if (!v.name.trim() || !(v.amt > 0)) return false;
      const day = Math.min(31, Math.max(1, Math.round(v.day) || 1)), mk = TK().slice(0, 7);
      // a payment whose day has already passed this month starts next month, so nothing is added twice for a record that was already typed in by hand
      const from = v.from || (recDate({ day } as Recurring, mk) <= TK() ? shiftMk(mk, 1) : mk);
      update(s => { s.money.recurring.push({ id: s.nextId++, ...v, name: v.name.trim(), from, active: true, day }); });
      toast(`Регулярний платіж додано${from > mk ? ': перший запис у наступному місяці' : ''}`); return true;
    },
    toggleRecurring(id: number) { update(s => { const r = s.money.recurring.find(x => x.id === id); if (r) r.active = !r.active; }); },
    delRecurring(id: number) { del(s => { s.money.recurring = s.money.recurring.filter(x => x.id !== id); }, 'Регулярний платіж видалено'); },
    addPot(v: { name: string; target: number; due: string }) { if (!v.name.trim() || !(v.target > 0)) return false; update(s => { s.money.pots.push({ id: s.nextId++, name: v.name.trim(), target: v.target, due: v.due }); }); toast('Скарбничку створено'); return true; },
    /** Moves money into a pot (or back out when amt is negative). The account balance changes, spending statistics do not. */
    potMove(id: number, amt: number, acc: AccId = 'dk') {
      const pot = getS().money.pots.find(p => p.id === id); if (!pot || !amt) return;
      // cannot take out more than is in the pot (in kroner)
      if (amt < 0 && -toDKK(getS(), amt, account(getS(), acc).cur) > potSaved(getS(), id) + 0.005) { toast('У скарбничці стільки нема'); return; }
      update(s => { s.money.tx.push({ id: s.nextId++, type: amt > 0 ? 'out' : 'in', amt: Math.abs(amt), cat: 'Заощадження', note: pot.name, date: TK(), acc, pot: id }); });
      toast(amt > 0 ? `Відкладено ${fmtCur(amt, account(getS(), acc).cur)}: ${pot.name}` : `Знято зі скарбнички: ${pot.name}`);
    },
    delPot(id: number) { del(s => { s.money.pots = s.money.pots.filter(p => p.id !== id); s.money.tx = s.money.tx.filter(t => t.pot !== id); }, 'Скарбничку видалено, гроші повернулись на рахунок'); },
    setCatBudget(cat: string, n: number) { update(s => { if (n > 0) s.money.catBudgets[cat] = Math.round(n); else delete s.money.catBudgets[cat]; }); },
    setBudgetMode(mode: 'fixed' | 'income') { update(s => { s.money.budgetMode = mode; }); },
    setSaveRate(n: number) { update(s => { s.money.saveRate = Math.max(0, Math.min(90, Math.round(n))); }); },
    setAccount(id: AccId, v: Partial<Pick<Account, 'name' | 'opening' | 'budget'>>) { update(s => { const a = s.money.accounts.find(x => x.id === id); if (a) Object.assign(a, v); }); },
    setRate(uahPerDkk: number, src: 'nbu' | 'manual') { if (!(uahPerDkk > 0)) return; update(s => { s.money.uahPerDkk = uahPerDkk; s.money.rateAt = Date.now(); s.money.rateSrc = src; }); },
    /** Deleting one half of a transfer removes both halves. */
    delTx(id: number) {
      update(s => { const t = s.money.tx.find(x => x.id === id); s.money.tx = s.money.tx.filter(x => x.id !== id && !(t?.xfer && x.xfer === t.xfer)); });
    },
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
    delGoal(id: number) { del(s => { s.goals = s.goals.filter(x => x.id !== id); s.tasks.forEach(t => { if (t.goal === id) delete t.goal; }); s.needs.forEach(n => { if (n.goal === id) delete n.goal; }); s.machines.forEach(m => { if (m.goal === id) delete m.goal; }); }); },
    addDeal(v: { title: string; client: string; amt: number; stage: string }) { update(s => { s.co.deals.push({ id: s.nextId++, title: v.title, client: v.client, amt: v.amt || 0, stage: (v.stage || 'lead') as 'lead' }); }); toast('Угоду додано'); },
    /** Moves a deal one stage. Winning it starts the rest of the chain by itself: a project to do the work and an invoice to get paid (only once per deal). */
    moveDeal(id: number, dir: number) {
      const d = getS().co.deals.find(x => x.id === id); if (!d) return;
      const hadProject = getS().co.projects.some(p => p.deal === d.id), billed = getS().co.invoices.some(i => i.deal === d.id);
      const i = STAGES.findIndex(st => st[0] === d.stage), n = Math.max(0, Math.min(3, i + dir));
      if (n === i) return;
      const won = STAGES[n][0] === 'won';
      update(s => {
        const x = s.co.deals.find(y => y.id === id)!; x.stage = STAGES[n][0]; delete x.demo;
        if (!won) return;
        let proj = s.co.projects.find(p => p.deal === x.id);
        if (!proj) { proj = { id: s.nextId++, name: x.title, client: x.client, due: ymd(addD(new Date(), 30)), progress: 0, status: 'active', budget: x.amt, deal: x.id }; s.co.projects.push(proj); }
        if (!s.co.invoices.some(i => i.deal === x.id)) { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: x.client || x.title, amt: x.amt, issued: TK(), due: ymd(addD(new Date(), 14)), paid: false, paidAt: '', deal: x.id, project: proj.id }); }
      });
      if (won) notify(`Угоду виграно: ${d.title}.${hadProject && billed ? '' : ` Створено ${hadProject ? '' : 'проєкт'}${!hadProject && !billed ? ' і ' : ''}${billed ? '' : 'рахунок'}.`}`);
    },
    /** Bills a project that has no invoice yet, for its budget. */
    invoiceProject(id: number) {
      const p = getS().co.projects.find(x => x.id === id); if (!p || getS().co.invoices.some(i => i.project === id)) return;
      update(s => { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: p.client || p.name, amt: p.budget, issued: TK(), due: ymd(addD(new Date(), 14)), paid: false, paidAt: '', project: id, ...(p.deal ? { deal: p.deal } : {}) }); });
      toast('Рахунок створено');
    },
    updateDeal(id: number, v: Partial<Pick<Deal, 'title' | 'client' | 'amt' | 'stage'>>) { update(s => { const x = s.co.deals.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Угоду оновлено'); },
    delDeal(id: number) { del(s => { s.co.deals = s.co.deals.filter(x => x.id !== id); }); },
    restoreDeal(id: number) { update(s => { const x = s.co.deals.find(y => y.id === id); if (x) x.stage = 'lead'; }); toast('Угоду повернуто в «Лід»'); },
    loseDeal(id: number) { update(s => { const x = s.co.deals.find(y => y.id === id); if (x) x.stage = 'lost'; }); toast('Угоду позначено як програну'); },
    addProject(v: { name: string; client: string; budget: number; due: string }) { update(s => { s.co.projects.push({ id: s.nextId++, ...v, budget: v.budget || 0, progress: 0, status: 'active' }); }); toast('Проєкт додано'); },
    setProgress(id: number, p: number) {
        const pr = getS().co.projects.find(x => x.id === id); if (!pr) return;
      update(s => { const x = s.co.projects.find(y => y.id === id)!; x.progress = p; delete x.demo; if (p >= 100) x.status = 'done'; else if (x.status === 'done') x.status = 'active'; });
      if (p >= 100 && pr.status !== 'done') notify('Проєкт завершено: ' + pr.name);
    },
    updateProject(id: number, v: Partial<Pick<Project, 'name' | 'client' | 'budget' | 'due'>>) { update(s => { const x = s.co.projects.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Проєкт оновлено'); },
    cycleProject(id: number) { update(s => { const x = s.co.projects.find(y => y.id === id); if (!x) return; x.status = ({ active: 'paused', paused: 'done', done: 'active' } as const)[x.status]; if (x.status === 'done') x.progress = 100; }); },
    delProject(id: number) { del(s => { s.co.projects = s.co.projects.filter(x => x.id !== id); }); },
    addInvoice(v: { client: string; amt: number; due: string }) {
      update(s => { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: v.client, amt: v.amt || 0, issued: TK(), due: v.due || ymd(addD(new Date(), 14)), paid: false, paidAt: '' }); });
      toast('Рахунок створено');
    },
    updateInvoice(id: number, v: Partial<Pick<Invoice, 'client' | 'amt' | 'due'>>) { update(s => { const x = s.co.invoices.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Рахунок оновлено'); },
    togglePaid(id: number) {
        const i = getS().co.invoices.find(x => x.id === id); if (!i) return;
      update(s => { const x = s.co.invoices.find(y => y.id === id)!; x.paid = !x.paid; x.paidAt = x.paid ? TK() : ''; });
      if (!i.paid) toast(`Оплату ${money(i.amt)} зараховано`);
    },
    delInvoice(id: number) { del(s => { s.co.invoices = s.co.invoices.filter(x => x.id !== id); }); },
    addLead(v: { name: string; contact: string; source: string; value: number; next: string; note: string; status?: LeadStatus }) {
      update(s => { s.co.leads.push({ id: s.nextId++, name: v.name.trim(), contact: v.contact.trim(), source: v.source, status: v.status || 'new', value: v.value || 0, next: v.next, note: v.note.trim(), created: TK() }); });
      toast('Потенційного клієнта додано');
    },
    updateLead(id: number, v: Partial<Pick<Lead, 'name' | 'contact' | 'source' | 'value' | 'next' | 'note' | 'status'>>) {
      update(s => { const x = s.co.leads.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } });
    },
    /** Moves a lead along the chain; a lead that is closed no longer needs a next contact. */
    setLeadStatus(id: number, status: LeadStatus) {
      update(s => { const x = s.co.leads.find(y => y.id === id); if (!x) return; x.status = status; delete x.demo; if (status === 'won' || status === 'dead') x.next = ''; });
    },
    /** The lead has become a client: a client card is made (or an existing one with the same name is reused) and the lead is closed as won. */
    leadToClient(id: number) {
      const l = getS().co.leads.find(x => x.id === id); if (!l) return;
      update(s => {
        const x = s.co.leads.find(y => y.id === id)!; x.status = 'won'; x.next = ''; delete x.demo;
        if (!s.co.clients.some(c => norm(c.name) === norm(x.name))) s.co.clients.push({ id: s.nextId++, name: x.name, contact: x.contact, source: x.source, since: TK(), note: x.note, lead: x.id });
      });
      notify(`${l.name}: тепер клієнт`);
    },
    /** Turns a lead into a deal in the pipeline; the lead also becomes a client. */
    leadToDeal(id: number) {
      const l = getS().co.leads.find(x => x.id === id); if (!l) return;
      update(s => {
        const x = s.co.leads.find(y => y.id === id)!; x.status = 'won'; x.next = ''; delete x.demo;
        if (!s.co.clients.some(c => norm(c.name) === norm(x.name))) s.co.clients.push({ id: s.nextId++, name: x.name, contact: x.contact, source: x.source, since: TK(), note: x.note, lead: x.id });
        s.co.deals.push({ id: s.nextId++, title: 'Угода: ' + x.name, client: x.name, amt: x.value, stage: 'lead' });
      });
      notify(`${l.name}: створено угоду, клієнта додано`);
    },
    addClient(v: { name: string; contact: string; source: string; note: string }) {
      if (!v.name.trim()) return false;
      if (getS().co.clients.some(c => norm(c.name) === norm(v.name))) { toast('Такий клієнт уже є'); return false; }
      update(s => { s.co.clients.push({ id: s.nextId++, name: v.name.trim(), contact: v.contact.trim(), source: v.source, since: TK(), note: v.note.trim() }); });
      toast('Клієнта додано'); return true;
    },
    updateClient(id: number, v: Partial<Pick<Client, 'name' | 'contact' | 'source' | 'note'>>) { update(s => { const x = s.co.clients.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Клієнта оновлено'); },
    delClient(id: number) { del(s => { s.co.clients = s.co.clients.filter(x => x.id !== id); }); },
    delLead(id: number) { del(s => { s.co.leads = s.co.leads.filter(x => x.id !== id); }); },
    addAd(v: { date: string; channel: string; amt: number; note: string }) { if (!(v.amt > 0)) return false; update(s => { s.co.ads.push({ id: s.nextId++, ...v, note: v.note.trim() }); }); toast('Витрату на рекламу записано'); return true; },
    updateAd(id: number, v: Partial<Pick<AdSpend, 'date' | 'channel' | 'amt' | 'note'>>) { update(s => { const x = s.co.ads.find(y => y.id === id); if (x) { Object.assign(x, v); delete x.demo; } }); toast('Запис оновлено'); },
    delAd(id: number) { del(s => { s.co.ads = s.co.ads.filter(x => x.id !== id); }); },
    /** Marks a day as sick, emergency, rest or trip (null clears it); the day score is judged more gently on it. */
    setDayOff(k: string, kind: OffKind | null, note?: string) {
      update(s => {
        const o: Record<string, DayOff> = { ...(s.offDays || {}) };
        if (kind) o[k] = { kind, note: note ?? o[k]?.note ?? '' }; else delete o[k];
        s.offDays = o;
      });
      toast(kind ? 'День позначено' : 'Позначку дня знято');
    },
    addMember(v: { name: string; role: string }) { update(s => { s.co.team.push({ id: s.nextId++, ...v, load: 50 }); }); toast('Учасника додано'); },
    updateMember(id: number, v: Partial<Pick<Member, 'name' | 'role'>>) { update(s => { const m = s.co.team.find(x => x.id === id); if (m) { Object.assign(m, v); delete m.demo; } }); toast('Учасника оновлено'); },
    setLoad(id: number, l: number) { update(s => { const m = s.co.team.find(x => x.id === id); if (m) m.load = l; }); },
    delMember(id: number) { del(s => { s.co.team = s.co.team.filter(x => x.id !== id); }); },
    ...makeNeedActions({ update, getS, toast, notify, del }),
  };
}

export type Actions = ReturnType<typeof makeActions>;

const PLAIN_NEED = { on: true, min: 30, from: '17:00', to: '21:00', days: 'any' } as const;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v) || 0));

/** Needs, the daily minimum, people, places, the money goal and the weekly review. */
function makeNeedActions({ update, getS, toast, del }: ActionDeps) {
  /** Marks a need as met on day k. Returns the id of the mark. */
  function mark(s: State, need: number, k: string, src: NeedLog['src'], ref?: number) {
    const id = s.nextId++;
    s.needLog.push({ id, need, date: k, t: Date.now(), src, ...(ref !== undefined ? { ref } : {}) });
    return id;
  }
  const needId = (s: State, key: string) => s.needs.find(n => n.key === key && n.on)?.id;
  return {
    addNeed(v: { name: string; weekly: number } & Partial<Pick<Need, 'min' | 'from' | 'to' | 'days' | 'kw' | 'goal'>>) {
      const name = v.name.trim(); if (!name) return false;
      update(s => { s.needs.push({ id: s.nextId++, name, weekly: clampN(v.weekly || 3, 1, 14), ...PLAIN_NEED, ...(v.min ? { min: clampN(v.min, 5, 480) } : {}), ...(v.from ? { from: v.from } : {}), ...(v.to ? { to: v.to } : {}), ...(v.days ? { days: v.days } : {}), ...(v.kw?.length ? { kw: v.kw } : {}), ...(v.goal ? { goal: v.goal } : {}) }); });
      toast('Потребу додано'); return true;
    },
    updateNeed(id: number, v: Partial<Pick<Need, 'name' | 'weekly' | 'on' | 'min' | 'from' | 'to' | 'days' | 'kw'>> & { goal?: number | null }) {
      update(s => {
        const n = s.needs.find(x => x.id === id); if (!n) return;
        const { name, weekly, min, kw, goal, ...rest } = v;
        Object.assign(n, rest);
        if (goal !== undefined) { if (goal && s.goals.some(g => g.id === goal)) n.goal = goal; else delete n.goal; }
        if (name !== undefined && name.trim()) n.name = name.trim();
        if (weekly !== undefined) n.weekly = clampN(weekly, 1, 14);
        if (min !== undefined) n.min = clampN(min, 5, 480);
        if (kw !== undefined) { if (kw.length) n.kw = kw; else delete n.kw; }
      });
    },
    delNeed(id: number) { del(s => { s.needs = s.needs.filter(x => x.id !== id); s.needLog = s.needLog.filter(l => l.need !== id); s.events.forEach(e => { if (e.need === id) delete e.need; }); }, 'Потребу видалено'); },
    /** One more time the need was met. */
    logNeed(id: number, k = TK(), src: NeedLog['src'] = 'manual') { update(s => { if (s.needs.some(n => n.id === id)) mark(s, id, k, src); }); },
    /** Takes back the last mark of the need this week. Only marks made by hand can be taken back; what the calendar gave stays. */
    unlogNeed(id: number, at = new Date()) {
      update(s => {
        const from = ymd(wStart(at)), last = s.needLog.filter(l => l.need === id && l.date >= from).sort((a, b) => b.t - a.t || b.id - a.id)[0];
        if (last) s.needLog = s.needLog.filter(l => l.id !== last.id);
      });
    },

    /** The daily minimum: movement (or one new thing) is ticked on day k; ticking it again takes it back. */
    toggleDaily(what: 'move' | 'nov', k = TK()) {
      update(s => {
        const d = (s.daily[k] ||= {});
        if (d[what]) {
          delete d[what];
          if (what === 'nov') { const id = needId(s, 'new'); s.needLog = s.needLog.filter(l => !(l.need === id && l.date === k && l.src === 'daily')); }
          if (!d.move && !d.nov) delete s.daily[k];
          return;
        }
        d[what] = 1;
        if (what === 'nov') { const id = needId(s, 'new'); if (id) mark(s, id, k, 'daily'); }
      });
    },

    /** A person is added to the list; `last` is the day you last were in touch, if you remember. */
    addPerson(v: { name: string; kind: Person['kind']; every: number; last?: string; next?: string; nextDate?: string }) {
      const name = v.name.trim(); if (!name) return false;
      update(s => {
        const id = s.nextId++;
        s.people.push({ id, name, kind: v.kind, every: clampN(v.every, 1, 365), ...(v.next?.trim() ? { next: v.next.trim() } : {}), ...(v.nextDate ? { nextDate: v.nextDate } : {}) });
        if (v.last && v.last <= TK()) s.touches.push({ id: s.nextId++, person: id, date: v.last, kind: 'msg' });
      });
      toast('Людину додано'); return true;
    },
    updatePerson(id: number, v: { name?: string; kind?: Person['kind']; every?: number; next?: string; nextDate?: string }) {
      update(s => {
        const p = s.people.find(x => x.id === id); if (!p) return;
        if (v.name?.trim()) p.name = v.name.trim();
        if (v.kind) p.kind = v.kind;
        if (v.every !== undefined) p.every = clampN(v.every, 1, 365);
        if (v.next !== undefined) { if (v.next.trim()) p.next = v.next.trim(); else delete p.next; }
        if (v.nextDate !== undefined) { if (v.nextDate) p.nextDate = v.nextDate; else delete p.nextDate; }
      });
    },
    delPerson(id: number) {
      del(s => {
        const touches = new Set(s.touches.filter(t => t.person === id).map(t => t.id));
        s.people = s.people.filter(p => p.id !== id); s.touches = s.touches.filter(t => t.person !== id);
        s.needLog = s.needLog.filter(l => !(l.src === 'people' && l.ref !== undefined && touches.has(l.ref)));
      }, 'Людину видалено');
    },
    /** A message or a meeting. A meeting also counts for the need «Люди» (and «Стосунки» with a partner); a planned date that has come is cleared. */
    addTouch(person: number, kind: 'msg' | 'meet', k = TK()) {
      const p = getS().people.find(x => x.id === person); if (!p) return;
      update(s => {
        const id = s.nextId++;
        s.touches.push({ id, person, date: k, kind });
        const q = s.people.find(x => x.id === person)!;
        if (q.nextDate && q.nextDate <= k) { delete q.nextDate; if (kind === 'meet') delete q.next; }
        if (kind === 'meet') {
          const a = needId(s, 'people'); if (a) mark(s, a, k, 'people', id);
          if (q.kind === 'partner') { const b = needId(s, 'love'); if (b) mark(s, b, k, 'people', id); }
        }
      });
      toast(kind === 'meet' ? `${p.name}: зустріч записана` : `${p.name}: повідомлення записане`);
    },
    delTouch(id: number) { del(s => { s.touches = s.touches.filter(t => t.id !== id); s.needLog = s.needLog.filter(l => !(l.src === 'people' && l.ref === id)); }, 'Запис видалено'); },

    addPlace(v: { name: string; what: string; url?: string; going?: string }) {
      const name = v.name.trim(); if (!name) return false;
      const url = (v.url || '').trim();
      update(s => { s.places.push({ id: s.nextId++, name, what: v.what.trim(), ...(/^https?:\/\//i.test(url) ? { url } : {}), ...(v.going ? { going: v.going } : {}) }); });
      toast('Місце додано'); return true;
    },
    updatePlace(id: number, v: Partial<Pick<Place, 'name' | 'what' | 'was' | 'going'>>) {
      update(s => {
        const p = s.places.find(x => x.id === id); if (!p) return;
        if (v.name?.trim()) p.name = v.name.trim();
        if (v.what !== undefined) p.what = v.what.trim();
        if (v.was !== undefined) { if (v.was) p.was = v.was; else delete p.was; }
        if (v.going !== undefined) { if (v.going) p.going = v.going; else delete p.going; }
      });
    },
    delPlace(id: number) { del(s => { s.places = s.places.filter(p => p.id !== id); }, 'Місце видалено'); },
    /** You were there: the date is saved, the planned date is cleared and the need «Люди» gets its mark. */
    visitPlace(id: number, k = TK()) {
      update(s => {
        const p = s.places.find(x => x.id === id); if (!p) return;
        p.was = k; if (p.going && p.going <= k) delete p.going;
        const a = needId(s, 'people'); if (a) mark(s, a, k, 'place', id);
      });
      toast('Записано. Це спілкування теж зараховане');
    },

    /** The slots of the week planner become events of the schedule. */
    planSlots(slots: Slot[]) {
      if (!slots.length) return;
      update(s => { for (const x of slots) { const n = s.needs.find(y => y.id === x.need); if (n) s.events.push({ id: s.nextId++, date: x.date, s: x.s, e: x.e, title: n.name, c: 'c3', need: n.id }); } });
      toast(slots.length === 1 ? 'Додано в розклад' : `Додано в розклад: ${slots.length}`);
    },
    /** A planned slot was done: the event is ticked and the need gets its mark. Ticking it again takes both back. */
    toggleSlot(eventId: number) {
      update(s => {
        const e = s.events.find(x => x.id === eventId); if (!e?.need) return;
        if (e.ok) { delete e.ok; s.needLog = s.needLog.filter(l => !(l.src === 'plan' && l.ref === eventId)); }
        else { e.ok = 1; mark(s, e.need, e.date, 'plan', eventId); }
      });
    },

    /** A goal made of ready needs: the goal is created and the needs it is made of become its weekly rhythm. */
    goalFromTemplate(key: string) {
      const t = GOAL_TEMPLATES.find(x => x.key === key); if (!t) return;
      update(s => {
        const id = s.nextId++;
        s.goals.push({ id, title: t.title, area: t.area, target: 0, cur: 0, unit: '', due: '' });
        for (const k of t.needs) { const n = s.needs.find(x => x.key === k); if (n && !n.goal) { n.goal = id; n.on = true; } }
      });
      toast(`Ціль «${t.title}» додано з тижневим ритмом`);
    },
    /** A new weekly action for a goal. */
    addRhythm(goal: number, name: string, weekly: number) {
      name = name.trim(); if (!name || !getS().goals.some(g => g.id === goal)) return false;
      update(s => { if (s.goals.some(g => g.id === goal)) s.needs.push({ id: s.nextId++, name, weekly: clampN(weekly || 3, 1, 14), ...PLAIN_NEED, goal }); });
      toast('Ритм додано'); return true;
    },
    addMachine(v: { title: string; target: number; saved: number; due: string; price: number; conv: number; url?: string; goal?: number }) {
      const title = v.title.trim(); if (!title || !(v.target > 0) || !(v.price > 0)) return false;
      const url = (v.url || '').trim();
      update(s => { s.machines.push({ id: s.nextId++, ...(v.goal ? { goal: v.goal } : {}), title, target: Math.round(v.target), saved: Math.max(0, Math.round(v.saved || 0)), due: v.due, price: Math.round(v.price), conv: clampN(v.conv || 20, 1, 100), ...(/^https?:\/\//i.test(url) ? { url } : {}), log: [] }); });
      toast('Ціль додано'); return true;
    },
    updateMachine(id: number, v: Partial<Pick<Machine, 'title' | 'target' | 'saved' | 'due' | 'price' | 'conv'>> & { goal?: number | null }) {
      update(s => {
        const m = s.machines.find(x => x.id === id); if (!m) return;
        if (v.title?.trim()) m.title = v.title.trim();
        if (v.goal !== undefined) { if (v.goal && s.goals.some(g => g.id === v.goal)) m.goal = v.goal; else delete m.goal; }
        if (v.target !== undefined && v.target > 0) m.target = Math.round(v.target);
        if (v.saved !== undefined) m.saved = Math.max(0, Math.round(v.saved));
        if (v.due !== undefined) m.due = v.due;
        if (v.price !== undefined && v.price > 0) m.price = Math.round(v.price);
        if (v.conv !== undefined) m.conv = clampN(v.conv, 1, 100);
      });
    },
    delMachine(id: number) { del(s => { s.machines = s.machines.filter(m => m.id !== id); }, 'Ціль видалено'); },
    /** Work on a money goal today: leads found, clients won, money received. All of the day goes into one record. */
    logMachine(id: number, v: { leads?: number; clients?: number; money?: number }, k = TK()) {
      update(s => {
        const m = s.machines.find(x => x.id === id); if (!m) return;
        let l = m.log.find(x => x.date === k);
        if (!l) { l = { id: s.nextId++, date: k, leads: 0, clients: 0, money: 0 }; m.log.push(l); }
        l.leads = Math.max(0, l.leads + Math.round(v.leads || 0)); l.clients = Math.max(0, l.clients + Math.round(v.clients || 0)); l.money = Math.max(0, l.money + Math.round(v.money || 0));
        if (!l.leads && !l.clients && !l.money) m.log = m.log.filter(x => x.id !== l!.id);
      });
    },
    delMachineLog(id: number, logId: number) { del(s => { const m = s.machines.find(x => x.id === id); if (m) m.log = m.log.filter(l => l.id !== logId); }); },

    /** A mark from 1 to 5 for a need in the review of the week wk. */
    rateNeed(wk: string, need: number, v: number) {
      update(s => { const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }); r.ratings[need] = clampN(v, 1, 5); });
    },
    /** Takes a suggestion of the review: a new target, or the first slots for the need next week. */
    applySuggestion(wk: string, sg: Suggestion) {
      update(s => {
        const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }), n = s.needs.find(x => x.id === sg.need);
        if (!n || r.accepted.includes(sg.id)) return;
        if (sg.kind === 'focus') { if (!r.focus.includes(n.id)) r.focus.push(n.id); } else if (sg.target) n.weekly = clampN(sg.target, 1, 14);
        r.accepted.push(sg.id);
      });
      toast(sg.kind === 'focus' ? 'Додано. Наступного тижня це піде першим' : 'Ціль змінено');
    },
    finishReview(wk: string) {
      update(s => { const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }); r.done = Date.now(); });
      toast('Огляд збережено. Гарного тижня');
    },
  };
}
