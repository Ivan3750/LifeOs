'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { useDevicePref } from '@/lib/device';
import { DEFAULT_REMIND, dueNow, firedKey, hhmm, remindText, reminderTimes, type RemindCfg } from '@/lib/remind';
import { Icon } from './Icon';

export const REMIND_KEY = 'pulse-os-remind';
const FIRED = 'pulse-os-remind-fired';

const readFired = (): string[] => { try { return JSON.parse(localStorage.getItem(FIRED) || '[]'); } catch { return []; } };
const saveFired = (a: string[]) => { try { localStorage.setItem(FIRED, JSON.stringify(a.slice(-40))); } catch {} };

/** A system notification: through the service worker when there is one (needed on phones), otherwise the plain one. */
export async function notifyDevice(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { open: 'sos' } }); return true; }
    new Notification(title, { body, tag, icon: '/icon-192.png' });
    return true;
  } catch { return false; }
}

/** Watches the clock. When a dangerous hour comes (or has just started) it shows a bar in the app and, when the app is out of sight, a notification.
    It runs while the app is open or recently used: a browser does not run a page that is closed, so nothing can fire from the closed app without a server. */
export function RemindHost() {
  const { S, setSheet } = useStore();
  const [cfg] = useDevicePref<RemindCfg>(REMIND_KEY, DEFAULT_REMIND);
  const now = useNow(30_000, cfg.on);
  const [bar, setBar] = useState<{ min: number; text: string } | null>(null);
  const times = reminderTimes(S, cfg, now);
  const at = new Date(now), due = dueNow(times, cfg, at, readFired());

  useEffect(() => {
    if (!due) return;
    const key = firedKey(at, due), txt = remindText(due, at);
    saveFired([...readFired(), key]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (document.visibilityState === 'visible') setBar({ min: due.min, text: txt.body });
    else void notifyDevice(txt.title, txt.body, 'danger-' + key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due?.min, Math.floor(now / 60_000)]);

  // tapping the notification opens the SOS sheet
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'open-sos') setSheet({ kind: 'sos' }); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [setSheet]);

  const close = useCallback(() => setBar(null), []);
  if (!bar) return null;
  return (
    <div className="remindbar" role="alert">
      <span className="rb-i"><Icon n="alert" /></span>
      <div><b>Небезпечна година · {hhmm(bar.min)}</b><p>{bar.text}</p></div>
      <div className="rb-a"><button className="btn acc sm" onClick={() => { setSheet({ kind: 'sos' }); close(); }}>SOS</button><button className="btn ghost sm" onClick={close}>Все добре</button></div>
    </div>
  );
}
