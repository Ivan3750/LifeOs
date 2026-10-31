import type { State, UiEvent } from './types';
import { dayMood, energyLevel, moodsOn, waterGoal, moveGoal, isWorkDay } from './score';
import { clock, sleepStability } from './sleep';
import { socialGoal, socialOn, socialPeriod } from './social';
import { classify } from './timeuse';
import { goalProgress } from './goals';
import { budgetDKK, fmtCur, monthOf, txDKK } from './money';
import { addD, daysInMonth, hmPlain, plural, sod, toMin, ymd } from './util';

/* The advice system. Every day becomes a row of numbers from all parts of the app (sleep, bedtime, mood, tasks, focus, habits, social media,
   events, goals, business…). A curated list of «this → that» pairs is tested on the person's own days: is there a clear trend in the expected
   direction? Links that hold are joined into chains (short sleep → slower tasks → later bedtime → worse mood tomorrow). Today's state is then
   matched against them to say what to do and why. Besides this, plain rules watch deadlines, overdue things, pace and balance. */

export type Metric = 'sleep' | 'bedTonight' | 'mood' | 'energy' | 'stress' | 'focus' | 'taskPace' | 'tasks' | 'habits' | 'water' | 'workout' | 'social' | 'lateWork' | 'goalMin' | 'bizMin' | 'load' | 'people' | 'spend';
export type Row = { k: string } & Record<Metric, number | null>;
export type Area = 'Сон і тіло' | 'Настрій' | 'Робота й бізнес' | 'Цілі й розвиток' | 'Увага й час' | 'Гроші' | 'Люди';

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const min = (m: number) => (m >= 60 ? `${n1(m / 60)} год` : `${Math.round(m)} хв`);
const STRESS = ['Стрес', 'Тривога', 'Злість'];

/** How each number is shown and which direction is better (0: neither). */
export const METRICS: Record<Metric, { name: string; fmt: (v: number) => string; better: 1 | -1 | 0; area: Area }> = {
  sleep: { name: 'сон', fmt: v => `${n1(v)} год`, better: 1, area: 'Сон і тіло' },
  bedTonight: { name: 'час засинання', fmt: v => clock(v), better: -1, area: 'Сон і тіло' },
  mood: { name: 'настрій', fmt: v => `${n1(v)}/10`, better: 1, area: 'Настрій' },
  energy: { name: 'енергія', fmt: v => `${n1(v)} з 3`, better: 1, area: 'Настрій' },
  stress: { name: 'стрес', fmt: v => (v >= 0.5 ? 'є' : 'нема'), better: -1, area: 'Настрій' },
  focus: { name: 'фокус', fmt: min, better: 1, area: 'Робота й бізнес' },
  taskPace: { name: 'час на задачу', fmt: v => `${Math.round(v)} хв фокусу на задачу`, better: -1, area: 'Робота й бізнес' },
  tasks: { name: 'закриті задачі', fmt: v => `${n1(v)} задач`, better: 1, area: 'Робота й бізнес' },
  habits: { name: 'звички', fmt: v => `${Math.round(v * 100)}%`, better: 1, area: 'Цілі й розвиток' },
  water: { name: 'вода', fmt: v => `${n1(v)} склянок`, better: 1, area: 'Сон і тіло' },
  workout: { name: 'рух', fmt: min, better: 1, area: 'Сон і тіло' },
  social: { name: 'соцмережі', fmt: min, better: -1, area: 'Увага й час' },
  lateWork: { name: 'робота пізно ввечері', fmt: min, better: -1, area: 'Увага й час' },
  goalMin: { name: 'час на цілі', fmt: min, better: 1, area: 'Цілі й розвиток' },
  bizMin: { name: 'час на бізнес', fmt: min, better: 1, area: 'Робота й бізнес' },
  load: { name: 'зайнятість подіями', fmt: min, better: -1, area: 'Увага й час' },
  people: { name: 'живе спілкування', fmt: min, better: 1, area: 'Люди' },
  spend: { name: 'витрати', fmt: v => `${Math.round(v)} kr.`, better: -1, area: 'Гроші' },
};

/** The last `days` days. Totals are null before the first record of that kind, so days before tracking are not counted as zeros.
    bedTonight is the bedtime of the evening that follows the day (it is logged on the next day). A bedtime after midnight is 24:30, 25:00…. */
