import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { makeActions } from '@/lib/actions';
import { makeLifeActions } from '@/lib/lifeActions';
import { fill } from '@/lib/store';
import { mergeStates } from '@/lib/merge';
import { daysAway, isSnoozed, modeOf, optionalTasks, restHint, reviewIdeas, seasonDaysLeft, seasonEnded, seasonNeedKeys, seasonOn, todayPicks, validSeason } from '@/lib/life';
import type { State } from '@/lib/types';

const TODAY = '2026-11-20';

function setup() {
  const S = makeState(false);
  const log: string[] = [];
  const update = (fn: (s: State) => void) => fn(S);
  const deps = { update, getS: () => S, toast: (m: string) => { log.push(m); }, notify: () => {}, del: update };
  return { S, log, A: { ...makeActions(deps), ...makeLifeActions(deps) } };
}
const task = (S: State, t: string, p: 'hi' | 'lo', due?: string, extra: Partial<State['tasks'][number]> = {}) => { S.tasks.push({ id: S.nextId++, t, p, d: false, ...(due ? { due } : {}), ...extra }); };

describe('migration of older data', () => {
  it('gives every new field a default and keeps everything that was there', () => {
    const old = makeState(false) as unknown as Record<string, unknown>;
    for (const k of ['lifeMode', 'season', 'ui', 'energy', 'socialNotes', 'exposure', 'anela', 'faith']) delete old[k];
    delete (old.co as Record<string, unknown>).auto;
    (old.tasks as unknown[]).push({ id: 5, t: 'стара задача', p: 'hi', d: false });
    const s = fill(old as unknown as State);
    expect(s.lifeMode).toBe('normal');
    expect(s.season).toBeNull();
    expect(s.ui).toEqual({ minimal: false, hideMetrics: false, modules: {}, home: {}, hideText: false, exportPrivate: false });
    expect(s.socialNotes).toEqual([]);
    expect(s.energy).toEqual({});
    expect(s.anela).toEqual({ feelings: [], memories: [], talk: [], intents: [], checks: [] });
    expect(s.faith).toEqual([]);
    expect(s.co.auto).toEqual([]);
    expect(s.tasks.map(t => t.t)).toContain('стара задача');
    expect(s.needs.length).toBeGreaterThan(0);
  });

  it('repairs new fields of the wrong kind and keeps good values', () => {
    const bad = { ...makeState(false), lifeMode: 7, ui: 'x', anela: { feelings: 'oops' }, season: 5 } as unknown as State;
    const s = fill(bad);
    expect(s.lifeMode).toBe('normal');
    expect(s.ui.minimal).toBe(false);
    expect(Array.isArray(s.anela.feelings)).toBe(true);
    expect(Array.isArray(s.anela.memories)).toBe(true);
    expect(s.season).toBeNull();
    const good = { ...makeState(false), lifeMode: 'exam', ui: { ...makeState(false).ui, minimal: true, modules: { anela: false } } } as State;
    const t = fill(good);
    expect(t.lifeMode).toBe('exam');
    expect(t.ui.minimal).toBe(true);
    expect(t.ui.modules).toEqual({ anela: false });
  });

  it('merges private lists of two devices by id, so a note written on a phone is not lost', () => {
    const base = makeState(false), a = structuredClone(base), b = structuredClone(base);
    a.anela.feelings.push({ id: 900, t: 1, text: 'з телефону', tags: [] });
    b.faith.push({ id: 901, date: TODAY, kind: 'thanks', text: 'з ноутбука' });
    const m = mergeStates(base as never, a as never, b as never) as State;
    expect(m.anela.feelings.map(f => f.id)).toEqual([900]);
    expect(m.faith.map(f => f.id)).toEqual([901]);
  });
});

describe('life modes', () => {
  it('Recovery shows one thing and only what is important or due', () => {
    const { S, A } = setup();
    task(S, 'важлива', 'hi'); task(S, 'звичайна', 'lo'); task(S, 'до сьогодні', 'lo', TODAY); task(S, 'друга важлива', 'hi');
    expect(todayPicks(S, TODAY).length).toBe(3);
    A.setLifeMode('recovery');
    expect(modeOf(S)).toBe('recovery');
    const picks = todayPicks(S, TODAY);
    expect(picks).toHaveLength(1);
    expect(['важлива', 'до сьогодні', 'друга важлива']).toContain(picks[0].t);
  });

  it('never offers more than three things, and not a done, snoozed or paused-goal task', () => {
    const { S } = setup();
    S.goals.push({ id: 50, title: 'g', area: 'x', target: 1, cur: 0, unit: '', due: '', paused: 1 });
    for (let i = 0; i < 6; i++) task(S, 'т' + i, 'hi');
    task(S, 'відкладена', 'hi', undefined, { snooze: '2026-11-25' });
    task(S, 'для паузної цілі', 'hi', undefined, { goal: 50 });
    S.tasks.push({ id: 999, t: 'зроблена', p: 'hi', d: true });
    const picks = todayPicks(S, TODAY);
    expect(picks).toHaveLength(3);
    expect(picks.map(t => t.t)).not.toContain('відкладена');
    expect(picks.map(t => t.t)).not.toContain('для паузної цілі');
    expect(picks.map(t => t.t)).not.toContain('зроблена');
  });

  it('ignores an unknown stored mode', () => {
    const { S } = setup();
    (S as unknown as { lifeMode: string }).lifeMode = 'party';
    expect(modeOf(S)).toBe('normal');
  });
});

