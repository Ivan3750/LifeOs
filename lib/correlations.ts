import type { State } from './types';
import { dayMood, energyLevel, moodsOn, moveGoal, sleepRhythm, waterGoal } from './score';
import { addD, plural, sod, toMin, ymd } from './util';

/* Links between the areas of life, found in the person's own days.
   Every day becomes a row of numbers (sleep, water, movement, focus, habits, spending, events, rest, Wolt, stress, mood, energy).
   A curated list of «this → that» pairs is checked: the days are split into low and high for the driver (fixed norms for the body,
   the person's own thirds for everything else) and the outcome is compared. A link is reported only when both groups have enough days,
   the difference is large compared to the usual spread, and it holds as a trend too. */

export type Metric = 'sleep' | 'bed' | 'mood' | 'energy' | 'water' | 'workout' | 'focus' | 'habits' | 'spend' | 'tasks' | 'wolt' | 'events' | 'rest' | 'stress';
/** One day as numbers (null: nothing to say about that day). */
export type DayRow = { k: string } & Record<Metric, number | null>;

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => sum(a) / a.length;
const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const hhmm = (min: number) => (min >= 60 ? `${n1(min / 60)} год` : `${Math.round(min)} хв`);

const STRESS = ['Стрес', 'Тривога', 'Злість'];

/** The last `days` days up to today. A bedtime after midnight counts as 24:30, 25:00… so that 23:30 and 00:30 sit next to each other.
    Totals of a day (focus, spending, tasks…) are null before the first record of that kind, so days before tracking started do not count as zero. */
export function dayRows(S: State, days = 90, now = new Date()): DayRow[] {
  const keys = [...Array(days)].map((_, i) => ymd(addD(sod(now), i - days + 1)));
  const day = (t: number) => ymd(new Date(t));
  const by = <T,>(list: T[], at: (x: T) => string, val: (x: T) => number) => { const m = new Map<string, number>(); for (const x of list) m.set(at(x), (m.get(at(x)) || 0) + val(x)); return m; };
  const focus = by(S.sessions, s => day(s.t), s => s.m);
  const spend = by(S.money.tx.filter(t => t.type === 'out' && !t.xfer && !t.pot), t => t.date, t => (t.acc === 'ua' ? t.amt / (S.money.uahPerDkk || 1) : t.amt));
  const tasks = by(S.tasks.filter(t => t.d && t.doneAt), t => day(t.doneAt!), () => 1);
  const wolt = by(S.activities.filter(a => a.kind === 'Wolt'), a => day(a.start), a => (a.end - a.start) / 36e5);
  const rest = by(S.activities.filter(a => a.kind === 'Відпочинок' || a.kind === 'Спорт'), a => day(a.start), a => (a.end - a.start) / 6e4);
  const events = by(S.events, e => e.date, () => 1);
  const habitDays = by(S.habits.flatMap(h => Object.keys(h.days)), d => d, () => 1);
  const first = (m: Map<string, number>) => [...m.keys()].sort()[0] ?? '9999';
  const f = { focus: first(focus), spend: first(spend), tasks: first(tasks), wolt: first(wolt), rest: first(rest), events: first(events), habits: first(habitDays) };
  return keys.map(k => {
    const h = S.health[k], ms = moodsOn(S, k), en = ms.filter(m => m.energy > 0).map(m => energyLevel(m.energy) as number);
    const total = (m: Map<string, number>, from: string) => (k >= from ? m.get(k) || 0 : null);
    return {
      k,
      sleep: h && h.sleep > 0 ? h.sleep : null,
      bed: h?.bed ? (toMin(h.bed) < 12 * 60 ? toMin(h.bed) + 1440 : toMin(h.bed)) : null,
      mood: dayMood(S, k) || null,
      energy: en.length ? mean(en) : null,
      water: h && h.water > 0 ? h.water : null,
      workout: h ? h.workout : null,
      focus: total(focus, f.focus), spend: total(spend, f.spend), tasks: total(tasks, f.tasks), wolt: total(wolt, f.wolt), rest: total(rest, f.rest), events: total(events, f.events),
      habits: S.habits.length && k >= f.habits ? (habitDays.get(k) || 0) / S.habits.length : null,
      stress: ms.length ? (ms.some(m => m.tags.some(t => STRESS.includes(t))) ? 1 : 0) : null,
    } as DayRow;
  });
}