export function coachRows(S: State, eventsOn: (k: string) => UiEvent[], days = 60, now = new Date()): Row[] {
  const keys = [...Array(days)].map((_, i) => ymd(addD(sod(now), i - days + 1)));
  const day = (t: number) => ymd(new Date(t));
  const by = <T,>(list: T[], at: (x: T) => string, val: (x: T) => number) => { const m = new Map<string, number>(); for (const x of list) m.set(at(x), (m.get(at(x)) || 0) + val(x)); return m; };
  const focus = by(S.sessions, s => day(s.t), s => s.m);
  const goalMin = by(S.sessions.filter(s => s.task && S.tasks.some(t => t.t === s.task && t.goal)), s => day(s.t), s => s.m);
  // work that was started or ended late in the evening (after 21:30)
  const late = new Map<string, number>();
  const addLate = (a: number, b: number) => { const d0 = sod(a).getTime(), from = d0 + (21 * 60 + 30) * 6e4; const m = Math.max(0, Math.min(b, d0 + 864e5) - Math.max(a, from)) / 6e4; if (m > 0) late.set(day(a), (late.get(day(a)) || 0) + m); };
  S.sessions.forEach(s => addLate(s.t, s.t + s.m * 6e4));
  S.activities.filter(a => a.kind === 'Бізнес').forEach(a => addLate(a.start, a.end));
  const bizAct = by(S.activities.filter(a => a.kind === 'Бізнес'), a => day(a.start), a => (a.end - a.start) / 6e4);
  const tasks = by(S.tasks.filter(t => t.d && t.doneAt), t => day(t.doneAt!), () => 1);
  const spend = by(S.money.tx.filter(t => t.type === 'out' && !t.xfer && !t.pot), t => t.date, t => txDKK(S, t));
  const habitDays = by(S.habits.flatMap(h => Object.keys(h.days)), d => d, () => 1);
  const first = (m: Map<string, number>) => [...m.keys()].sort()[0] ?? '9999';
  const f = { focus: first(focus), tasks: first(tasks), spend: first(spend), habits: first(habitDays) };
  const rows = keys.map(k => {
    const h = S.health[k], ms = moodsOn(S, k), en = ms.filter(m => m.energy > 0).map(m => energyLevel(m.energy) as number);
    const evs = eventsOn(k).filter(e => e.act === undefined && !e.allDay);
    const evMin = (e: UiEvent) => Math.max(0, toMin(e.e) - toMin(e.s));
    const total = (m: Map<string, number>, from: string) => (k >= from ? m.get(k) || 0 : null);
    const fo = total(focus, f.focus), tk = total(tasks, f.tasks), so = S.social.some(x => x.date === k) ? socialOn(S, k).total : null;
    return {
      k, sleep: h && h.sleep > 0 ? h.sleep : null, bedTonight: null, mood: dayMood(S, k) || null, energy: en.length ? mean(en) : null,
      stress: ms.length ? (ms.some(m => m.tags.some(t => STRESS.includes(t))) ? 1 : 0) : null,
      focus: fo, tasks: tk, taskPace: fo && tk ? fo / tk : null, water: h && h.water > 0 ? h.water : null, workout: h ? h.workout : null,
      habits: S.habits.length && k >= f.habits ? (habitDays.get(k) || 0) / S.habits.length : null,
      social: so, lateWork: fo !== null ? late.get(k) || 0 : null, goalMin: fo !== null ? goalMin.get(k) || 0 : null,
      bizMin: S.co.deals.length + S.co.invoices.length > 0 || S.activities.some(a => a.kind === 'Бізнес') ? (bizAct.get(k) || 0) + evs.filter(e => classify(S, e.title).cat === 'biz').reduce((a, e) => a + evMin(e), 0) : null,
      load: evs.length ? evs.reduce((a, e) => a + evMin(e), 0) : (S.events.length || k < ymd(now) ? 0 : null),
      people: evs.filter(e => classify(S, e.title).cat === 'people').reduce((a, e) => a + evMin(e), 0) || (S.events.length ? 0 : null),
      spend: total(spend, f.spend),
    } as Row;
  });
  // the bedtime that follows a day is logged on the next one
  rows.forEach((r, i) => {
    const b = S.health[keys[i + 1]]?.bed;
    r.bedTonight = b ? (toMin(b) < 12 * 60 ? toMin(b) + 1440 : toMin(b)) : null;
  });
  return rows;
}

/** One «this → that» pair worth testing. h: +1 if more of the driver should help the outcome, −1 if more should hurt it.
    why: the reason, in plain words. fix: what to do when the driver is on its bad side. */