describe('priority season', () => {
  it('takes one to three main directions and a sane period, and creates nothing else', () => {
    const { S, A } = setup();
    const tasksBefore = S.tasks.length, goalsBefore = S.goals.length, needsBefore = S.needs.length;
    expect(A.setSeason({ from: '2026-11-20', to: '2026-11-30', main: [], support: [] })).toBe(false);
    expect(A.setSeason({ from: '2026-11-20', to: '2026-11-30', main: ['social', 'study', 'health', 'faith'], support: [] })).toBe(false);
    expect(A.setSeason({ from: '2026-11-30', to: '2026-11-20', main: ['social'], support: [] })).toBe(false);
    expect(S.season).toBeNull();
    expect(A.setSeason({ from: '2026-11-20', to: '2026-11-30', main: ['social', 'study'], support: ['business', 'social', 'health'], notes: { business: 'автоматизація та поточні клієнти', faith: 'не у списку' } })).toBe(true);
    expect(S.season!.main).toEqual(['social', 'study']);
    expect(S.season!.support).toEqual(['business', 'health']);
    expect(S.season!.notes).toEqual({ business: 'автоматизація та поточні клієнти' });
    expect(S.tasks).toHaveLength(tasksBefore); expect(S.goals).toHaveLength(goalsBefore); expect(S.needs).toHaveLength(needsBefore);
  });

  it('is active inside the period and, when it has ended, only offers a review that can be dismissed', () => {
    const { S, A } = setup();
    A.setSeason({ from: '2026-11-20', to: '2026-11-30', main: ['social'], support: [] });
    expect(seasonOn(S, '2026-11-25')).not.toBeNull();
    expect(seasonOn(S, '2026-12-01')).toBeNull();
    expect(seasonEnded(S, '2026-11-25')).toBeNull();
    expect(seasonEnded(S, '2026-12-01')).not.toBeNull();
    expect(seasonDaysLeft(S.season!, '2026-11-28')).toBe(3);
    const goals = S.goals.length;
    A.dismissSeason();
    expect(seasonEnded(S, '2026-12-01')).toBeNull();
    expect(S.goals).toHaveLength(goals);
  });

  it('turns the main directions into the needs they stand for', () => {
    const { S, A } = setup();
    A.setSeason({ from: TODAY, to: '2026-11-30', main: ['social'], support: ['business'] });
    const keys = seasonNeedKeys(S, TODAY);
    expect(keys.has('people')).toBe(true);
    expect(keys.has('income')).toBe(false);
    expect(validSeason({ from: TODAY, to: TODAY, main: ['health'] })).toBeNull();
  });
});

describe('rest without penalty', () => {
  it('puts aside only optional tasks, brings them back by themselves and by one tap', () => {
    const { S, A } = setup();
    task(S, 'важлива', 'hi'); task(S, 'зараз', 'lo', TODAY); task(S, 'потім', 'lo'); task(S, 'на тижні', 'lo', '2026-11-27');
    expect(optionalTasks(S, TODAY).map(t => t.t).sort()).toEqual(['на тижні', 'потім']);
    expect(A.snoozeOptional(3)).toBe(2);
    const later = S.tasks.find(t => t.t === 'потім')!;
    expect(later.snooze).toBe('2026-11-23');
    expect(isSnoozed(later, TODAY)).toBe(true);
    expect(isSnoozed(later, '2026-11-23')).toBe(false);
    expect(S.tasks.find(t => t.t === 'важлива')!.snooze).toBeUndefined();
    expect(S.tasks.find(t => t.t === 'зараз')!.snooze).toBeUndefined();
    A.unsnoozeAll();
    expect(S.tasks.every(t => !t.snooze)).toBe(true);
    expect(S.tasks.every(t => !t.d)).toBe(true);
  });

  it('says so, and does nothing, when there is nothing optional', () => {
    const { S, A, log } = setup();
    task(S, 'важлива', 'hi');
    expect(A.snoozeOptional()).toBe(0);
    expect(log.at(-1)).toMatch(/Немає/);
  });

  it('pauses goals and habits without deleting them', () => {
    const { S, A } = setup();
    A.addHabit('Читати');
    const h = S.habits[0];
    A.pauseHabit(h.id, true);
    expect(S.habits[0].paused).toBe(1);
    A.pauseHabit(h.id, false);
    expect(S.habits[0].paused).toBeUndefined();
    expect(S.habits).toHaveLength(1);
  });
});

