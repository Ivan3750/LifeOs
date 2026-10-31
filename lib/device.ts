'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Settings that belong to this device only (the phone's lock, its reminders). Kept in the browser's storage, never sent to the server. */
const EVT = 'pulse-device-prefs';
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener('storage', cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); }; };

export const readLocal = <T,>(key: string, def: T): T => { try { const v = localStorage.getItem(key); return v ? { ...def, ...JSON.parse(v) } : def; } catch { return def; } };
export function writeLocal(key: string, v: unknown | null) {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** [value, set] for one device setting; every component that uses the same key updates together. */
export function useDevicePref<T extends object>(key: string, def: T): [T, (v: T | null) => void] {
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } }, () => '');
  const val = useMemo(() => { try { return raw ? { ...def, ...JSON.parse(raw) } as T : def; } catch { return def; } }, [raw, def]);
  const set = useCallback((v: T | null) => writeLocal(key, v), [key]);
  return [val, set];
}

/** A phone or a tablet in the hand: the lock and the reminders are meant for it. */
export function isPhone() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1000);
}
