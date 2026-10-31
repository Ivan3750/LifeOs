'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isPhone, readLocal, useDevicePref, writeLocal } from '@/lib/device';
import { checkPin, makePin, pinHints, validPin, waitAfter, type PinRecord } from '@/lib/pin';
import { useStore } from '@/lib/store';
import { Icon } from './Icon';

export const PIN_KEY = 'pulse-os-pin';
const FAILS = 'pulse-os-pin-fails';
const DEF: PinRecord | { salt: ''; hash: ''; it: 0; lock: 0 } = { salt: '', hash: '', it: 0, lock: 0 };
const has = (r: PinRecord | typeof DEF): r is PinRecord => !!r.hash;
type Fails = { n: number; until: number };

/** Locks the app on a phone when a code is set. The code and the wrong-attempt counter stay on this device; the unlocked state is only in memory,
    so closing the app or reloading the page asks for the code again. */
export function PinGate({ children }: { children: ReactNode }) {
  const [rec] = useDevicePref<PinRecord | typeof DEF>(PIN_KEY, DEF);
  const on = has(rec) && isPhone();
  const [locked, setLocked] = useState(() => { const r = readLocal<PinRecord | typeof DEF>(PIN_KEY, DEF); return has(r) && isPhone(); });
  const hiddenAt = useRef(0);

  useEffect(() => {
    if (!on) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); if (rec.lock === 0) setLocked(true); }
      else if (hiddenAt.current && (Date.now() - hiddenAt.current) / 1000 >= rec.lock) setLocked(true);
    };
    const onLock = () => setLocked(true);
    document.addEventListener('visibilitychange', onVis); window.addEventListener('pulse-lock', onLock);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pulse-lock', onLock); };
  }, [on, rec.lock]);

  const show = on && locked;
  return (
    <>
      <div hidden={show} aria-hidden={show} style={{ display: 'contents' }}>{children}</div>
      {show && has(rec) && <Lock rec={rec} onOpen={() => setLocked(false)} />}
    </>
  );
}