describe('calm return and rest hints', () => {
  it('counts the days away and says nothing on the first visit', () => {
    expect(daysAway(null, TODAY)).toBeNull();
    expect(daysAway('garbage', TODAY)).toBeNull();
    expect(daysAway('2026-11-20', TODAY)).toBe(0);
    expect(daysAway('2026-11-14', TODAY)).toBe(6);
  });

  it('suggests an easier day only from what the person wrote, and never mentions illness', () => {
    const { S } = setup();
    expect(restHint(S, TODAY)).toBeNull();
    S.health[TODAY] = { water: 0, sleep: 4.5, mood: 0, steps: 0, workout: 0, weight: 0 };
    const h = restHint(S, TODAY);
    expect(h?.why).toMatch(/4\.5/);
    expect(h?.why).not.toMatch(/хвор|діагноз|депрес/i);
    S.health[TODAY].sleep = 8;
    expect(restHint(S, TODAY)).toBeNull();
    S.moods.push({ id: 1, t: new Date(TODAY + 'T09:00').getTime(), v: 5, energy: 1, tags: [], note: '' });
    expect(restHint(S, TODAY)).not.toBeNull();
  });
});

describe('weekly review', () => {
  it('suggests at most two changes and only from the words that were written', () => {
    const { S } = setup();
    expect(reviewIdeas(S, {})).toEqual([]);
    expect(reviewIdeas(S, { missing: 'усе добре', change: 'нічого' })).toEqual([]);
    const ideas = reviewIdeas(S, { missing: 'Бракувало людей, відпочинку і руху', change: 'менше навантаження' });
    expect(ideas.length).toBeLessThanOrEqual(2);
    expect(ideas[0].need).toBe(S.needs.find(n => n.key === 'people')!.id);
  });

  it('keeps the three answers and takes an idea once', () => {
    const { S, A } = setup();
    A.saveReviewAnswers('2026-11-16', { good: 'Зустріч із другом', missing: 'Сну', change: 'Раніше лягати' });
    const r = S.reviews['2026-11-16'];
    expect([r.good, r.missing, r.change]).toEqual(['Зустріч із другом', 'Сну', 'Раніше лягати']);
    const id = S.needs.find(n => n.key === 'rest')!.id;
    A.takeReviewIdea('2026-11-16', { id: 'need-' + id, need: id, text: '' });
    A.takeReviewIdea('2026-11-16', { id: 'need-' + id, need: id, text: '' });
    expect(r.focus).toEqual([id]);
    expect(r.accepted).toEqual(['need-' + id]);
  });
});

describe('private spaces and automation ideas', () => {
  it('stores feelings, memories, talk ideas and intentions only when the person writes them', () => {
    const { S, A } = setup();
    expect(S.anela.memories).toEqual([]);
    expect(A.addFeeling('   ')).toBe(false);
    expect(A.addFeeling('Сьогодні було легко', ['Радість'])).toBe(true);
    expect(A.addMemory({ date: '2026-10-01', title: '', text: 'x', thoughts: '' })).toBe(false);
    expect(A.addMemory({ date: '2026-10-01', title: 'Розмова біля річки', text: 'Було тепло', thoughts: '' })).toBe(true);
    A.addTalk('bs', 'Kako si?', 'Як ти?');
    A.addTalkMany([{ kind: 'bs', text: 'Kako si?' }, { kind: 'bs', text: 'Hvala lijepo' }]);
    expect(S.anela.talk.filter(t => t.text === 'Kako si?')).toHaveLength(1);
    expect(S.anela.talk).toHaveLength(2);
    A.addIntent('Не боятися починати розмову');
    A.pauseIntent(S.anela.intents[0].id, true);
    expect(S.anela.intents[0].paused).toBe(1);
    expect(S.anela.feelings).toHaveLength(1);
    expect(S.anela.memories).toHaveLength(1);
  });

  it('keeps an automation idea honest: unknown numbers stay zero', () => {
    const { S, A } = setup();
    expect(A.addAuto({ title: '  ' })).toBe(false);
    A.addAuto({ title: 'Рахунки клієнтам вручну' });
    const a = S.co.auto[0];
    expect([a.mins, a.perWeek, a.seen, a.status]).toEqual([0, 0, 1, 'idea']);
    A.seenAuto(a.id);
    A.updateAuto(a.id, { mins: 15, perWeek: 4, effort: 'low', priority: 'high' });
    expect([S.co.auto[0].seen, S.co.auto[0].mins, S.co.auto[0].perWeek]).toEqual([2, 15, 4]);
    A.updateAuto(a.id, { mins: -5, perWeek: 9999 });
    expect([S.co.auto[0].mins, S.co.auto[0].perWeek]).toEqual([0, 200]);
  });

  it('records a small social step without any target', () => {
    const { S, A } = setup();
    A.addExposure({ kind: 'start', note: 'Заговорив у черзі', felt: 2 });
    expect(S.exposure).toHaveLength(1);
    expect(S.exposure[0].felt).toBe(2);
    A.addSocialNote({ kind: 'idea', text: 'Піти на настолки' });
    expect(A.addSocialNote({ kind: 'idea', text: '  ' })).toBe(false);
    expect(S.socialNotes).toHaveLength(1);
  });
});