/** Spheres of life, as in the balance wheel (plus mood). */
export type Area = 'Здоровʼя' | 'Карʼєра' | 'Фінанси' | 'Друзі' | 'Відпочинок' | 'Розвиток' | 'Настрій';

type Split = { lowMax: number; highMin: number };
type Driver = {
  name: string; area: Area;
  /** fixed norms (the body); otherwise the person's own lower and upper third are compared */
  norm?: (S: State) => Split;
  low: (thr: number, S: State) => string; high: (thr: number, S: State) => string;
  more: string; less: string;
  /** known in the morning (sleep, bedtime): can be used on the same day; the rest of the day is not finished yet */
  morning?: boolean;
  /** only this side can be «the bad one»: a high mood or an absence of stress is never something to fix */
  onlyBad?: 'low' | 'high';
};
const DRIVERS: Partial<Record<Metric, Driver>> = {
  sleep: { name: 'Сон', area: 'Здоровʼя', onlyBad: 'low', morning: true, norm: () => ({ lowMax: 6.4, highMin: 7 }), low: () => 'ти спиш менше 6,5 години', high: () => 'ти спиш понад 9 годин', more: 'Спи 7–8 годин і лягай раніше.', less: 'Не пересипай: тримай 7–8 годин.' },
  bed: { name: 'Час відбою', area: 'Здоровʼя', onlyBad: 'high', morning: true, norm: () => ({ lowMax: 1440, highMin: 1470 }), low: () => 'лягаєш до півночі', high: () => 'лягаєш після 00:30', more: 'Лягай не пізніше за звичний час.', less: 'Лягай до півночі.' },
  water: { name: 'Вода', area: 'Здоровʼя', onlyBad: 'low', norm: S => ({ lowMax: waterGoal(S) * 0.5, highMin: waterGoal(S) * 0.8 }), low: (_t, S) => `п’єш менше половини денної цілі води (${waterGoal(S) / 2} склянок)`, high: () => 'п’єш достатньо води', more: 'Пий воду рівномірно протягом дня.', less: 'Не заливайся водою: тримай свою норму.' },
  workout: { name: 'Рух', area: 'Здоровʼя', onlyBad: 'low', norm: S => ({ lowMax: 0, highMin: Math.min(20, moveGoal(S) * 0.7) }), low: () => 'у тебе день без жодного руху', high: t => `ти рухаєшся понад ${Math.round(t)} хв`, more: 'Додай хоча б 20 хвилин ходьби чи зарядки.', less: 'Дай тілу відновитись після великих навантажень.' },
  focus: { name: 'Фокус', area: 'Карʼєра', low: t => `фокусу менше ${hhmm(t)}`, high: t => `фокус триває понад ${hhmm(t)}`, more: 'Тримай щодня мінімум фокусу: це піднімає тонус.', less: 'Не перевантажуй день: роби перерви й ділі фокус на кілька сесій.' },
  tasks: { name: 'Закриті задачі', area: 'Карʼєра', low: t => `закриваєш менше ${Math.max(1, Math.ceil(t))} ${plural(Math.ceil(t) || 1, 'задачі', 'задач', 'задач')} за день`, high: t => `закриваєш понад ${Math.floor(t)} ${plural(Math.floor(t), 'задачу', 'задачі', 'задач')} за день`, more: 'Закривай хоча б кілька дрібних задач щодня.', less: 'Не бери на день забагато задач: лишай запас.' },
  wolt: { name: 'Wolt', area: 'Карʼєра', onlyBad: 'high', low: () => 'ти без змін Wolt', high: t => `ти їздиш на Wolt понад ${n1(t)} год`, more: 'Не віддавай усі дні доставці: лишай час на себе.', less: 'Став зміни Wolt так, щоб лишався час на сон і відпочинок.' },
  habits: { name: 'Звички', area: 'Розвиток', onlyBad: 'low', low: t => `виконуєш менше ${Math.round(t * 100)}% звичок`, high: t => `виконуєш понад ${Math.round(t * 100)}% звичок`, more: 'Виконуй звички, хай навіть у спрощеному вигляді.', less: 'Не женись за всіма звичками одразу.' },
  spend: { name: 'Витрати', area: 'Фінанси', onlyBad: 'high', low: t => `витрачаєш менше ${Math.round(t)} kr. за день`, high: t => `витрачаєш понад ${Math.round(t)} kr. за день`, more: 'Не економ до стресу: став собі розумний бюджет.', less: 'Постав ліміт на день і лишай запас до кінця місяця.' },
  events: { name: 'Події в розкладі', area: 'Друзі', low: () => 'у розкладі немає подій', high: t => `у розкладі понад ${Math.floor(t)} ${plural(Math.floor(t), 'подія', 'події', 'подій')}`, more: 'Плануй живі зустрічі: вони піднімають настрій.', less: 'Лишай у розкладі вільні вікна між подіями.' },
  rest: { name: 'Відпочинок і спорт', area: 'Відпочинок', onlyBad: 'low', low: () => 'у тебе немає відпочинку чи спорту', high: t => `відпочинок і спорт тривають понад ${hhmm(t)}`, more: 'Заплануй відпочинок у розкладі як справу.', less: 'Не заміщуй відпочинком усе: тримай баланс.' },
  stress: { name: 'Стрес', area: 'Настрій', onlyBad: 'high', low: () => 'у записах немає стресу', high: () => 'у записах є стрес, тривога чи злість', more: '', less: 'Знайди, що саме викликає стрес, запиши це в нотатку й зроби коротку прогулянку.' },
  mood: { name: 'Настрій', area: 'Настрій', onlyBad: 'low', low: t => `настрій нижчий за ${n1(t)}`, high: t => `настрій вищий за ${n1(t)}`, more: 'Коли настрій низький, роби дрібну приємну справу та лягай вчасно.', less: '' },
};