function Lock({ rec, onOpen }: { rec: PinRecord; onOpen: () => void }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fails = readLocal<Fails>(FAILS, { n: 0, until: 0 });
  const wait = Math.max(0, Math.ceil((fails.until - now) / 1000));
  useEffect(() => { if (wait <= 0) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [wait]);

  const submit = async () => {
    if (busy || wait > 0 || !v) return;
    setBusy(true);
    let ok = false;
    try { ok = validPin(v) && await checkPin(v, rec); } catch { setErr('Цей браузер не вміє перевіряти код. Увійди заново паролем.'); setBusy(false); return; }
    setBusy(false);
    if (ok) { writeLocal(FAILS, null); setV(''); onOpen(); return; }
    const n = fails.n + 1, w = waitAfter(n);
    writeLocal(FAILS, { n, until: w ? Date.now() + w * 1000 : 0 }); setNow(Date.now());
    setV(''); setErr(w ? `Забагато спроб. Зачекай ${w} с.` : `Невірний код. Спроб до паузи: ${5 - n}`);
  };
  const forgot = async () => {
    if (!window.confirm('Забув код? Я вийду з акаунта й зніму код із цього телефона. Далі ти увійдеш паролем від застосунку.')) return;
    await fetch('/api/login', { method: 'DELETE' }).catch(() => {});
    writeLocal(PIN_KEY, null); writeLocal(FAILS, null);
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch {}
    location.reload();
  };
  return (
    <div className="pinlock" role="dialog" aria-modal="true" aria-label="Застосунок заблоковано">
      <div className="pin-card">
        <span className="logo"><Icon n="logo" /></span>
        <h1>LifeOs заблоковано</h1>
        <p>Введи код з англійських літер і цифр.</p>
        {/* not a form and not a password field of the page: the browser must not offer to save the code */}
        <input className="pin-in" type="password" value={v} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="text" maxLength={32} name="lifeos-lock-code" data-lpignore="true" data-1p-ignore="true"
          aria-label="Код" disabled={wait > 0} onChange={e => { setV(e.target.value.replace(/[^A-Za-z0-9]/g, '')); setErr(''); }} onKeyDown={e => e.key === 'Enter' && submit()} />
        <div className="pin-err" role="status">{wait > 0 ? `Зачекай ${wait} с` : err}</div>
        <button className="btn acc" disabled={busy || wait > 0 || v.length < 4} onClick={submit}>{busy ? 'Перевіряю…' : 'Відкрити'}</button>
        <button className="linkbtn" onClick={forgot}>Забув код</button>
      </div>
    </div>
  );
}

const LOCKS: [number, string][] = [[0, 'Одразу, коли виходжу із застосунку'], [60, 'Через 1 хвилину'], [300, 'Через 5 хвилин'], [900, 'Через 15 хвилин']];

/** Settings card: set, change or remove the phone's code. Shown on phones only, because the code lives on the device it is set on. */
export function PinSettings() {
  const { toast } = useStore();
  const [rec, setRec] = useDevicePref<PinRecord | typeof DEF>(PIN_KEY, DEF);
  const [phone] = useState(() => isPhone());
  const [pin, setPin] = useState(''), [again, setAgain] = useState(''), [lock, setLock] = useState(0), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const hints = pinHints(pin), canSubtle = typeof crypto !== 'undefined' && !!crypto.subtle;
  const save = async () => {
    if (!validPin(pin)) { toast('Код: від 4 до 32 символів, лише англійські літери й цифри'); return; }
    if (pin !== again) { toast('Коди не збігаються'); return; }
    setBusy(true);
    try { setRec(await makePin(pin, lock)); writeLocal(FAILS, null); setPin(''); setAgain(''); setOpen(false); toast('Код встановлено. Застосунок блокуватиметься на цьому телефоні'); }
    catch { toast('Не вдалося зберегти код у цьому браузері'); }
    setBusy(false);
  };
  const setLockAfter = (n: number) => { if (has(rec)) setRec({ ...rec, lock: n }); setLock(n); };
  return (
    <div className="card cardcol">
      <div className="ch" style={{ margin: 0 }}><Icon n="user" className="ic" /><div><h3>Код на телефоні</h3><p>Замок на екран: літери й цифри. Діє лише на телефоні, де його встановлено</p></div></div>
      {!phone ? <p className="help" style={{ margin: 0 }}>Код налаштовується з телефона й діє лише там: відкрий LifeOs на телефоні та зайди в Налаштування. На комп’ютері застосунок не блокується.</p>
        : !canSubtle ? <p className="help" style={{ margin: 0 }}>Цей браузер не дає зберегти код: для цього потрібне захищене з’єднання (https).</p>
        : (
          <>
            {has(rec) && !open ? (
              <>
                <p className="help" style={{ margin: 0 }}>Код встановлено. Він зберігається лише на цьому телефоні у вигляді хеша, а розблоковане становище не запамʼятовується: після закриття застосунку код потрібен знову.</p>
                <label className="field" htmlFor="pinLock">Коли блокувати
                  <select id="pinLock" value={rec.lock} onChange={e => setLockAfter(+e.target.value)}>{LOCKS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
                </label>
                <div className="row">
                  <button className="btn" onClick={() => window.dispatchEvent(new Event('pulse-lock'))}>Заблокувати зараз</button>
                  <button className="btn ghost" onClick={() => setOpen(true)}>Змінити код</button>
                  <button className="btn ghost danger" onClick={() => { if (window.confirm('Вимкнути код на цьому телефоні?')) { setRec(null); toast('Код вимкнено'); } }}>Вимкнути</button>
                </div>
              </>
            ) : (
              <>
                <label className="field" htmlFor="pinNew">Новий код (A–Z, a–z, 0–9)
                  <input id="pinNew" type="password" value={pin} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={32} data-lpignore="true" data-1p-ignore="true" onChange={e => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, ''))} />
                </label>
                <label className="field" htmlFor="pinAgain">Повтори код
                  <input id="pinAgain" type="password" value={again} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={32} data-lpignore="true" data-1p-ignore="true" onChange={e => setAgain(e.target.value.replace(/[^A-Za-z0-9]/g, ''))} />
                </label>
                {pin && hints.length > 0 && <p className="help" style={{ margin: 0 }}>Порада: {hints.join(', ')}.</p>}
                {!has(rec) && <label className="field" htmlFor="pinLock2">Коли блокувати
                  <select id="pinLock2" value={lock} onChange={e => setLock(+e.target.value)}>{LOCKS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
                </label>}
                <div className="row">
                  <button className="btn acc" disabled={busy || pin.length < 4} onClick={save}>{busy ? 'Зберігаю…' : has(rec) ? 'Зберегти новий код' : 'Встановити код'}</button>
                  {open && <button className="btn ghost" onClick={() => { setOpen(false); setPin(''); setAgain(''); }}>Скасувати</button>}
                </div>
              </>
            )}
            <p className="help" style={{ margin: 0 }}>Це замок екрана від сторонніх очей, а не шифрування даних. Якщо забув код, на екрані блокування є «Забув код»: він виводить з акаунта, і ти входиш заново паролем.</p>
          </>
        )}
    </div>
  );
}
