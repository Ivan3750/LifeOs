import type { State } from './types';
import { dayMood, energyLevel, moodsOn, moveGoal, sleepRhythm, waterGoal } from './score';
import { addD, sod, toMin, ymd } from './util';

/** One day of the person's life as numbers (null: not logged that day). */
export type DayRow = { k: string; sleep: number | null; bed: number | null; mood: number | null; energy: number | null; water: number | null; workout: number | null; focus: number };

/** The last `days` days up to today. A bedtime after midnight counts as 24:30, 25:00… so that 23:30 and 00:30 sit next to each other. */
export function dayRows(S: State, days = 90, now = new Date()): DayRow[] {
  return [...Array(days)].map((_, i) => {
    const k = ymd(addD(sod(now), i - days + 1)), h = S.health[k];
    const en = moodsOn(S, k).filter(m => m.energy > 0).map(m => energyLevel(m.energy) as number);
    const d0 = new Date(k + 'T00:00').getTime(), d1 = addD(new Date(d0), 1).getTime();
    return {
      k,
      sleep: h && h.sleep > 0 ? h.sleep : null,
      bed: h?.bed ? (toMin(h.bed) < 12 * 60 ? toMin(h.bed) + 1440 : toMin(h.bed)) : null,
      mood: dayMood(S, k) || null,
      energy: en.length ? en.reduce((a, b) => a + b, 0) / en.length : null,
      water: h && h.water > 0 ? h.water : null,
      workout: h ? h.workout : null,
      focus: S.sessions.filter(s => s.t >= d0 && s.t < d1).reduce((a, s) => a + s.m, 0),
    };
  });
}

type Factor = 'sleep' | 'bed' | 'water' | 'workout';
type Target = 'mood' | 'energy' | 'focus';

/** Which days count as «low» and «normal» for a factor. lag 1: the factor of yesterday is compared with today. */
const FACTORS: Record<Factor, { lag: 0 | 1; of: (r: DayRow, S: State) => 'low' | 'high' | null }> = {
  sleep: { lag: 0, of: r => (r.sleep === null ? null : r.sleep < 6.5 ? 'low' : r.sleep >= 7 ? 'high' : null) },
  bed: { lag: 0, of: r => (r.bed === null ? null : r.bed >= 1470 ? 'low' : r.bed <= 1440 ? 'high' : null) },
  water: { lag: 0, of: (r, S) => (r.water === null ? null : r.water < waterGoal(S) * 0.5 ? 'low' : r.water >= waterGoal(S) * 0.8 ? 'high' : null) },
  workout: { lag: 1, of: (r, S) => (r.workout === null ? null : r.workout === 0 ? 'low' : r.workout >= Math.min(20, moveGoal(S) * 0.7) ? 'high' : null) },
};
const TARGETS: Record<Target, { of: (r: DayRow) => number | null; min: number; unit: string }> = {
  mood: { of: r => r.mood, min: 0.7, unit: 'з 10' },
  energy: { of: r => r.energy, min: 0.25, unit: 'із 3' },
  focus: { of: r => (r.focus > 0 ? r.focus : null), min: 20, unit: 'хв' },
};
const PAIRS: [Factor, Target][] = [['sleep', 'mood'], ['sleep', 'energy'], ['sleep', 'focus'], ['bed', 'mood'], ['water', 'mood'], ['water', 'energy'], ['workout', 'mood']];

export type Finding = {
  id: string; factor: Factor; target: Target;
  low: { n: number; avg: number }; high: { n: number; avg: number };
  /** normal minus low: how much better the target is on normal days */
  diff: number; strength: 1 | 2 | 3;
};

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Every link between a habit of the body (sleep, water, movement, bedtime) and how the next hours go (mood, energy, focus) that the person's own
    history supports: at least three low days and three normal days, and a clear difference between them. Strongest first. */
