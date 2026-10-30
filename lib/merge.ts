/** Three-way merge of two edited copies of the state.
    base: the last copy both sides agreed on, local: this device, remote: the other device.
    Lists of records are merged by id, so an item added on one device and another one edited on the second device both survive;
    an item deleted on one side stays deleted unless the other side changed it. If both sides changed the same value, local wins. */

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const eq = (a: Json, b: Json) => a === b || JSON.stringify(a) === JSON.stringify(b);
/** Records are told apart by id; sessions have no id and use their start time. */
const keyOf = (v: Json): string | null => {
  if (!isObj(v)) return null;
  const k = v.id ?? v.t ?? v.key;
  return typeof k === 'number' || typeof k === 'string' ? String(k) : null;
};
const isRecordList = (a: Json[]) => a.length > 0 && a.every(x => keyOf(x) !== null);

/** Values that only make sense as a whole (a half-merged timer would be nonsense). */
const ATOMIC = new Set(['timer', 'act', 'meals', 'workDays', 'wheel']);

export function mergeStates<T extends Obj>(base: T, local: T, remote: T): T {
  /** The next free id: starts where the devices stopped counting and moves on for every record re-numbered below. */
  let maxId = Math.max(Number(local.nextId) || 0, Number(remote.nextId) || 0);

  const mergeList = (b: Json[], l: Json[], r: Json[]): Json[] => {
    const bm = new Map(b.map(x => [keyOf(x)!, x])), lm = new Map(l.map(x => [keyOf(x)!, x])), rm = new Map(r.map(x => [keyOf(x)!, x]));
    const out: Json[] = [];
    for (const [k, rv] of rm) {
      const lv = lm.get(k), bv = bm.get(k);
      if (lv === undefined) {
        // gone on this device: stays gone, unless the other device changed it meanwhile
        if (bv === undefined || !eq(rv, bv)) out.push(rv);
      } else if (bv === undefined && !eq(lv, rv) && isObj(lv) && typeof lv.id === 'number') {
        // both devices created different records with the same id: keep both, local one gets a new id
        out.push(rv, { ...lv, id: maxId++ });
      } else out.push(merge(bv, lv, rv));
    }
    for (const [k, lv] of lm) {
      if (rm.has(k)) continue;
      // missing remotely: removed there (drop it unless it was edited here) or just added here
      if (bm.has(k) && eq(lv, bm.get(k))) continue;
      out.push(lv);
    }
    return out;
  };

  const merge = (b: Json, l: Json, r: Json, key = ''): Json => {
    if (eq(l, b)) return r;
    if (eq(r, b) || eq(l, r)) return l;
    if (ATOMIC.has(key)) return l;
    if (Array.isArray(l) && Array.isArray(r)) {
      const bl = Array.isArray(b) ? b : [];
      return isRecordList(l.length ? l : r) && isRecordList(r.length ? r : l) ? mergeList(bl, l, r) : l;
    }
    if (isObj(l) && isObj(r)) {
      const bo = isObj(b) ? b : {}, out: Obj = {};
      for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
        const v = merge(bo[k], l[k], r[k], k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    return l;
  };

  const out = merge(base, local, remote) as T;
  // ids handed out on either device (and the re-numbered ones above) must never be reused
  if (typeof out.nextId === 'number') (out as Obj).nextId = Math.max(out.nextId, maxId);
  return out;
}