type Pair = { d: Metric; o: Metric; lag: 0 | 1; h: 1 | -1; why: string; fix: string };
const PAIRS: Pair[] = [
  { d: 'sleep', o: 'mood', lag: 0, h: 1, why: 'Недосип послаблює ту частину мозку, що гальмує емоції: дрібниці дратують сильніше, а гарні події радують менше.', fix: 'Лягай так, щоб спати 7–8 годин.' },
  { d: 'sleep', o: 'energy', lag: 0, h: 1, why: 'Сон відновлює запас сил на день: коли його мало, сил не вистачає вже зранку.', fix: 'Дай собі 7–8 годин сну й лягай до 00:00.' },
  { d: 'sleep', o: 'taskPace', lag: 0, h: 1, why: 'Після короткого сну гірше працює увага й робоча памʼять, тому на ту саму задачу йде більше часу й більше відволікань.', fix: 'Якщо спав мало, бери простіші задачі й не плануй складного на день.' },
  { d: 'sleep', o: 'focus', lag: 0, h: 1, why: 'Втомлений мозок швидко втрачає здатність тримати увагу, тож глибокий фокус стає коротшим.', fix: 'Не відкладай сон заради роботи: годину сну отримуєш назад фокусом.' },
  { d: 'sleep', o: 'social', lag: 0, h: 1, why: 'Коли не вистачає сил, мозок шукає легкої дофамінової винагороди, тому скрол затягує сильніше.', fix: 'Після недосипу заздалегідь постав ліміт на Instagram і YouTube.' },
  { d: 'sleep', o: 'bedTonight', lag: 0, h: 1, why: 'Після недосипу зʼявляється «другий вітер» уночі, до цього додаються кава і скрол, і лягаєш пізніше. Так виходить замкнене коло: пізній відбій → недосип → пізній відбій.', fix: 'Після короткої ночі лягай раніше, ніж звичайно, навіть якщо не хочеться. Це розриває коло.' },
  { d: 'bedTonight', o: 'mood', lag: 1, h: -1, why: 'Пізній відбій скорочує глибокий сон і зсуває добовий ритм, тому наступного дня настрій нижчий.', fix: 'Лягай не пізніше за ціль: вона вже закладена в налаштуваннях сну.' },
  { d: 'bedTonight', o: 'energy', lag: 1, h: -1, why: 'Ранок настає в один і той самий час, а сон скоротився, тому енергії менше.', fix: 'Лягай до 00:00 і прокидайся в один час.' },
  { d: 'bedTonight', o: 'focus', lag: 1, h: -1, why: 'Короткий і пізній сон знижує здатність довго концентруватися наступного дня.', fix: 'Заплануй складну роботу на ранок після повноцінного сну, а ввечері став «стоп».' },
  { d: 'bedTonight', o: 'sleep', lag: 1, h: -1, why: 'Прокидатися доводиться в одну годину, тому чим пізніше лягаєш, тим менше спиш наступної ночі.', fix: 'Лягай в один і той самий час.' },
  { d: 'lateWork', o: 'bedTonight', lag: 0, h: -1, why: 'Робота після 21:30 тримає мозок збудженим: заснути одразу не виходить, вимкнення затягується.', fix: 'Закінчуй роботу за 40 хв до сну, а складні завдання переноси на ранок.' },
  { d: 'lateWork', o: 'sleep', lag: 1, h: -1, why: 'Пізня робота зсуває засинання, тому сну лишається менше.', fix: 'Став жорсткий «стоп» для роботи ввечері.' },
  { d: 'taskPace', o: 'bedTonight', lag: 0, h: -1, why: 'Коли задачі йдуть повільно, роботу доводиться дотягувати вечором, і сон зсувається.', fix: 'Заплануй менше задач на день і лиши запас часу.' },
  { d: 'social', o: 'mood', lag: 0, h: -1, why: 'Довгий скрол ведуть до порівняння з чужим успіхом: чужі гроші, результати, «AI замінить усіх». Власне життя на цьому тлі здається гіршим.', fix: 'Тримайся лімітів Instagram і YouTube, а коли ловиш себе на порівнянні, закрий застосунок і зроби крок до своєї цілі.' },
  { d: 'social', o: 'focus', lag: 0, h: -1, why: 'Кожне перемикання на стрічку розриває увагу, і на повернення в роботу йде кілька хвилин.', fix: 'Вимикай сповіщення й відкривай соцмережі лише після першого блоку фокусу.' },
  { d: 'social', o: 'bedTonight', lag: 0, h: -1, why: 'Яскравий екран і короткі відео вечором відкладають засинання.', fix: 'Прибери Instagram і YouTube за годину до сну.' },
  { d: 'social', o: 'tasks', lag: 0, h: -1, why: 'Час на стрічку забирає час у задач, і менше з них доходить до кінця.', fix: 'Став задачі на першу половину дня, а скрол залиш на вечір у межах ліміту.' },
  { d: 'workout', o: 'mood', lag: 0, h: 1, why: 'Рух підвищує серотонін і дофамін та знімає напругу, тому настрій краще того самого дня.', fix: 'Хоча б 20 хвилин ходьби щодня.' },
  { d: 'workout', o: 'sleep', lag: 1, h: 1, why: 'Фізичне навантаження вдень збільшує глибокий сон уночі.', fix: 'Рухайся вдень, не пізно ввечері.' },
  { d: 'water', o: 'energy', lag: 0, h: 1, why: 'Навіть легке зневоднення знижує пильність і додає втоми.', fix: 'Випивай склянку води одразу після сну й розтягни норму на день.' },
  { d: 'water', o: 'focus', lag: 0, h: 1, why: 'Мозок чутливий до нестачі води: концентрація падає раніше за відчуття спраги.', fix: 'Став склянку води поруч із робочим місцем.' },
  { d: 'habits', o: 'mood', lag: 0, h: 1, why: 'Виконані звички дають відчуття контролю й послідовності, а це підтримує настрій.', fix: 'Роби звичку хоча б у мінімальному вигляді, щоб день не «пропав».' },
  { d: 'habits', o: 'focus', lag: 0, h: 1, why: 'Ранкові звички включають режим дня, і далі легше сісти за складне.', fix: 'Став ключові звички на ранок, перед роботою.' },
  { d: 'focus', o: 'mood', lag: 0, h: 1, why: 'Відчуття, що зробив головне, знімає тривогу й піднімає настрій на решту дня.', fix: 'Почни з одного блоку фокусу вранці, перш ніж відкривати стрічки.' },
  { d: 'tasks', o: 'mood', lag: 0, h: 1, why: 'Закриті задачі прибирають «відкриті петлі» в голові, тому стає спокійніше.', fix: 'Закрий хоча б одну маленьку задачу зранку.' },
  { d: 'goalMin', o: 'mood', lag: 0, h: 1, why: 'Рух до власної цілі повертає відчуття сенсу: це протилежність порівнянню з чужими результатами.', fix: 'Щодня роби хоча б 20 хвилин для цілі.' },
  { d: 'load', o: 'mood', lag: 0, h: -1, why: 'Коли день забитий подіями, немає буфера: поспіх накопичує напругу.', fix: 'Лишай між подіями паузи й не став більше 3–4 довгих подій на день.' },
  { d: 'load', o: 'focus', lag: 0, h: -1, why: 'Події ріжуть день на шматки, у яких коротко для глибокої роботи.', fix: 'Збирай події в один блок, а решту дня бережи під фокус.' },
  { d: 'load', o: 'bedTonight', lag: 0, h: -1, why: 'Завантажений день відсуває роботу на вечір, і засинання зсувається.', fix: 'У дні з багатьма подіями зменшуй план задач.' },
  { d: 'people', o: 'mood', lag: 0, h: 1, why: 'Живе спілкування знижує стрес краще за будь-який скрол.', fix: 'Заплануй хоча б одну живу зустріч на тиждень.' },
  { d: 'stress', o: 'sleep', lag: 1, h: -1, why: 'Стрес підвищує кортизол увечері, і заснути важче.', fix: 'У дні зі стресом зроби розвантаження: прогулянка, дихання, запис думок.' },
  { d: 'stress', o: 'focus', lag: 0, h: -1, why: 'Тривога займає робочу памʼять, тому на задачу лишається менше уваги.', fix: 'Запиши, що тривожить, і виділи на це 10 хвилин, а потім повертайся до роботи.' },
  { d: 'mood', o: 'focus', lag: 1, h: 1, why: 'Поганий настрій вчора зазвичай означає менше сил на складне сьогодні.', fix: 'Після важкого дня став на ранок одну просту задачу, щоб розігнатися.' },
  { d: 'spend', o: 'mood', lag: 1, h: -1, why: 'Імпульсні витрати часто йдуть за поганим самопочуттям і потім додають тривоги.', fix: 'Коли хочеться купити «щоб розрадитись», зачекай добу.' },
];