type Outcome = { name: string; area: Area; min: number; better: 1 | -1; fmt: (v: number) => string; next: string };
const OUTCOMES: Partial<Record<Metric, Outcome>> = {
  mood: { name: 'настрій', area: 'Настрій', min: 0.7, better: 1, fmt: v => `${n1(v)} з 10`, next: 'наступного дня' },
  energy: { name: 'енергія', area: 'Настрій', min: 0.25, better: 1, fmt: v => `${n1(v)} із 3`, next: 'наступного дня' },
  focus: { name: 'фокус', area: 'Карʼєра', min: 20, better: 1, fmt: v => hhmm(v), next: 'наступного дня' },
  habits: { name: 'виконання звичок', area: 'Розвиток', min: 0.15, better: 1, fmt: v => `${Math.round(v * 100)}%`, next: 'наступного дня' },
  sleep: { name: 'сон', area: 'Здоровʼя', min: 0.5, better: 1, fmt: v => `${n1(v)} год`, next: 'тієї ночі' },
  spend: { name: 'витрати', area: 'Фінанси', min: 12, better: -1, fmt: v => `${Math.round(v)} kr.`, next: 'наступного дня' },
};

/** The pairs that make sense to check: driver, outcome, and whether the driver of the previous day is used. */
const PAIRS: [Metric, Metric, 0 | 1][] = [
  ['sleep', 'mood', 0], ['sleep', 'energy', 0], ['sleep', 'focus', 0], ['bed', 'mood', 0], ['bed', 'energy', 0],
  ['water', 'mood', 0], ['water', 'energy', 0], ['workout', 'mood', 1], ['workout', 'energy', 1], ['workout', 'sleep', 1],
  ['focus', 'sleep', 1], ['focus', 'energy', 1], ['focus', 'mood', 1], ['tasks', 'mood', 0], ['wolt', 'energy', 1], ['wolt', 'focus', 1], ['wolt', 'sleep', 1],
  ['habits', 'mood', 0], ['habits', 'energy', 1], ['spend', 'mood', 1], ['mood', 'spend', 1], ['events', 'mood', 0], ['events', 'energy', 0],
  ['rest', 'mood', 1], ['rest', 'energy', 1], ['stress', 'sleep', 1], ['stress', 'focus', 0], ['mood', 'sleep', 1], ['mood', 'focus', 1],
];

export type Finding = {
  id: string; driver: Metric; outcome: Metric; lag: 0 | 1;
  /** the half of the days that goes worse (the driver is low or high there), and the other half */
  badSide: 'low' | 'high'; thr: number;
  bad: { n: number; avg: number }; good: { n: number; avg: number };
  /** how much better the outcome is in the good half, in its own units (always positive) */
  diff: number; effect: number; strength: 1 | 2 | 3;
  /** legacy names used by the screens: factor and target are the driver and the outcome */
  factor: Metric; target: Metric;
};