export function findings(S: State, now = new Date()): Finding[] {
  const rows = dayRows(S, 90, now), out: Finding[] = [];
  for (const [factor, target] of PAIRS) {
    const F = FACTORS[factor], T = TARGETS[target], low: number[] = [], high: number[] = [];
    rows.forEach((r, i) => {
      const f = rows[i - F.lag];
      const y = T.of(r), g = f ? F.of(f, S) : null;
      if (y === null || !g) return;
      (g === 'low' ? low : high).push(y);
    });
    if (low.length < 3 || high.length < 3) continue;
    const diff = mean(high) - mean(low);
    if (diff < T.min) continue;
    out.push({ id: `${factor}-${target}`, factor, target, low: { n: low.length, avg: mean(low) }, high: { n: high.length, avg: mean(high) }, diff, strength: diff >= T.min * 3 ? 3 : diff >= T.min * 1.8 ? 2 : 1 });
  }
  return out.sort((a, b) => b.diff / TARGETS[b.target].min - a.diff / TARGETS[a.target].min);
}

const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const TARGET_WORD: Record<Target, string> = { mood: 'настрій', energy: 'енергія', focus: 'фокус' };

/** A sentence about one finding, with the numbers from the person's own days. */
export function describe(f: Finding): { title: string; text: string; advice: string } {
  const T = TARGETS[f.target], unit = f.target === 'focus' ? ' хв' : '', cmp = `${n1(f.low.avg)}${unit} проти ${n1(f.high.avg)}${unit} ${f.target === 'focus' ? '' : T.unit}`.trim();
  const when = {
    sleep: 'коли ти спиш менше 6,5 години', bed: 'коли лягаєш після 00:30', water: 'коли п’єш менше половини денної цілі води',
    workout: 'після дня без жодного руху',
  }[f.factor];
  const title = { sleep: 'Сон', bed: 'Пізній відбій', water: 'Вода', workout: 'Рух' }[f.factor] + ' і ' + TARGET_WORD[f.target];
  return {
    title,
    text: `${when[0].toUpperCase()}${when.slice(1)}, ${TARGET_WORD[f.target]} у тебе в середньому ${cmp}. Це видно з ${f.low.n} таких днів проти ${f.high.n} звичайних.`,
    advice: {
      sleep: 'Лягай раніше, щоб спати 7–8 годин.', bed: 'Лягай до півночі.', water: 'Пий воду рівномірно протягом дня.', workout: 'Навіть 20 хвилин руху піднімають наступний день.',
    }[f.factor],
  };
}

export type Advice = {
  tone: 'warn' | 'good'; title: string;
  /** why: what was logged and what the history says about days like this */
  reason: string; action: string;
  /** one-line cause for a notification */
  cause: string;
  /** numbers behind the advice, shown as small chips */
  facts: string[];
  task?: string;
};

const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

/** What to do today, chosen from what was logged and from the links found in the history.
    Poor sleep comes first: it is the most common reason for a low mood, and tonight's sleep is the one thing that can still be changed. */