export type Link = {
  id: string; d: Metric; o: Metric; lag: 0 | 1; why: string; fix: string;
  r: number; n: number; strength: 1 | 2 | 3; preliminary: boolean;
  /** the side of the driver that goes with the worse outcome, the split value, and the outcome in the two halves */
  badSide: 'low' | 'high'; thr: number;
  bad: { n: number; avg: number }; good: { n: number; avg: number };
  /** the sentence about the driver's bad side, and the one with numbers */
  when: string; text: string;
};

const corr = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); let a = 0, bx = 0, by = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); bx += (x - mx) ** 2; by += (ys[i] - my) ** 2; }); return bx && by ? a / Math.sqrt(bx * by) : 0; };

/** How the bad side of a driver reads: «спиш менше 6,5 год». */
function badPhrase(d: Metric, side: 'low' | 'high', thr: number): string {
  const f = METRICS[d].fmt;
  switch (d) {
    case 'sleep': return `спиш менше ${n1(thr)} год`;
    case 'bedTonight': return `лягаєш пізніше ${clock(thr)}`;
    case 'lateWork': return thr > 0 ? `працюєш після 21:30 понад ${min(thr)}` : 'працюєш пізно ввечері';
    case 'social': return `у Instagram і YouTube понад ${min(thr)}`;
    case 'taskPace': return `задача забирає понад ${Math.round(thr)} хв фокусу`;
    case 'habits': return `виконуєш менше ${Math.round(thr * 100)}% звичок`;
    case 'workout': return thr > 0 ? `рухаєшся менше ${min(thr)}` : 'день без руху';
    case 'water': return `п’єш менше ${n1(thr)} склянок`;
    case 'load': return `події займають понад ${min(thr)}`;
    case 'people': return thr > 0 ? `живого спілкування менше ${min(thr)}` : 'без живого спілкування';
    case 'stress': return 'у записах є стрес чи тривога';
    case 'mood': return `настрій нижчий за ${n1(thr)}`;
    default: return `${METRICS[d].name} ${side === 'low' ? 'нижче' : 'вище'} ${f(thr)}`;
  }
}
const when = (o: Metric, lag: 0 | 1) => (lag === 1 ? 'наступного дня' : o === 'bedTonight' ? 'того ж вечора' : 'того ж дня');