const MIN_PAIRS = 14, MIN_GROUP = 4, MIN_EFFECT = 0.85, MIN_R = 0.3;
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))];
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const corr = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); let a = 0, bx = 0, by = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); bx += (x - mx) ** 2; by += (ys[i] - my) ** 2; }); return bx && by ? a / Math.sqrt(bx * by) : 0; };

/** Ways to split a driver's values into a low and a high half, best first: the body's fixed norms, the person's own lower and upper third,
    then, when most days look the same (a habit done or not, events present or not), the usual day against the days that stand out. */
function splits(dr: Driver, vals: number[], S: State): Split[] {
  if (dr.norm) return [dr.norm(S)];
  const s = [...vals].sort((a, b) => a - b), lo = pct(s, 1 / 3), hi = pct(s, 2 / 3), mid = s[Math.floor(s.length / 2)];
  const out: Split[] = [];
  if (hi > lo) out.push({ lowMax: lo, highMin: hi });
  const below = s.filter(v => v < mid), above = s.filter(v => v > mid);
  if (below.length) out.push({ lowMax: Math.max(...below), highMin: mid });
  if (above.length) out.push({ lowMax: mid, highMin: Math.min(...above) });
  return out;
}

/** Every link between two areas of life that the person's own history supports, strongest first. */
export function findings(S: State, now = new Date()): Finding[] {
  // today is not finished, so only complete days are compared
  const rows = dayRows(S, 90, now).slice(0, -1), out: Finding[] = [];
  for (const [d, o, lag] of PAIRS) {
    const dr = DRIVERS[d]!, oc = OUTCOMES[o]!;
    const pairs: [number, number][] = [];
    rows.forEach((r, i) => { const f = rows[i - lag], y = r[o], x = f?.[d]; if (x != null && y != null) pairs.push([x, y]); });
    if (pairs.length < MIN_PAIRS) continue;
    let sp: Split | null = null, lowY: number[] = [], highY: number[] = [];
    for (const c of splits(dr, pairs.map(p => p[0]), S)) {
      const l = pairs.filter(p => p[0] <= c.lowMax).map(p => p[1]), h = pairs.filter(p => p[0] >= c.highMin).map(p => p[1]);
      if (l.length >= MIN_GROUP && h.length >= MIN_GROUP) { sp = c; lowY = l; highY = h; break; }
    }
    if (!sp) continue;
    const all = pairs.map(p => p[1]), spread = sd(all) || 1;
    const lowAvg = mean(lowY), highAvg = mean(highY), gain = (highAvg - lowAvg) * oc.better;   // >0: the high half goes better
    const diff = Math.abs(highAvg - lowAvg), effect = diff / spread;
    if (diff < oc.min || effect < MIN_EFFECT) continue;
    const r = corr(pairs.map(p => p[0]), all);
    if (Math.abs(r) < MIN_R || Math.sign(r) !== Math.sign(highAvg - lowAvg)) continue;
    const badSide: 'low' | 'high' = gain > 0 ? 'low' : 'high';
    if (dr.onlyBad && dr.onlyBad !== badSide) continue;
    const bad = badSide === 'low' ? { n: lowY.length, avg: lowAvg } : { n: highY.length, avg: highAvg }, good = badSide === 'low' ? { n: highY.length, avg: highAvg } : { n: lowY.length, avg: lowAvg };
    out.push({ id: `${d}-${o}`, driver: d, outcome: o, factor: d, target: o, lag, badSide, thr: badSide === 'low' ? sp.lowMax : sp.highMin, bad, good, diff, effect, strength: effect >= 1.4 ? 3 : effect >= 1.1 ? 2 : 1 });
  }
  return out.sort((a, b) => b.effect - a.effect);
}

/** A plain sentence about one finding, with the numbers from the person's own days. */
export function describe(f: Finding, S?: State) {
  const dr = DRIVERS[f.driver]!, oc = OUTCOMES[f.outcome]!, st = S || ({} as State);
  const phrase = f.badSide === 'low' ? dr.low(f.thr, st) : dr.high(f.thr, st);
  const lead = f.lag === 1 ? `Після дня, коли ${phrase}` : `Коли ${phrase}`;
  return {
    title: `${dr.name} → ${oc.name}`, area: dr.area, outArea: oc.area,
    text: `${lead}, ${oc.name} ${f.lag === 1 ? oc.next + ' ' : ''}у тебе в середньому ${oc.fmt(f.bad.avg)} проти ${oc.fmt(f.good.avg)} в інші дні. Це видно з ${f.bad.n} таких днів проти ${f.good.n}.`,
    advice: (f.badSide === 'low' ? dr.more : dr.less) || dr.more || dr.less,
  };
}

