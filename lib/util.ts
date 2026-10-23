export const DAY = 864e5;
export const DN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const MON = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const MONTHN = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
export const WD = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];

export const MOODS = ['Погано', 'Так собі', 'Нормально', 'Добре', 'Чудово'];
export const MOODC = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];
export const CATS = {
  out: ['Їжа', 'Транспорт', 'Житло', 'Розваги', 'Навчання', 'Здоровʼя', 'Покупки', 'Інше'],
  in: ['Зарплата', 'SU / стипендія', 'Фриланс', 'Подарунок', 'Інше'],
};
export const AREAS = ['Здоровʼя', 'Карʼєра', 'Фінанси', 'Стосунки', 'Друзі', 'Відпочинок', 'Розвиток', 'Дім'];
export const STAGES = [['lead', 'Лід'], ['talk', 'Перемовини'], ['proposal', 'Пропозиція'], ['won', 'Виграно']] as const;
export const COLORS: [string, string][] = [['c1', 'Помаранчевий'], ['c2', 'Білий'], ['c3', 'Зелений'], ['c4', 'Бузковий']];
export const GUESS: [RegExp, string][] = [
  [/кав|обід|їж|сніданок|вечер|продукт|піц|кафе|netto|føtex|rema|lidl/i, 'Їжа'],
  [/такс|метро|автобус|проїзд|бензин|dsb|rejsekort|tog/i, 'Транспорт'],
  [/кіно|гра|бар|концерт|клуб/i, 'Розваги'],
  [/книг|курс|підручник/i, 'Навчання'],
  [/аптек|лік|apotek/i, 'Здоровʼя'],
  [/оренд|комунал|інтернет|husleje/i, 'Житло'],
];

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const sod = (d: Date | number) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const wStart = (d: Date = new Date()) => { const x = sod(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const addD = (d: Date | number, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const toMin = (t: string) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
export const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const TK = () => ymd(new Date());
export const daysTo = (d: string) => Math.round((new Date(d + 'T00:00').getTime() - sod(new Date()).getTime()) / DAY);
export const daysInMonth = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); };
export const weekdayIdx = (d: Date = new Date()) => (d.getDay() + 6) % 7;
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const pctW = (v: number, m: number) => Math.max(0, Math.min(100, m ? (v / m) * 100 : 0)).toFixed(1);
export const fmt = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

const dkk = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 });
export const money = (n: number) => dkk.format(Math.round(n));
export const fmtN = (n: number) => (+n).toLocaleString('da-DK');
export const kfmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'm' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)));
export const hmPlain = (m: number) => { m = Math.round(m); const h = Math.floor(m / 60); return h ? `${h} год ${m % 60} хв` : `${m % 60} хв`; };
export const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smooth(p: [number, number][]) {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0]},${c[1]}`;
  }
  return d;
}
