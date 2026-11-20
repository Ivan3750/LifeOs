import type { ActionDeps } from './actions';
import type { AnelaTalkKind, AutoIdea, ExposureKind, FaithKind, LifeMode, Review, Season, SocialNote, Ui } from './types';
import type { ReviewIdea } from './life';
import { dateAfter, MODES, optionalTasks, validSeason } from './life';
import { TK } from './util';

const clip = (s: string, n: number) => s.trim().slice(0, n);
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v) || 0));

/** The changes of LifeOS 2.0: modes, seasons, social life, Anela, faith, automation ideas. Same rules as the other actions:
    each one edits a draft copy of the state through update(), so saving, sync, merging and undo work as they always did. */
export function makeLifeActions({ update, getS, toast, del }: Pick<ActionDeps, 'update' | 'getS' | 'toast' | 'del'>) {
  return {
    /* ----- modes and seasons ----- */
    setLifeMode(mode: LifeMode) {
      if (!(mode in MODES)) return;
      update(s => { s.lifeMode = mode; });
      toast(`Режим: ${MODES[mode].label}`);
    },
    /** One to three main directions for a period. Replaces the current season. Creates nothing else. */
    setSeason(v: { from: string; to: string; main: string[]; support: string[]; notes?: Record<string, string> }) {
      const main = [...new Set(v.main)], support = [...new Set(v.support)].filter(x => !main.includes(x));
      const err = validSeason({ from: v.from, to: v.to, main });
      if (err) { toast(err); return false; }
      update(s => {
        const notes: Record<string, string> = {};
        for (const [k, t] of Object.entries(v.notes || {})) if ([...main, ...support].includes(k) && t.trim()) notes[k] = clip(t, 140);
        const season: Season = { id: s.nextId++, from: v.from, to: v.to, main, support, notes };
        s.season = season;
      });
      toast('Пріоритети збережено'); return true;
    },
    /** The period is over and the person looked at it: nothing is created, the old choice just stops being offered. */
    dismissSeason() { update(s => { if (s.season) s.season.dismissed = 1; }); },
    clearSeason() { del(s => { s.season = null; }, 'Пріоритети прибрано'); },

    /* ----- what is shown, what is on ----- */
    setUi(patch: Partial<Pick<Ui, 'minimal' | 'hideMetrics' | 'hideText' | 'exportPrivate'>>) { update(s => { Object.assign(s.ui, patch); }); },
    /** A module (a section of the menu) is switched on or off. Its data stays where it is. */
    setModule(key: string, on: boolean) { update(s => { if (on) delete s.ui.modules[key]; else s.ui.modules[key] = false; }); },
    /** A block of the home screen is shown or hidden. */
    setHomeBlock(key: string, on: boolean) { update(s => { if (on) delete s.ui.home[key]; else s.ui.home[key] = false; }); },

    /** Energy of the day, only when the person says it. Choosing the same level again takes it back. */
    setEnergy(level: 1 | 3 | 5, k = TK()) { update(s => { if (s.energy[k] === level) delete s.energy[k]; else s.energy[k] = level; }); },

    /* ----- rest without penalty ----- */
    /** Puts aside the tasks that are not important and not due: they vanish from the day lists and come back by themselves after `days` days.
        The toast offers to take it back. Nothing is counted against anyone. */
    snoozeOptional(days = 3) {
      const ids = new Set(optionalTasks(getS(), TK()).map(t => t.id));
      if (!ids.size) { toast('Немає необовʼязкових задач, які можна відкласти'); return 0; }
      const until = dateAfter(TK(), days);
      del(s => { for (const t of s.tasks) if (ids.has(t.id)) t.snooze = until; }, `Відкладено: ${ids.size}. Повернуться самі за ${days} дн.`);
      return ids.size;
    },
    unsnoozeAll() { update(s => { for (const t of s.tasks) delete t.snooze; }); toast('Задачі повернуто'); },
    pauseGoal(id: number, on: boolean) { update(s => { const g = s.goals.find(x => x.id === id); if (!g) return; if (on) g.paused = 1; else delete g.paused; }); },
    pauseHabit(id: number, on: boolean) { update(s => { const h = s.habits.find(x => x.id === id); if (!h) return; if (on) h.paused = 1; else delete h.paused; }); },

    /* ----- social life ----- */
    addSocialNote(v: { kind: SocialNote['kind']; text: string; person?: number; date?: string }) {
      const text = clip(v.text, 2000); if (!text) return false;
      update(s => { s.socialNotes.unshift({ id: s.nextId++, date: v.date || TK(), kind: v.kind, text, ...(v.person ? { person: v.person } : {}) }); });
      toast('Записано'); return true;
    },
    delSocialNote(id: number) { del(s => { s.socialNotes = s.socialNotes.filter(n => n.id !== id); }, 'Запис видалено'); },
    /** One small step. No target, no streak: it is only a record of what happened and how it felt. */
    addExposure(v: { kind: ExposureKind; note?: string; felt?: 1 | 2 | 3 }) {
      update(s => { s.exposure.unshift({ id: s.nextId++, date: TK(), kind: v.kind, note: clip(v.note || '', 300), ...(v.felt ? { felt: v.felt } : {}) }); });
      toast('Записано. Це вже крок'); return true;
    },
    delExposure(id: number) { del(s => { s.exposure = s.exposure.filter(e => e.id !== id); }, 'Запис видалено'); },
    setPersonNote(id: number, v: { met?: string; note?: string }) {
      update(s => {
        const p = s.people.find(x => x.id === id); if (!p) return;
        if (v.met !== undefined) { if (v.met.trim()) p.met = clip(v.met, 200); else delete p.met; }
        if (v.note !== undefined) { if (v.note.trim()) p.note = clip(v.note, 1000); else delete p.note; }
      });
    },

    /* ----- Anela: a private space. Nothing here leaves the app and nothing here is analysed. ----- */
    addFeeling(text: string, tags: string[] = []) {
      const t = clip(text, 4000); if (!t) return false;
      update(s => { s.anela.feelings.unshift({ id: s.nextId++, t: Date.now(), text: t, tags: tags.slice(0, 6) }); });
      return true;
    },
    delFeeling(id: number) { del(s => { s.anela.feelings = s.anela.feelings.filter(f => f.id !== id); }, 'Запис видалено'); },
    addMemory(v: { date: string; title: string; text: string; thoughts: string }) {
      const title = clip(v.title, 120); if (!title) return false;
      update(s => { s.anela.memories.unshift({ id: s.nextId++, date: v.date || TK(), title, text: clip(v.text, 4000), thoughts: clip(v.thoughts, 4000) }); });
      toast('Спогад збережено'); return true;
    },
    delMemory(id: number) { del(s => { s.anela.memories = s.anela.memories.filter(m => m.id !== id); }, 'Спогад видалено'); },
    addTalk(kind: AnelaTalkKind, text: string, extra = '') {
      const t = clip(text, 400); if (!t) return false;
      update(s => { s.anela.talk.push({ id: s.nextId++, kind, text: t, ...(extra.trim() ? { extra: clip(extra, 400) } : {}) }); });
      return true;
    },
    addTalkMany(items: { kind: AnelaTalkKind; text: string; extra?: string }[]) {
      update(s => { for (const x of items) if (!s.anela.talk.some(t => t.kind === x.kind && t.text === x.text)) s.anela.talk.push({ id: s.nextId++, kind: x.kind, text: x.text, ...(x.extra ? { extra: x.extra } : {}) }); });
    },
    delTalk(id: number) { del(s => { s.anela.talk = s.anela.talk.filter(t => t.id !== id); }, 'Видалено'); },
    addIntent(text: string) {
      const t = clip(text, 300); if (!t) return false;
      update(s => { s.anela.intents.push({ id: s.nextId++, text: t }); });
      return true;
    },
    pauseIntent(id: number, on: boolean) { update(s => { const i = s.anela.intents.find(x => x.id === id); if (!i) return; if (on) i.paused = 1; else delete i.paused; }); },
    delIntent(id: number) { del(s => { s.anela.intents = s.anela.intents.filter(i => i.id !== id); }, 'Видалено'); },
    saveCheck(answers: Record<string, 'yes' | 'partly' | 'no'>, note: string) {
      if (!Object.keys(answers).length && !note.trim()) return false;
      update(s => { s.anela.checks.unshift({ id: s.nextId++, t: Date.now(), answers, note: clip(note, 1000) }); s.anela.checks = s.anela.checks.slice(0, 30); });
      toast('Збережено'); return true;
    },
    delCheck(id: number) { del(s => { s.anela.checks = s.anela.checks.filter(c => c.id !== id); }, 'Видалено'); },

    /* ----- faith ----- */
    addFaith(v: { kind: FaithKind; text: string; ref?: string; date?: string }) {
      const text = clip(v.text, 4000); if (!text && !v.ref?.trim()) return false;
      update(s => { s.faith.unshift({ id: s.nextId++, date: v.date || TK(), kind: v.kind, text, ...(v.ref?.trim() ? { ref: clip(v.ref, 80) } : {}) }); });
      toast('Збережено'); return true;
    },
    delFaith(id: number) { del(s => { s.faith = s.faith.filter(f => f.id !== id); }, 'Запис видалено'); },

    /* ----- automation ideas (company mode) ----- */
    addAuto(v: { title: string; what?: string; mins?: number; perWeek?: number; effort?: AutoIdea['effort']; priority?: AutoIdea['priority'] }) {
      const title = clip(v.title, 120); if (!title) return false;
      update(s => { s.co.auto.unshift({ id: s.nextId++, title, what: clip(v.what || '', 600), mins: clampN(v.mins || 0, 0, 1440), perWeek: clampN(v.perWeek || 0, 0, 200), effort: v.effort || 'mid', priority: v.priority || 'mid', status: 'idea', seen: 1, created: TK() }); });
      toast('Додано до можливостей'); return true;
    },
    updateAuto(id: number, v: Partial<Pick<AutoIdea, 'title' | 'what' | 'mins' | 'perWeek' | 'effort' | 'priority' | 'status'>>) {
      update(s => {
        const a = s.co.auto.find(x => x.id === id); if (!a) return;
        if (v.title !== undefined && v.title.trim()) a.title = clip(v.title, 120);
        if (v.what !== undefined) a.what = clip(v.what, 600);
        if (v.mins !== undefined) a.mins = clampN(v.mins, 0, 1440);
        if (v.perWeek !== undefined) a.perWeek = clampN(v.perWeek, 0, 200);
        if (v.effort) a.effort = v.effort;
        if (v.priority) a.priority = v.priority;
        if (v.status) a.status = v.status;
      });
    },
    /** «Знову довелось робити вручну»: counts how often it really repeats. */
    seenAuto(id: number) { update(s => { const a = s.co.auto.find(x => x.id === id); if (a) a.seen++; }); },
    delAuto(id: number) { del(s => { s.co.auto = s.co.auto.filter(a => a.id !== id); }, 'Можливість видалено'); },

    /* ----- weekly review: three short answers ----- */
    saveReviewAnswers(wk: string, v: { good: string; missing: string; change: string }) {
      update(s => { const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }); r.good = clip(v.good, 1000); r.missing = clip(v.missing, 1000); r.change = clip(v.change, 1000); });
    },
    /** Takes one of the (at most two) ideas of the review. It only moves a need to the front of next week's suggestions. */
    takeReviewIdea(wk: string, idea: ReviewIdea) {
      update(s => {
        const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] });
        if (r.accepted.includes(idea.id)) return;
        if (idea.need && !r.focus.includes(idea.need)) r.focus.push(idea.need);
        r.accepted.push(idea.id);
      });
      toast('Враховано в пропозиціях на наступний тиждень');
    },
    finishWeekReview(wk: string) { update(s => { const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }); r.done = Date.now(); }); toast('Дякую. Гарного тижня'); },
    /** The review is left for later: it is never asked for again this week. */
    skipWeekReview(wk: string) { update(s => { const r: Review = (s.reviews[wk] ||= { ratings: {}, focus: [], accepted: [] }); r.done = Date.now(); }); },
  };
}