export type Advice = {
  tone: 'warn' | 'good'; title: string;
  /** the sphere of life the advice is about */
  area: Area;
  /** why: what was logged and what the history says about days like this */
  reason: string; action: string;
  /** one-line cause for a notification */
  cause: string;
  /** numbers behind the advice, shown as small chips */
  facts: string[];
  task?: string;
  /** the mood is what is affected (used to explain a low mood) */
  forMood?: boolean;
};

/** The value of a driver that matters for the outcome of today: today's for what is known in the morning, otherwise yesterday's. */
const relevant = (f: Finding, rows: DayRow[]) => { const dr = DRIVERS[f.driver]!, i = rows.length - 1 - (f.lag === 1 ? 1 : 0); return f.lag === 0 && !dr.morning ? null : rows[i]?.[f.driver] ?? null; };

/** What to do today, as a few pieces of advice from different areas, the most convincing first.
    Poor sleep comes first: tonight's sleep is the one thing that can still be changed today. */
export function adviceList(S: State, now = new Date()): Advice[] {
  const rows = dayRows(S, 90, now), today = rows[rows.length - 1], yday = rows[rows.length - 2], fs = findings(S, now);
  const out: Advice[] = [];
  const sleepMood = fs.find(f => f.id === 'sleep-mood'), sleepEnergy = fs.find(f => f.id === 'sleep-energy');
  const wake = sleepRhythm(S).wake ?? toMin(S.dayStart), bed = hm((wake - 450 + 1440) % 1440);
  const nights = [today.sleep, yday?.sleep].filter((v): v is number => v !== null);
  const poor = today.sleep !== null && today.sleep < 6.5, debt = !poor && nights.length === 2 && mean(nights) < 6.5;
  const moodNow = today.mood, lowMood = moodNow !== null && moodNow <= 5;

  if (poor || debt) {
    const s = poor ? today.sleep! : mean(nights), facts = [poor ? `сон ${n1(s)} год` : `дві ночі по ${n1(s)} год`];
    let reason = poor ? `Ти спав ${n1(s)} год, це менше за норму 7–8.` : `Дві останні ночі ти спав у середньому ${n1(s)} год: недосип накопичується.`;
    if (sleepMood) { const d = describe(sleepMood, S); reason += ` Твоя історія на це вказує: ${d.text.charAt(0).toLowerCase()}${d.text.slice(1)}`; facts.push(`настрій ${n1(sleepMood.bad.avg)} проти ${n1(sleepMood.good.avg)}`); }
    else reason += ' Недосип знижує настрій, енергію і концентрацію, хоч у твоїх записах ще замало днів для точної закономірності.';
    if (sleepEnergy) facts.push(`енергія ${n1(sleepEnergy.bad.avg)} проти ${n1(sleepEnergy.good.avg)}`);
    if (lowMood) { reason += ` Сьогоднішній настрій ${n1(moodNow!)} із 10: схоже, це відлуння недосипу.`; facts.push(`настрій сьогодні ${n1(moodNow!)}`); }
    out.push({ tone: 'warn', area: 'Здоровʼя', title: 'Сьогодні вирівняй сон', reason, facts, action: `Лягти спати до ${bed}: так вийде 7,5 години до звичного підйому о ${hm(wake)}.`, cause: `недосип (${n1(s)} год сну)`, task: `Лягти спати до ${bed}`, forMood: true });
  }

  // every other link whose bad half applies to today (or to yesterday, for next-day effects)
  const used = new Set<string>(out.length ? ['sleep', 'bed'] : []);
  for (const f of fs) {
    if (used.has(f.driver) || (f.driver === 'sleep' && out.length)) continue;
    const v = relevant(f, rows);
    if (v === null) continue;
    const dr = DRIVERS[f.driver]!, oc = OUTCOMES[f.outcome]!;
    const inBad = f.badSide === 'low' ? v <= f.thr : v >= f.thr;
    if (!inBad) continue;
    const d = describe(f, S), when = f.lag === 1 ? 'Вчора' : 'Сьогодні';
    const task = taskFor(f);
    used.add(f.driver);
    out.push({
      tone: 'warn', area: dr.area, title: adviceTitle(f), forMood: f.outcome === 'mood',
      reason: `${when}: ${dr.name.toLowerCase()} ${valueText(f.driver, v)}. ${d.text}`,
      facts: [`${dr.name.toLowerCase()}: ${valueText(f.driver, v)}`, `${oc.name} ${oc.fmt(f.bad.avg)} проти ${oc.fmt(f.good.avg)}`],
      action: d.advice, cause: causeText(f, v), ...(task ? { task } : {}),
    });
  }
  // a good night, when the history shows that sleep matters
  if (!out.length && today.sleep !== null && today.sleep >= 7 && sleepMood) out.push({ tone: 'good', area: 'Здоровʼя', title: 'Сон у нормі', reason: `Ти спав ${n1(today.sleep)} год. У такі ночі твій настрій у середньому ${n1(sleepMood.good.avg)}, а після короткого сну лише ${n1(sleepMood.bad.avg)}.`, action: 'Так тримати: використай цей запас енергії для найважливішої задачі.', facts: [`сон ${n1(today.sleep)} год`, `настрій ${n1(sleepMood.good.avg)} проти ${n1(sleepMood.bad.avg)}`], cause: '' });
  return out.slice(0, 3);
}