export function todayAdvice(S: State, now = new Date()): Advice | null {
  const rows = dayRows(S, 90, now), today = rows[rows.length - 1], yday = rows[rows.length - 2], fs = findings(S, now);
  const sleepMood = fs.find(f => f.id === 'sleep-mood'), sleepEnergy = fs.find(f => f.id === 'sleep-energy');
  const wake = sleepRhythm(S).wake ?? toMin(S.dayStart), bed = hm((wake - 450 + 1440) % 1440);
  const nights = [today.sleep, yday?.sleep].filter((v): v is number => v !== null);
  const poor = today.sleep !== null && today.sleep < 6.5, debt = !poor && nights.length === 2 && mean(nights) < 6.5;
  const moodNow = today.mood, lowMood = moodNow !== null && moodNow <= 5;

  if (poor || debt) {
    const s = poor ? today.sleep! : mean(nights);
    const facts = [poor ? `сон ${n1(s)} год` : `дві ночі по ${n1(s)} год`];
    let reason = poor ? `Ти спав ${n1(s)} год, це менше за норму 7–8.` : `Дві останні ночі ти спав у середньому ${n1(s)} год: недосип накопичується.`;
    if (sleepMood) {
      const d = describe(sleepMood);
      reason += ` Твоя історія на це вказує: ${d.text.charAt(0).toLowerCase()}${d.text.slice(1)}`;
      facts.push(`настрій ${n1(sleepMood.low.avg)} проти ${n1(sleepMood.high.avg)}`);
    } else reason += ' Недосип знижує настрій, енергію і концентрацію, хоч у твоїх записах ще замало днів для точної закономірності.';
    if (sleepEnergy) facts.push(`енергія ${n1(sleepEnergy.low.avg)} проти ${n1(sleepEnergy.high.avg)}`);
    if (lowMood) { reason += ` Сьогоднішній настрій ${n1(moodNow!)} із 10: схоже, це відлуння недосипу.`; facts.push(`настрій сьогодні ${n1(moodNow!)}`); }
    return {
      tone: 'warn', title: 'Сьогодні вирівняй сон', reason, facts,
      action: `Лягти спати до ${bed}: так вийде 7,5 години до звичного підйому о ${hm(wake)}.`,
      cause: `недосип (${n1(s)} год сну)`, task: `Лягти спати до ${bed}`,
    };
  }

  if (lowMood) {
    // no sleep problem, so look for another habit that the history ties to low mood
    const waterLow = today.water !== null && today.water < waterGoal(S) * 0.5 && now.getHours() >= 13, wf = fs.find(f => f.id === 'water-mood');
    if (waterLow && wf) return { tone: 'warn', title: 'Випий води', reason: `Сьогодні випито ${today.water} з ${waterGoal(S)} склянок, а в дні з малою кількістю води настрій у тебе в середньому ${n1(wf.low.avg)} проти ${n1(wf.high.avg)}.`, action: 'Випий склянку води просто зараз і тримай пляшку поруч.', facts: [`вода ${today.water} з ${waterGoal(S)}`, `настрій ${n1(wf.low.avg)} проти ${n1(wf.high.avg)}`], cause: 'мало води', task: 'Випити склянку води' };
    const mf = fs.find(f => f.id === 'workout-mood');
    if (yday && yday.workout === 0 && mf) return { tone: 'warn', title: 'Додай трохи руху', reason: `Вчора не було жодного руху, а після таких днів настрій у тебе в середньому ${n1(mf.low.avg)} проти ${n1(mf.high.avg)}.`, action: 'Пройдись 20 хвилин: це найшвидше піднімає настрій.', facts: ['вчора без руху', `настрій ${n1(mf.low.avg)} проти ${n1(mf.high.avg)}`], cause: 'вчора без руху', task: 'Пройтися 20 хвилин' };
    const bf = fs.find(f => f.id === 'bed-mood');
    if (today.bed !== null && today.bed >= 1470 && bf) return { tone: 'warn', title: 'Лягай раніше', reason: `Ти ліг о ${hm(today.bed)}, а після пізнього відбою настрій у тебе в середньому ${n1(bf.low.avg)} проти ${n1(bf.high.avg)}.`, action: `Сьогодні лягти до ${bed}.`, facts: [`відбій ${hm(today.bed)}`], cause: 'пізній відбій', task: `Лягти спати до ${bed}` };
    return null;
  }

  if (today.sleep !== null && today.sleep >= 7 && sleepMood) return { tone: 'good', title: 'Сон у нормі', reason: `Ти спав ${n1(today.sleep)} год. У такі ночі твій настрій у середньому ${n1(sleepMood.high.avg)}, а після короткого сну лише ${n1(sleepMood.low.avg)}.`, action: 'Так тримати: використай цей запас енергії для найважливішої задачі.', facts: [`сон ${n1(today.sleep)} год`, `настрій ${n1(sleepMood.high.avg)} проти ${n1(sleepMood.low.avg)}`], cause: '' };
  return null;
}
