import type { State, Invoice } from './types';
import { addD, pad2, rng, sod, wStart, ymd } from './util';
import { DEFAULT_ACCOUNTS, DEFAULT_UAH_PER_DKK } from './money';

/** Fresh state. With demo=true it is filled with clearly marked example data (amounts in DKK). */
export function makeState(demo: boolean): State {
  const now = new Date();
  let nextId = 100;
  const id = () => nextId++;
  const r = rng(42);

  const sessions: State['sessions'] = [];
  if (demo) {
    for (let d = addD(wStart(), -7); d <= now; d = addD(d, 1)) {
      const hours = [8, 9, 10, 11, 13, 14, 15, 16, 19, 20, 21];
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const h = hours[Math.floor(r() * hours.length)], m = r() < 0.55 ? 50 : 25;
        const t = new Date(d); t.setHours(h, Math.floor(r() * 4) * 5, 0, 0);
        if (t.getTime() + m * 6e4 < now.getTime()) sessions.push({ t: t.getTime(), m, demo: 1 });
      }
    }
  }

  const today = ymd(now), tom = ymd(addD(now, 1));
  const habits: State['habits'] = demo
    ? ['Ранкова зарядка', 'Читання 20 хв', '10 нових слів данською', 'Без телефону після 23:00'].map((name, j) => {
        const days: Record<string, 1> = {};
        for (let i = 1; i < 14; i++) if (r() < 0.8 - j * 0.12) days[ymd(addD(now, -i))] = 1;
        if (j < 2) days[today] = 1;
        return { id: id(), name, days, demo: 1 as const };
      })
    : [];

  const health: State['health'] = {};
  if (demo) {
    for (let i = 0; i < 14; i++) {
      // bedtime between 23:00 and 01:30, wake time follows from the length of the night
      const bedM = 1380 + Math.floor(r() * 30) * 5, sl = Math.round((6 + r() * 2.5) * 2) / 2, hm = (m: number) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
      health[ymd(addD(now, -i))] = i
        ? { water: Math.round(4 + r() * 5), sleep: sl, mood: 0, steps: 0, workout: r() < 0.45 ? 0 : 10 * (1 + Math.floor(r() * 6)), weight: 0, bed: hm(bedM), wake: hm(bedM + sl * 60), demo: 1 }
        : { water: 3, sleep: 7.5, mood: 0, steps: 0, workout: 0, weight: 0, bed: '23:30', wake: '07:00', demo: 1 };
    }
  }

  const social: State['social'] = [];
  if (demo) {
    for (let i = 0; i < 7; i++) {
      const d = ymd(addD(now, -i));
      social.push({ id: id(), date: d, platform: 'Instagram', min: 15 + Math.floor(r() * 5) * 10, why: r() < 0.5 ? 'Розваги' : 'Інформація', ...(r() < 0.3 ? { cmp: 1 as const } : {}), demo: 1 });
      social.push({ id: id(), date: d, platform: 'YouTube', min: 30 + Math.floor(r() * 6) * 15, why: r() < 0.5 ? 'Навчання' : 'Розваги', demo: 1 });
    }
  }

  const TAGS = ['Спокій', 'Радість', 'Втома', 'Мотивація', 'Стрес', 'Натхнення'];
  const moods: State['moods'] = [];
  if (demo) {
    for (let i = 13; i >= 0; i--) {
      for (const h of i ? [9, 14, 20].filter(() => r() < 0.7) : [8, 11]) {
        const d = sod(addD(now, -i)); d.setHours(h, Math.floor(r() * 60));
        if (d < now) moods.push({ id: id(), t: d.getTime(), v: 4 + Math.floor(r() * 6), energy: 2 + Math.floor(r() * 4), tags: [TAGS[Math.floor(r() * TAGS.length)]], note: '', demo: 1 });
      }
    }
  }

  const noteList: State['noteList'] = demo
    ? [
        { id: id(), title: 'Ідеї для воркшопу', text: '- почати з короткої гри\n- показати 3 приклади\n- залишити 10 хв на питання', created: addD(now, -3).getTime(), updated: addD(now, -1).getTime(), pinned: true, demo: 1 },
        { id: id(), title: 'Список покупок', text: 'молоко, хліб, яблука, кава', created: addD(now, -1).getTime(), updated: addD(now, -1).getTime(), demo: 1 },
      ]
    : [];

  const tx: State['money']['tx'] = [];
  if (demo) {
    const y = now.getFullYear(), m = now.getMonth();
    const C = ['Їжа', 'Їжа', 'Їжа', 'Транспорт', 'Розваги', 'Покупки', 'Навчання'];
    const N: Record<string, string[]> = { 'Їжа': ['Netto', 'Кава', 'Обід у кафе'], 'Транспорт': ['Rejsekort', 'DSB'], 'Розваги': ['Кіно', 'Концерт'], 'Покупки': ['Одяг', 'Дрібниці'], 'Навчання': ['Курс', 'Книга'] };
    tx.push({ id: id(), type: 'in', amt: 6800, cat: 'SU / стипендія', note: 'SU', date: ymd(new Date(y, m, 1)), demo: 1 });
    if (now.getDate() >= 10) tx.push({ id: id(), type: 'in', amt: 4500, cat: 'Фриланс', note: 'Лендінг для клієнта', date: ymd(new Date(y, m, 10)), demo: 1 });
    tx.push({ id: id(), type: 'out', amt: 3900, cat: 'Житло', note: 'Husleje', date: ymd(new Date(y, m, Math.min(2, now.getDate()))), demo: 1 });
    // the Ukrainian account, amounts in hryvnias
    tx.push({ id: id(), type: 'in', amt: 12000, cat: 'Фриланс', note: 'Сайт для клієнта з Києва', date: ymd(new Date(y, m, Math.min(5, now.getDate()))), acc: 'ua', demo: 1 });
    tx.push({ id: id(), type: 'out', amt: 250, cat: 'Інше', note: 'Мобільний звʼязок', date: ymd(new Date(y, m, Math.min(3, now.getDate()))), acc: 'ua', demo: 1 });
    tx.push({ id: id(), type: 'out', amt: 1800, cat: 'Покупки', note: 'Подарунок мамі', date: ymd(new Date(y, m, Math.min(12, now.getDate()))), acc: 'ua', demo: 1 });
    for (let d = 1; d <= now.getDate(); d++) {
      const k = 1 + Math.floor(r() * 2);
      for (let j = 0; j < k; j++) {
        if (r() < 0.3) continue;
        const c = C[Math.floor(r() * C.length)], nn = N[c];
        tx.push({ id: id(), type: 'out', amt: Math.round((20 + r() * 230) / 5) * 5, cat: c, note: nn[Math.floor(r() * nn.length)], date: ymd(new Date(y, m, d)), demo: 1 });
      }
    }
  }

  const goals: State['goals'] = demo
    ? ([['Прочитати 12 книг', 'Розвиток', 12, 7, 'книг', 75], ['Відкласти на ноутбук', 'Фінанси', 12000, 7400, 'kr.', 120], ['Пробігти 100 км', 'Здоровʼя', 100, 62, 'км', 45], ['Скласти данську на рівень B2', 'Карʼєра', 6, 3, 'модулів', 70]] as const)
        .map(([title, area, target, cur, unit, dd]) => ({ id: id(), title, area, target, cur, unit, due: ymd(addD(now, dd)), demo: 1 as const }))
    : [];

  const co: State['co'] = { name: 'Моя студія', goal: 150000, invSeq: 0, deals: [], projects: [], invoices: [], team: [], leads: [], clients: [], ads: [] };
  if (demo) {
    co.deals = ([['Сайт для кавʼярні', 'Kaffebar Bønne', 45000, 'proposal'], ['Брендинг фітнес-клубу', 'FitLab', 80000, 'talk'], ['Підтримка вебмагазину', 'Shopik ApS', 15000, 'lead'], ['Лендінг конференції', 'DevDays', 30000, 'lead'], ['Мобільний застосунок', 'MedCare', 220000, 'talk'], ['SMM на 3 місяці', 'Bloom', 36000, 'won']] as const)
      .map(([title, client, amt, stage]) => ({ id: id(), title, client, amt, stage, demo: 1 as const }));
    co.projects = ([['Редизайн сайту', 'Kaffebar Bønne', 20, 65, 'active', 60000], ['CRM-інтеграція', 'Shopik ApS', 4, 30, 'active', 40000], ['Брендбук', 'Bloom', 35, 10, 'paused', 55000], ['Лендінг до запуску', 'DevDays', -3, 100, 'done', 25000]] as const)
      .map(([name, client, dd, progress, status, budget]) => ({ id: id(), name, client, due: ymd(addD(now, dd)), progress, status, budget, demo: 1 as const }));
    co.team = ([['Олена', 'Дизайнерка', 80], ['Максим', 'Розробник', 105], ['Ірина', 'Проджект-менеджерка', 60], ['Андрій', 'Маркетолог', 40]] as const)
      .map(([name, role, load]) => ({ id: id(), name, role, load, demo: 1 as const }));
    const r2 = rng(5), cl = ['Kaffebar Bønne', 'Shopik ApS', 'Bloom', 'DevDays', 'FitLab', 'Nova Dental'];
    const inv = (client: string, amt: number, iss: Date, due: Date, paidAt: Date | null) => {
      co.invSeq++;
      const i: Invoice = { id: id(), no: 'INV-' + String(co.invSeq).padStart(3, '0'), client, amt, issued: ymd(iss), due: ymd(due), paid: !!paidAt, paidAt: paidAt ? ymd(paidAt) : '', demo: 1 };
      co.invoices.push(i);
    };
    for (let mo = 5; mo >= 0; mo--) {
      const base = new Date(now.getFullYear(), now.getMonth() - mo, 1);
      for (let j = 0; j < (mo ? 3 : 2); j++) {
        const iss = addD(base, 3 + j * 8);
        if (iss > now) continue;
        const pa = addD(iss, 5 + Math.floor(r2() * 6));
        inv(cl[Math.floor(r2() * cl.length)], Math.round((25000 + r2() * 35000) / 500) * 500, iss, addD(iss, 14), mo > 0 || j === 0 ? (pa > now ? now : pa) : null);
      }
    }
    const ds = (n: number) => ymd(addD(now, n));
    co.leads = ([['Нова кавʼярня «Zorya»', '@zorya.coffee', 'Instagram', 'replied', 30000, 1, 'Просили кошторис на сайт'], ['Dr. Jensen, стоматологія', 'jensen@tand.dk', 'Google', 'new', 25000, 0, ''], ['Студія йоги Flow', '+45 22 33 44 55', 'Рекомендація', 'meeting', 18000, 3, 'Зустріч у четвер'], ['Магазин Pixel', 'pixel.shop', 'Facebook', 'contacted', 12000, -2, 'Не відповів, написати ще раз'], ['Бар «Nord»', '@nordbar', 'TikTok', 'dead', 8000, 0, 'Немає бюджету']] as const)
      .map(([name, contact, source, status, value, nd, note]) => ({ id: id(), name, contact, source, status, value, next: status === 'dead' ? '' : ds(nd), note, created: ds(-10), demo: 1 as const }));
    co.ads = ([['Instagram', 1800, -20, 'Таргет на кавʼярні'], ['Google', 2400, -14, 'Пошукова реклама'], ['Instagram', 1500, -6, 'Reels'], ['Facebook', 900, -3, 'Ретаргетинг']] as const)
      .map(([channel, amt, dd, note]) => ({ id: id(), date: ds(dd), channel, amt, note, demo: 1 as const }));
    inv('FitLab', 18000, addD(now, -20), addD(now, -6), null);
    inv('Kaffebar Bønne', 22500, addD(now, -2), addD(now, 12), null);
  }

  return {
    v: 1, name: 'Друже', goal: 20, focusMin: 25, breakMin: 5, demo, notes: '', theme: 'system',
    noteList, moods, dayStart: '08:00', dayEnd: '22:00', activities: [], act: null,
    workDays: [true, true, true, true, true, false, false],
    meals: [
      { key: 'breakfast', label: 'Сніданок', s: '08:00', e: '08:30', on: true },
      { key: 'lunch', label: 'Обід', s: '12:30', e: '13:15', on: true },
      { key: 'dinner', label: 'Вечеря', s: '18:30', e: '19:15', on: true },
    ],
    sessions,
    tasks: demo
      ? [
          { id: id(), t: 'Дочитати розділ про графи', p: 'hi', d: false, demo: 1 },
          { id: id(), t: 'Відповісти на лист куратору', p: 'lo', d: true, demo: 1 },
          { id: id(), t: 'Зібрати референси для воркшопу', p: 'hi', d: false, demo: 1 },
          { id: id(), t: 'Спортзал о 19:00', p: 'lo', d: false, demo: 1 },
        ]
      : [],
    events: demo
      ? [
          { id: id(), date: today, s: '09:00', e: '10:30', title: 'Лекція: Алгоритми', c: 'c1', demo: 1 },
          { id: id(), date: today, s: '12:30', e: '13:15', title: 'Обід', c: 'c2', demo: 1 },
          { id: id(), date: today, s: '14:00', e: '16:00', title: 'Воркшоп з дизайну', c: 'c3', demo: 1 },
          { id: id(), date: today, s: '17:00', e: '18:00', title: 'Зустріч клубу', c: 'c2', demo: 1 },
          { id: id(), date: tom, s: '10:00', e: '11:30', title: 'Урок данської', c: 'c4', demo: 1 },
        ]
      : [],
    timer: { mode: 'focus', left: 25 * 60, running: false, endAt: 0, task: '' },
    log: [], unread: false, nextId,
    habits, health, goals,
    money: { budget: 9000, tx, accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a, budget: a.id === 'ua' && demo ? 3000 : a.budget, opening: demo ? (a.id === 'dk' ? 4200 : 8500) : 0 })), budgetMode: 'fixed', saveRate: 20, catBudgets: {}, recurring: [], pots: [], uahPerDkk: DEFAULT_UAH_PER_DKK, rateAt: 0, rateSrc: 'manual' },
    wheel: demo ? [7, 6, 5, 8, 6, 4, 7, 6] : [5, 5, 5, 5, 5, 5, 5, 5],
    mode: 'me', view: 'home', co, icalUrls: [],
    evCats: {}, evWords: {}, social, socialGoals: { Instagram: 30, YouTube: 60 }, bedTarget: '23:30', wakeTarget: '07:30',
  };
}

/** Removes every record that was created as an example. */
export function stripDemo(s: State) {
  s.sessions = s.sessions.filter(x => !x.demo);
  s.tasks = s.tasks.filter(x => !x.demo);
  s.events = s.events.filter(x => !x.demo);
  s.moods = s.moods.filter(x => !x.demo);
  s.activities = s.activities.filter(x => !x.demo);
  s.noteList = s.noteList.filter(x => !x.demo);
  s.social = s.social.filter(x => !x.demo);
  s.habits = s.habits.filter(x => !x.demo);
  s.goals = s.goals.filter(x => !x.demo);
  s.money.tx = s.money.tx.filter(x => !x.demo);
  for (const k of Object.keys(s.health)) if (s.health[k].demo) delete s.health[k];
  s.co.deals = s.co.deals.filter(x => !x.demo);
  s.co.projects = s.co.projects.filter(x => !x.demo);
  s.co.invoices = s.co.invoices.filter(x => !x.demo);
  s.co.team = s.co.team.filter(x => !x.demo);
  s.co.leads = s.co.leads.filter(x => !x.demo);
  s.co.ads = s.co.ads.filter(x => !x.demo);
  s.demo = false;
}