/** The first piece of advice (kept for the places that need just one). */
export const todayAdvice = (S: State, now = new Date()): Advice | null => adviceList(S, now)[0] ?? null;

/** The most likely reason for a low mood today, as a short phrase, or null. */
export function moodCause(S: State, now = new Date()): Advice | null {
  const list = adviceList(S, now);
  return list.find(a => a.forMood && a.cause) ?? list.find(a => a.cause) ?? null;
}

function valueText(m: Metric, v: number) {
  switch (m) {
    case 'sleep': return `${n1(v)} год`; case 'bed': return hm(v); case 'water': return `${Math.round(v)} склянок`; case 'workout': return v ? `${Math.round(v)} хв` : 'без руху';
    case 'focus': case 'rest': return hhmm(v); case 'tasks': return `${Math.round(v)}`; case 'wolt': return `${n1(v)} год`; case 'habits': return `${Math.round(v * 100)}%`;
    case 'spend': return `${Math.round(v)} kr.`; case 'events': return `${Math.round(v)}`; case 'stress': return v ? 'був' : 'не було'; default: return n1(v);
  }
}
const adviceTitle = (f: Finding) => ({
  water: 'Випий води', workout: 'Додай трохи руху', bed: 'Лягай раніше', focus: f.badSide === 'high' ? 'Не перевантажуй себе' : 'Знайди час на фокус', tasks: f.badSide === 'high' ? 'Не бери забагато задач' : 'Закрий кілька задач', wolt: 'Бережи себе від перевтоми',
  habits: 'Повернись до звичок', spend: 'Притримай витрати', events: f.badSide === 'high' ? 'Дай собі паузу від подій' : 'Побачся з кимось', rest: 'Заплануй відпочинок', stress: 'Зніми напругу', mood: 'Підтримай себе', sleep: 'Подбай про сон',
} as Record<Metric, string>)[f.driver];
const causeText = (f: Finding, v: number) => ({
  water: 'мало води', workout: 'вчора без руху', bed: 'пізній відбій', focus: f.badSide === 'high' ? `багато фокусу вчора (${valueText('focus', v)})` : 'мало фокусу', tasks: 'мало закритих задач', wolt: `довга зміна Wolt (${n1(v)} год)`,
  habits: 'пропущені звички', spend: `великі витрати вчора (${Math.round(v)} kr.)`, events: f.badSide === 'high' ? 'забагато подій' : 'мало спілкування', rest: 'не було відпочинку', stress: 'вчорашній стрес', mood: 'вчорашній настрій', sleep: 'мало сну',
} as Record<Metric, string>)[f.driver];
const taskFor = (f: Finding) => ({ water: 'Випити склянку води', workout: 'Пройтися 20 хвилин', habits: 'Виконати одну звичку', rest: 'Запланувати відпочинок', events: f.badSide === 'low' ? 'Написати другові' : undefined } as Partial<Record<Metric, string | undefined>>)[f.driver];
