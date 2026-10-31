'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useDevicePref } from '@/lib/device';
import { DEFAULT_REMIND, dangerHours, hhmm, remindText, reminderTimes, type RemindCfg } from '@/lib/remind';
import { Icon } from './Icon';
import { notifyDevice, REMIND_KEY } from './Reminders';

type Perm = 'granted' | 'denied' | 'default' | 'unsupported';
const permission = (): Perm => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const isIos = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

/** Settings card: reminders for the hours when cravings come, on this device. */
export function ReminderSettings() {
  const { S, toast } = useStore();
  const [cfg, setCfg] = useDevicePref<RemindCfg>(REMIND_KEY, DEFAULT_REMIND);
  const [perm, setPerm] = useState<Perm>('default');
  const [time, setTime] = useState('21:00');
  useEffect(() => { const t = setTimeout(() => setPerm(permission()), 0); return () => clearTimeout(t); }, []);
  const set = (p: Partial<RemindCfg>) => setCfg({ ...cfg, ...p });
  const auto = dangerHours(S), times = reminderTimes(S, cfg);

  const turnOn = async () => {
    set({ on: true });
    if (permission() === 'default') setPerm(await Notification.requestPermission());
    else setPerm(permission());
  };
  const test = async () => {
    if (permission() !== 'granted') { toast('Спершу дозволь сповіщення в браузері'); return; }
    const t = remindText({ min: new Date().getHours() * 60 + new Date().getMinutes(), auto: false }, new Date());
    toast((await notifyDevice(t.title, t.body, 'danger-test')) ? 'Тестове сповіщення надіслано' : 'Не вдалося показати сповіщення');
  };
  const addTime = () => { if (time && !cfg.hours.includes(time)) set({ hours: [...cfg.hours, time].sort() }); };

  return (
    <div className="card cardcol">
      <div className="ch" style={{ margin: 0 }}><Icon n="bell" className="ic" /><div><h3>Нагадування в небезпечні години</h3><p>Попереджу перед годинами, коли потяг буває частіше</p></div></div>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div><b>Нагадувати</b><div className="muted" style={{ fontSize: 12 }}>{cfg.on ? (perm === 'granted' ? 'Сповіщення дозволені' : perm === 'denied' ? 'Сповіщення заблоковані в браузері, працюватиме лише смужка в застосунку' : perm === 'unsupported' ? 'Браузер не вміє сповіщення, буде смужка в застосунку' : 'Чекаю на дозвіл') : 'Вимкнено'}</div></div>
        <button className="switch" role="switch" aria-checked={cfg.on} aria-label="Нагадувати в небезпечні години" onClick={() => (cfg.on ? set({ on: false }) : void turnOn())}><i /></button>
      </div>
      {cfg.on && (
        <>
          <label className="field" htmlFor="remLead">Коли нагадати
            <select id="remLead" value={cfg.lead} onChange={e => set({ lead: +e.target.value })}>
              {[[0, 'Рівно в цю годину'], [10, 'За 10 хвилин'], [15, 'За 15 хвилин'], [30, 'За 30 хвилин'], [60, 'За годину']].map(([n, l]) => <option key={n} value={n}>{l}</option>)}
            </select>
          </label>
          <div>
            <div className="fl">Години з історії потягів</div>
            <p className="help" style={{ margin: '0 0 8px' }}>{auto.length ? `Знайшов за твоїми записами: ${auto.map(h => hhmm(h * 60)).join(', ')}.` : 'Поки замало даних. Коли в одну годину буде 2 відмічені потяги, я додам її сам.'}</p>
            <label className="check on" style={{ width: 'fit-content' }}><input type="checkbox" checked={cfg.auto} onChange={e => set({ auto: e.target.checked })} /><span className="box">{cfg.auto && <Icon n="check" />}</span>Використовувати ці години</label>
          </div>
          <div>
            <div className="fl">Свої години</div>
            <div className="tags" style={{ margin: '8px 0' }}>{cfg.hours.map(h => <button key={h} type="button" aria-pressed="true" onClick={() => set({ hours: cfg.hours.filter(x => x !== h) })} title="Прибрати">{h} ✕</button>)}{!cfg.hours.length && <span className="muted" style={{ fontSize: 13 }}>Немає</span>}</div>
            <div className="row"><input type="time" aria-label="Час нагадування" value={time} onChange={e => setTime(e.target.value)} className="remtime" /><button className="btn ghost sm" onClick={addTime}>Додати час</button></div>
          </div>
          <p className="help" style={{ margin: 0 }}>Зараз нагадаю: {times.length ? times.map(t => hhmm(t.min)).join(', ') : 'нема годин'}.</p>
          <div className="row"><button className="btn ghost" onClick={test}>Надіслати пробне сповіщення</button></div>
        </>
      )}
      <p className="help" style={{ margin: 0 }}>
        Сповіщення приходять, поки застосунок відкритий або недавно був активний на телефоні. Закритий застосунок браузер не запускає, тому для надійних сповіщень поверх усього додай LifeOs на головний екран
        {isIos() && !standalone() ? ' (на iPhone це обовʼязково: Поділитися → «На екран “Додому”»)' : ''}. Текст нагадування не називає звичку, тож його безпечно бачити на заблокованому екрані.
      </p>
    </div>
  );
}