const MIN_N = 6;
/** The links that hold in the person's own days: expected direction, enough days, and a correlation clearly above chance for that many days. */
export function links(rows: Row[]): Link[] {
  const out: Link[] = [];
  for (const p of PAIRS) {
    const xs: number[] = [], ys: number[] = [];
    rows.forEach((r, i) => { const x = r[p.d], y = rows[i + p.lag]?.[p.o]; if (x !== null && y !== null && y !== undefined) { xs.push(x); ys.push(y); } });
    const n = xs.length; if (n < MIN_N) continue;
    const r = corr(xs, ys), ob = METRICS[p.o].better;
    const need = Math.max(0.35, 2.2 / Math.sqrt(n));
    if (Math.abs(r) < need || Math.sign(r * ob) !== p.h) continue;
    const sorted = [...xs].sort((a, b) => a - b), thr = sorted[Math.floor(sorted.length / 2)];
    // the halves are split at the median; with many equal values (zero minutes, a habit done or not) one side can be too small to compare
    const lo = ys.filter((_, i) => xs[i] <= thr), hi = ys.filter((_, i) => xs[i] > thr);
    if (lo.length < 2 || hi.length < 2) continue;
    const badSide: 'low' | 'high' = p.h > 0 ? 'low' : 'high';
    const bad = badSide === 'low' ? { n: lo.length, avg: mean(lo) } : { n: hi.length, avg: mean(hi) };
    const good = badSide === 'low' ? { n: hi.length, avg: mean(hi) } : { n: lo.length, avg: mean(lo) };
    const w = badPhrase(p.d, badSide, thr), oc = METRICS[p.o];
    out.push({
      id: `${p.d}-${p.o}-${p.lag}`, ...p, r, n, strength: Math.abs(r) >= 0.6 ? 3 : Math.abs(r) >= 0.45 ? 2 : 1, preliminary: n < 14, badSide, thr, bad, good, when: w,
      text: `Коли ${w}, ${oc.name} ${when(p.o, p.lag)} у тебе в середньому ${oc.fmt(bad.avg)} проти ${oc.fmt(good.avg)} в інші дні (${bad.n} і ${good.n} днів).`,
    });
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

export type Chain = { id: string; root: Metric; steps: Link[]; score: number };
/** Chains of 2–3 links where the result of one is the cause of the next, beginning with something the person can change. */
export function chains(ls: Link[]): Chain[] {
  const ROOTS: Metric[] = ['sleep', 'bedTonight', 'lateWork', 'social', 'workout', 'water', 'habits', 'load', 'people', 'stress'];
  const all: Chain[] = [];
  const walk = (path: Link[], seen: Set<Metric>) => {
    const last = path[path.length - 1];
    if (path.length >= 2) all.push({ id: path.map(l => l.id).join('>'), root: path[0].d, steps: path, score: path.reduce((a, l) => a + Math.abs(l.r), 0) * (1 + path.length * 0.15) });
    if (path.length >= 3) return;
    for (const l of ls) if (l.d === last.o && !seen.has(l.o) && l.lag + path.filter(x => x.lag).length <= 1) walk([...path, l], new Set([...seen, l.o]));
  };
  for (const l of ls) if (ROOTS.includes(l.d)) walk([l], new Set([l.d, l.o]));
  // the best chains: at most two for every starting point, with different endings, so the page does not repeat itself
  const picked: Chain[] = [], perRoot = new Map<Metric, number>(), ends = new Set<string>();
  for (const c of all.sort((a, b) => b.score - a.score)) {
    const end = c.root + '>' + c.steps[c.steps.length - 1].o;
    if ((perRoot.get(c.root) || 0) >= 2 || ends.has(end) || picked.some(p => p.steps.every(l => c.steps.some(x => x.id === l.id)) || c.steps.every(l => p.steps.some(x => x.id === l.id)))) continue;
    picked.push(c); perRoot.set(c.root, (perRoot.get(c.root) || 0) + 1); ends.add(end);
  }
  return picked.slice(0, 5);
}

export type Tip = { id: string; area: Area; tone: 'warn' | 'good' | 'info'; title: string; facts: string[]; why: string; action: string; to?: string; weight: number };

/** What the person's own days say about the driver: its linked outcomes with numbers, to attach to a tip. */
const evidence = (ls: Link[], d: Metric) => ls.filter(l => l.d === d).slice(0, 3).map(l => `${METRICS[l.o].name} ${when(l.o, l.lag)}: ${METRICS[l.o].fmt(l.bad.avg)} проти ${METRICS[l.o].fmt(l.good.avg)}`);

/** Everything worth saying today, most important first. Uses the links found in the person's data and plain rules for deadlines, balance and pace. */
export function coach(S: State, eventsOn: (k: string) => UiEvent[], now = new Date()) {
  const rows = coachRows(S, eventsOn, 60, now), ls = links(rows), ch = chains(ls);
  const today = ymd(now), t = rows[rows.length - 1], y = rows[rows.length - 2];
  const tips: Tip[] = [];
  const add = (x: Tip) => tips.push(x);
  const hour = now.getHours() + now.getMinutes() / 60;
  const st = sleepStability(S, 14, now);

  /* ---- sleep and its consequences ---- */
  if (t.sleep !== null && t.sleep < 6.5) {
    const ev = evidence(ls, 'sleep');
    add({ id: 'short-sleep', area: 'Сон і тіло', tone: 'warn', weight: 95, title: `Сьогодні ти спав ${n1(t.sleep)} год: бережи вечір`,
      facts: ev.length ? ev.map(e => 'У такі дні: ' + e) : [`Норма для тебе 7–9 годин, а зараз ${n1(t.sleep)}`],
      why: 'Після недосипу гірше працює увага, настрій і воля, а ввечері виникає «другий вітер»: хочеться посидіти довше, скролити, пити каву. Тому лягаєш пізніше, і наступного дня недосип повторюється. Розірвати коло можна лише раннім відбоєм.',
      action: `Не бери складних задач сьогодні. Закінчи роботу о ${st.windDown}, прибери стрічки за годину до сну й лягай до ${clock(st.target + 30)}.`, to: 'health' });
  }
  if (y.bedTonight !== null && y.bedTonight > st.target + 30 && (t.sleep === null || t.sleep >= 6.5)) {
    const ev = evidence(ls, 'bedTonight');
    add({ id: 'late-bed', area: 'Сон і тіло', tone: 'warn', weight: 82, title: `Вчора ти заснув о ${clock(y.bedTonight)}, а ціль ${clock(st.target)}`,
      facts: ev.length ? ev.map(e => 'Після пізнього відбою: ' + e) : [`Пізніше за ціль на ${Math.round(y.bedTonight - st.target)} хв`],
      why: 'Пізній відбій збиває добовий ритм і скорочує глибокий сон. Ефект видно наступного дня: гірший настрій, менше сил, складніше зосередитись.',
      action: `Найважливіше зроби до обіду, коли голова свіжіша. Сьогодні лягай до ${clock(st.target + 30)}: так ритм повертається за 2–3 дні.`, to: 'health' });
  }
  if (st.steady !== null && st.steady < 60 && st.bedNights >= 5) {
    add({ id: 'sleep-rhythm', area: 'Сон і тіло', tone: 'warn', weight: 70, title: `Режим сну нерівний (${st.steady}/100)`,
      facts: [`Засинаєш від ${clock(st.earliestBed!)} до ${clock(st.latestBed!)}`, `Пізніше за ціль: ${st.lateNights} з ${st.bedNights} ночей`],
      why: 'Для мозку важливіше засинати й прокидатися в один час, ніж спати довго: різниця в 2–3 години щодня діє як постійний «джетлаг».',
      action: `Обери вікно ${clock(st.target)}–${clock(st.target + 30)} і тримайся його 7 днів. Підйом о ${S.wakeTarget} навіть у вихідні.`, to: 'health' });
  } else if (st.earlier >= 30 && st.steady !== null) {
    add({ id: 'sleep-better', area: 'Сон і тіло', tone: 'good', weight: 40, title: 'Ти починаєш засинати раніше',
      facts: [`Приблизно на ${Math.round(st.earlier)} хв раніше, ніж на початку періоду`], why: 'Цей рух найцінніший: ранішній відбій піднімає настрій і фокус наступного дня.', action: 'Тримай цей напрямок: не продовжуй працювати після сигналу «стоп» ввечері.', to: 'health' });
  }

  /* ---- attention: social media ---- */
  const soc = socialOn(S, today), sp = socialPeriod(S, 7, now);
  const over = Object.entries(soc.by).filter(([p, m]) => socialGoal(S, p) > 0 && m > socialGoal(S, p));
  if (over.length) {
    const ev = evidence(ls, 'social');
    add({ id: 'social-over', area: 'Увага й час', tone: 'warn', weight: 78, title: `Понад ліміт: ${over.map(([p, m]) => `${p} ${m} із ${socialGoal(S, p)} хв`).join(', ')}`,
      facts: ev.length ? ev.map(e => 'У дні з більшим скролом: ' + e) : [`Тиждень: ${hmPlain(sp.total)}, понад ліміт ${sp.overDays} ${plural(sp.overDays, 'день', 'дні', 'днів')}`],
      why: 'У стрічці легко потрапити в порівняння з чужим успіхом і почати оцінювати своє життя через чужі відео. Це знижує настрій і відбирає час у твоїх цілей.',
      action: 'Закрий застосунок. Замість наступного відео зроби 20 хвилин для своєї цілі або вийди на прогулянку.', to: 'time' });
  } else if (sp.compared >= 2) {
    add({ id: 'compare', area: 'Увага й час', tone: 'info', weight: 60, title: `${sp.compared} ${plural(sp.compared, 'день', 'дні', 'днів')} цього тижня ти порівнював себе з іншими`,
      facts: [`Соцмережі за тиждень: ${hmPlain(sp.total)}`], why: 'Порівняння з обраними кадрами чужого життя завжди програшне: ти бачиш їхній результат, а свій шлях зсередини.', action: 'Порівнюй себе лише з собою місяць тому: відкрий «Цілі» й подивись, що вже зроблено.', to: 'goals' });
  }
  if (y.lateWork !== null && y.lateWork >= 30) {
    const ev = evidence(ls, 'lateWork');
    add({ id: 'late-work', area: 'Увага й час', tone: 'warn', weight: 66, title: `Вчора ти працював пізно ввечері (${min(y.lateWork)} після 21:30)`,
      facts: ev.length ? ev.map(e => 'У такі дні: ' + e) : [], why: 'Мозок після інтенсивної роботи не вимикається одразу: засинання відсувається, а сон стає поверхневим.',
      action: `Склади складні й бізнес-задачі на ранок, а ввечері став жорсткий «стоп» о ${st.windDown}.`, to: 'focus' });
  }

  /* ---- mood ---- */
  const recentMood = rows.slice(-3).map(r => r.mood).filter((v): v is number => v !== null);
  if (recentMood.length >= 2 && mean(recentMood) < 5) {
    // the drivers of mood that are on their bad side right now
    const bads = ls.filter(l => l.o === 'mood').filter(l => { const v = (l.lag ? y : t)[l.d]; return v !== null && (l.badSide === 'low' ? v <= l.thr : v > l.thr); });
    add({ id: 'low-mood', area: 'Настрій', tone: 'warn', weight: 88, title: `Останні дні настрій нижчий за 5 (${n1(mean(recentMood))}/10)`,
      facts: bads.length ? bads.slice(0, 3).map(l => `Зараз ${l.when}: настрій у такі дні ${n1(l.bad.avg)} проти ${n1(l.good.avg)}`) : ['Явної причини в записах не знайшов'],
      why: bads.length ? bads[0].why : 'Низький настрій кілька днів поспіль варто помітити рано: зазвичай він тримається на сні, русі й відчутті, що рухаєшся до своєї цілі.',
      action: bads.length ? bads[0].fix : 'Зроби три маленькі кроки сьогодні: прогулянка 20 хв, склянка води, одна закрита задача. І лягай вчасно.', to: 'health' });
  }

  /* ---- work, tasks, goals ---- */
  const late = S.tasks.filter(x => !x.d && x.due && x.due < today);
  if (late.length) add({ id: 'overdue', area: 'Робота й бізнес', tone: 'warn', weight: 80, title: `${late.length} ${plural(late.length, 'прострочена задача', 'прострочені задачі', 'прострочених задач')}`,
    facts: late.slice(0, 3).map(x => x.t), why: 'Прострочене тисне на голову й забирає увагу від нового: навіть коли ти про нього не думаєш, мозок тримає його «відкритим».',
    action: 'Для кожної вирішити: зробити сьогодні, перенести на конкретну дату або видалити. Почни з найменшої.', to: 'tasks' });
  const wkGoal = S.goal * 60, wkStart = sod(addD(now, -((now.getDay() + 6) % 7))).getTime();
  const wkDone = S.sessions.filter(s => s.t >= wkStart).reduce((a, s) => a + s.m, 0), dayIdx = (now.getDay() + 6) % 7, workLeft = [...Array(7)].filter((_, i) => i >= dayIdx && isWorkDay(S, ymd(addD(sod(now), i - dayIdx)))).length;
  if (wkGoal > 0 && workLeft > 0 && dayIdx >= 1) {
    const need = (wkGoal - wkDone) / workLeft;
    if (wkDone < wkGoal * (dayIdx / 7) * 0.7 && need > 0) add({ id: 'focus-pace', area: 'Робота й бізнес', tone: 'warn', weight: 72, title: `Фокус відстає: за тиждень ${hmPlain(wkDone)} із ${S.goal} год`,
      facts: [`Щоб устигнути, треба ≈ ${hmPlain(need)} щодня до кінця тижня`], why: 'Тижнева ціль складається з щоденних блоків. Чим довше відкладати, тим більшим здається обсяг і тим легше все кинути.',
      action: `Поклади один блок фокусу на ${hmPlain(Math.min(120, need))} у першій половині дня, коли голова свіжа.`, to: 'focus' });
  }
  const soon = S.goals.filter(g => goalProgress(g) < 1 && g.due && g.due >= today && g.due <= ymd(addD(now, 14)) && goalProgress(g) < 0.7);
  for (const g of soon.slice(0, 2)) add({ id: 'goal-' + g.id, area: 'Цілі й розвиток', tone: 'warn', weight: 74, title: `Ціль «${g.title}» близько до терміну, а прогрес ${Math.round(goalProgress(g) * 100)}%`,
    facts: [`Термін ${g.due.split('-').reverse().join('.')}`], why: 'Ціль без найближчого кроку стоїть на місці. Коли до терміну менше двох тижнів, прогрес мусить іти щодня.', action: 'Розбий залишок на кроки й постав найменший на сьогодні у фокус.', to: 'goals' });
  const idle = S.goals.filter(g => goalProgress(g) < 1 && !S.sessions.some(s => s.t > now.getTime() - 7 * 864e5 && s.task && S.tasks.some(x => x.t === s.task && x.goal === g.id)) && !g.demo);
  if (idle.length && !soon.length) add({ id: 'goal-idle', area: 'Цілі й розвиток', tone: 'info', weight: 50, title: `Ціль «${idle[0].title}» цього тижня без фокусу`,
    facts: [], why: 'Цілі зростають із повторюваних невеликих кроків. Один блок на тиждень майже не змінює траєкторію.', action: 'Привʼяжи до цілі задачу й запусти 25 хв фокусу.', to: 'goals' });
  const risk = S.habits.map(h => ({ h, n: (() => { let n = 0; for (let i = 1; i < 60 && h.days[ymd(addD(now, -i))]; i++) n++; return n; })() })).filter(x => x.n >= 3 && !x.h.days[today]);
  if (risk.length && hour >= 16) add({ id: 'streak', area: 'Цілі й розвиток', tone: 'info', weight: 58, title: `Не обірви серію «${risk[0].h.name}» (${risk[0].n} дн)`,
    facts: [], why: 'Серія збільшує шанс повторити: кожен новий день легший за попередній, поки ти її не перервеш.', action: 'Навіть мінімальна версія (2 хвилини) зберігає серію.', to: 'habits' });

  /* ---- business ---- */
  const dueLeads = S.co.leads.filter(l => l.next && l.next < today && l.status !== 'won' && l.status !== 'dead');
  if (dueLeads.length) add({ id: 'leads', area: 'Робота й бізнес', tone: 'warn', weight: 76, title: `${dueLeads.length} ${plural(dueLeads.length, 'лід', 'ліди', 'лідів')} чекає на відповідь довше, ніж планувалося`,
    facts: dueLeads.slice(0, 3).map(l => l.name), why: 'Інтерес клієнта згасає за дні, а не за тижні. Швидка відповідь часто вирішує, хто отримає замовлення.', action: 'Напиши коротке повідомлення першому ліду зараз: скрипт є в розділі «Ліди».', to: 'leads' });
  const unpaid = S.co.invoices.filter(i => !i.paid && i.due < today);
  if (unpaid.length) add({ id: 'invoices', area: 'Робота й бізнес', tone: 'warn', weight: 77, title: `${unpaid.length} ${plural(unpaid.length, 'рахунок', 'рахунки', 'рахунків')} прострочено`,
    facts: unpaid.slice(0, 3).map(i => `${i.client}: ${i.amt}`), why: 'Чим довше борг, тим менша ймовірність його повернути без неприємної розмови.', action: 'Надішли нагадування сьогодні, ввічливо, з номером рахунку й датою.', to: 'invoices' });
  const biz = rows.slice(-7).map(r => r.bizMin).filter((v): v is number => v !== null);
  if (biz.length >= 5 && biz.reduce((a, b) => a + b, 0) < 60 && (S.co.deals.length || S.co.leads.length)) add({ id: 'biz-time', area: 'Робота й бізнес', tone: 'info', weight: 52, title: 'На бізнес цього тижня майже не було часу',
    facts: [`За 7 днів: ${hmPlain(biz.reduce((a, b) => a + b, 0))}`], why: 'Бізнес росте від регулярного невеликого часу, а не від разових ривків перед дедлайном.', action: 'Заплануй 30–60 хв щодня на ліди й угоди та запиши це як активність «Бізнес».', to: 'co' });

  /* ---- money ---- */
  const b = budgetDKK(S), spent = monthOf(S, today.slice(0, 7)).filter(x => x.type === 'out' && !x.xfer && !x.pot).reduce((a, x) => a + txDKK(S, x), 0), share = now.getDate() / daysInMonth();
  if (b > 0 && spent > b * share * 1.15 && spent > b * 0.3) add({ id: 'spend', area: 'Гроші', tone: 'warn', weight: 68, title: `Витрати йдуть швидше за бюджет: ${Math.round((spent / b) * 100)}% при ${Math.round(share * 100)}% місяця`,
    facts: [`Витрачено ${fmtCur(spent, 'DKK')} із ${fmtCur(b, 'DKK')}`], why: 'Бюджет рівномірний, а витрати зазвичай накопичуються першими днями. Якщо не гальмувати зараз, кінець місяця доведеться жити без запасу.', action: `Обмеж необовʼязкове до кінця тижня: тримай ≈ ${fmtCur(Math.max(0, b - spent) / Math.max(1, daysInMonth() - now.getDate() + 1), 'DKK')} на день.`, to: 'money' });

  /* ---- body today ---- */
  const hw = S.health[today];
  if (hour >= 15 && (hw?.water || 0) < waterGoal(S) * 0.4) add({ id: 'water', area: 'Сон і тіло', tone: 'info', weight: 45, title: `Води сьогодні ${hw?.water || 0} із ${waterGoal(S)} склянок`, facts: evidence(ls, 'water'), why: 'Нестача води знижує увагу й сили швидше, ніж зʼявляється спрага.', action: 'Випий дві склянки зараз і постав ще одну поруч із робочим місцем.', to: 'health' });
  if (hour >= 17 && (hw?.workout || 0) === 0) add({ id: 'move', area: 'Сон і тіло', tone: 'info', weight: 44, title: 'Сьогодні ще без руху', facts: evidence(ls, 'workout'), why: 'Рух піднімає настрій того ж дня і покращує сон уночі.', action: `Хоча б ${moveGoal(S) >= 30 ? 20 : moveGoal(S)} хвилин ходьби до вечора.`, to: 'health' });

  /* ---- time ---- */
  // the best hours: where focus already works
  const byHour = new Array(24).fill(0) as number[];
  S.sessions.forEach(s => { byHour[new Date(s.t).getHours()] += s.m; });
  const total = byHour.reduce((a, b) => a + b, 0);
  if (S.sessions.length >= 12 && total > 0) {
    let bi = 0, bv = 0; for (let h = 0; h < 23; h++) { const v = byHour[h] + byHour[h + 1]; if (v > bv) { bv = v; bi = h; } }
    add({ id: 'peak', area: 'Робота й бізнес', tone: 'good', weight: 35, title: `Твій найпродуктивніший час: ${String(bi).padStart(2, '0')}:00–${String(bi + 2).padStart(2, '0')}:00`,
      facts: [`${Math.round((bv / total) * 100)}% усього фокусу припадає на ці дві години`], why: 'Енергія протягом дня нерівна. Складне, що вимагає думання, найкраще йде в пік, а пошту й дрібниці можна лишити на спад.', action: 'Став на ці години найважливішу задачу й не пускай туди зустрічі.', to: 'focus' });
  }
  const unknown = Object.keys(S.evCats).length === 0 ? eventsOn(today).filter(e => e.act === undefined && !e.allDay).length + S.events.length : 0;
  if (unknown >= 3) add({ id: 'label-events', area: 'Увага й час', tone: 'info', weight: 30, title: 'Підпиши події, щоб я бачив, куди йде час', facts: [], why: 'Поки я не знаю, що це за події, не можу показати, скільки часу йде на навчання, бізнес чи відпочинок, і порівняти це із сном та настроєм.', action: 'Відкрий «Час» і відповідай на питання: це займе хвилину.', to: 'time' });

  tips.sort((a, b) => b.weight - a.weight);

  /* what data is missing for better advice */
  const have = (m: Metric) => rows.filter(r => r[m] !== null).length;
  const coverage = ([['sleep', 'Сон (скільки годин)', 'Запиши сон у «Здоровʼї»'], ['bedTonight', 'Час засинання', 'Вкажи, коли заснув, у плитці «Сон»'], ['mood', 'Настрій', 'Відмічай настрій 1–2 рази на день'],
    ['tasks', 'Закриті задачі', 'Закривай задачі в «Задачах»'], ['focus', 'Фокус', 'Запускай таймер'], ['habits', 'Звички', 'Відмічай звички'], ['social', 'Соцмережі', 'Записуй Instagram і YouTube'], ['load', 'Події', 'Додай події в розклад']] as [Metric, string, string][])
    .map(([m, name, hint]) => ({ m, name, hint, days: have(m) }));
  return { rows, links: ls, chains: ch, tips, coverage, days: rows.filter(r => r.sleep !== null || r.mood !== null || r.focus).length };
}
