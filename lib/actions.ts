import type { AccId, Account, AdSpend, DayOff, Deal, Goal, HealthField, Invoice, Lead, LeadStatus, Meal, Member, OffKind, Project, State, Tx } from './types';
import { XFER_CAT, account, fmtCur } from './money';
import { addD, money, STAGES, TK, toMin, ymd } from './util';

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
  return {
    setH(f: HealthField, v: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(v * 10) / 10)); delete h.demo; }); },
    addH(f: HealthField, d: number, k = TK()) { update(s => { const h = hday(s, k); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round((h[f] + d) * 10) / 10)); delete h.demo; }); },
    addTask(text: string, p: 'hi' | 'lo' = 'lo', goal?: number) { text = text.trim(); if (!text) return; update(s => { s.tasks.unshift({ id: s.nextId++, t: text, p, d: false, ...(goal ? { goal } : {}) }); }); toast('Задачу додано'); },
    setTaskGoal(id: number, goal?: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; if (goal) t.goal = goal; else delete t.goal; }); },
    updateTask(id: number, v: { t: string; p: 'hi' | 'lo'; goal?: number }) {
      const text = v.t.trim(); if (!text) return;
      update(s => {
        const t = s.tasks.find(x => x.id === id); if (!t) return;
        // a focus run started on this task keeps following it after a rename
        if (s.timer.task === t.t) s.timer.task = text;
        t.t = text; t.p = v.p; delete t.demo; if (v.goal) t.goal = v.goal; else delete t.goal;
      });
      toast('Задачу оновлено');
    },
    toggleTask(id: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; t.d = !t.d; if (t.d && s.timer.task === t.t) s.timer.task = ''; }); },
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
      toast('Настрій записано');
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
    addGoal(v: { title: string; area: string; target: number; unit: string; due: string; steps?: string[] }) {
      update(s => { const { steps, ...rest } = v; s.goals.push({ id: s.nextId++, cur: 0, ...rest, ...(steps?.length ? { steps: steps.map(t => ({ id: s.nextId++, t, d: false })) } : {}) }); });
      toast('Ціль додано');
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
    addDeal(v: { title: string; client: string; amt: number; stage: string }) { update(s => { s.co.deals.push({ id: s.nextId++, title: v.title, client: v.client, amt: v.amt || 0, stage: (v.stage || 'lead') as 'lead' }); }); toast('Угоду додано'); },
    moveDeal(id: number, dir: number) {
        const d = getS().co.deals.find(x => x.id === id); if (!d) return;
        const billed = getS().co.invoices.some(i => i.deal === d.id);
      const i = STAGES.findIndex(st => st[0] === d.stage), n = Math.max(0, Math.min(3, i + dir));
      if (n === i) return;
      const won = STAGES[n][0] === 'won';
      update(s => {
        const x = s.co.deals.find(y => y.id === id)!; x.stage = STAGES[n][0]; delete x.demo;
        // winning a deal again (after moving it back) does not bill twice
        if (won && !s.co.invoices.some(i => i.deal === x.id)) { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: x.client || x.title, amt: x.amt, issued: TK(), due: ymd(addD(new Date(), 14)), paid: false, paidAt: '', deal: x.id }); }
      });
      if (won) notify(billed ? `Угоду виграно: ${d.title}` : `Угоду виграно: ${d.title}. Рахунок створено автоматично`);
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
    /** Turns a lead into a deal in the pipeline and marks the lead as a client. */
    leadToDeal(id: number) {
      const l = getS().co.leads.find(x => x.id === id); if (!l) return;
      update(s => {
        const x = s.co.leads.find(y => y.id === id)!; x.status = 'won'; x.next = ''; delete x.demo;
        s.co.deals.push({ id: s.nextId++, title: 'Угода: ' + x.name, client: x.name, amt: x.value, stage: 'lead' });
      });
      notify(`${l.name}: створено угоду`);
    },
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
      toast(kind ? 'День позначено: оцінка буде м’якшою' : 'Позначку дня знято');
    },
    addMember(v: { name: string; role: string }) { update(s => { s.co.team.push({ id: s.nextId++, ...v, load: 50 }); }); toast('Учасника додано'); },
    updateMember(id: number, v: Partial<Pick<Member, 'name' | 'role'>>) { update(s => { const m = s.co.team.find(x => x.id === id); if (m) { Object.assign(m, v); delete m.demo; } }); toast('Учасника оновлено'); },
    setLoad(id: number, l: number) { update(s => { const m = s.co.team.find(x => x.id === id); if (m) m.load = l; }); },
    delMember(id: number) { del(s => { s.co.team = s.co.team.filter(x => x.id !== id); }); },
  };
}

export type Actions = ReturnType<typeof makeActions>;
