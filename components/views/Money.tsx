'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import type { AccId, Tx } from '@/lib/types';
import { account, accOf, balance, convert, CUR_SIGN, curOfTx, fmtCur, monthOf, rate, realTx, sumIn, toDKK } from '@/lib/money';
import { addD, CATS, daysInMonth, MON, MONTHN, pctW, TK, WD, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn } from '../shared';
import { WoltCard } from '../Wolt';
import { InsightsCard, MonthHero, Pots, RecurringCard, Trends } from '../MoneyExtras';

type Filter = 'all' | AccId;
type Kind = 'out' | 'in' | 'xfer';
const OTHER: Record<AccId, AccId> = { dk: 'ua', ua: 'dk' };
const shiftMonth = (mk: string, n: number) => { const d = new Date(mk + '-01T00:00'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
const num = (v: string) => +v.replace(',', '.').replace(/\s/g, '') || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Loads the NBU rate once it is older than 12 hours. */
function useAutoRate() {
  const { S, A } = useStore();
  useEffect(() => {
    if (Date.now() - S.money.rateAt < 12 * 3600e3) return;
    fetch('/api/rates').then(r => (r.ok ? r.json() : null)).then(j => { if (j?.uahPerDkk) A.setRate(j.uahPerDkk, 'nbu'); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function SaveNum({ id, label, value, onSave, suffix }: { id: string; label: string; value: number; onSave: (n: number) => void; suffix: string }) {
  const [v, setV] = useState(String(value));
  return (
    <label className="field" htmlFor={id}>{label}
      <div className="amtfield"><input id={id} inputMode="decimal" value={v} onChange={e => setV(e.target.value)} onBlur={() => onSave(num(v))} /><span>{suffix}</span></div>
    </label>
  );
}

function AccountCard({ id, mk, active, onPick }: { id: AccId; mk: string; active: boolean; onPick: () => void }) {
  const { S, A } = useStore();
  const [edit, setEdit] = useState(false);
  const a = account(S, id), list = monthOf(S, mk, id), cur = a.cur;
  const inc = sumIn(S, list, 'in', cur), out = sumIn(S, list, 'out', cur), bal = balance(S, id);
  const isNow = mk === TK().slice(0, 7), dl = daysInMonth() - new Date().getDate() + 1, left = a.budget - out;
  return (
    <div className={`card s4 acct${active ? ' on' : ''}`}>
      <div className="acct-h">
        <button className="acct-pick" onClick={onPick} aria-pressed={active} title="Показати лише цей рахунок"><span className={`curtag ${cur}`}>{CUR_SIGN[cur]}</span><b>{a.name}</b></button>
        <button className="sel" onClick={() => setEdit(!edit)}>{edit ? 'Готово' : 'Налаштувати'}</button>
      </div>
      <div className="acct-bal num" style={{ color: bal < 0 ? 'var(--m1)' : undefined }}>{fmtCur(bal, cur)}</div>
      <div className="muted acct-sub">баланс зараз</div>
      <div className="acct-row"><span className="num in">+{fmtCur(inc, cur)}</span><span className="num out">−{fmtCur(out, cur)}</span><span className="muted">за {MONTHN[+mk.slice(5) - 1].toLowerCase()}</span></div>
      {a.budget > 0 && S.money.budgetMode !== 'income' && (
        <>
          <div className="bar" style={{ marginTop: 10 }}><i style={{ width: pctW(out, a.budget) + '%', background: out > a.budget ? 'var(--m1)' : 'var(--accent)' }} /></div>
          <div className="muted acct-sub" style={{ marginTop: 6 }}>Бюджет {fmtCur(a.budget, cur)} · {left >= 0 ? `лишилось ${fmtCur(left, cur)}` : `перевищено на ${fmtCur(-left, cur)}`}{isNow && left > 0 ? ` · ≈ ${fmtCur(left / dl, cur)} на день` : ''}</div>
        </>
      )}
      {edit && (
        <div className="acct-edit">
          <SaveNum id={`op-${id}`} label="Початковий баланс" value={a.opening} suffix={CUR_SIGN[cur]} onSave={n => A.setAccount(id, { opening: n })} />
          <SaveNum id={`bd-${id}`} key={a.budget} label="Бюджет витрат на місяць" value={a.budget} suffix={CUR_SIGN[cur]} onSave={n => A.setAccount(id, { budget: Math.max(0, n) })} />
          <p className="help">Початковий баланс — скільки було на рахунку до першого запису тут. Бюджет 0 вимикає ліміт.</p>
        </div>
      )}
    </div>
  );
}

function TotalCard({ mk }: { mk: string }) {
  const { S, A, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const total = balance(S, 'dk') + convert(S, balance(S, 'ua'), 'UAH', 'DKK');
  const spent = sumIn(S, monthOf(S, mk), 'out'), inc = sumIn(S, monthOf(S, mk), 'in');
  const at = S.money.rateAt ? new Date(S.money.rateAt) : null;
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/rates'); const j = await r.json();
      if (j.uahPerDkk) { A.setRate(j.uahPerDkk, 'nbu'); toast(`Курс НБУ: 1 kr. = ${j.uahPerDkk.toFixed(2)} ₴`); } else toast(j.error || 'Не вдалося оновити курс');
    } catch { toast('Не вдалося оновити курс'); }
    setBusy(false);
  };
  return (
    <div className="card s4 acct total">
      <div className="acct-h"><b>Разом</b><span className="muted" style={{ fontSize: 12 }}>за курсом</span></div>
      <div className="acct-bal num">{fmtCur(total, 'DKK')}</div>
      <div className="muted acct-sub">≈ {fmtCur(convert(S, total, 'DKK', 'UAH'), 'UAH')}</div>
      <div className="acct-row"><span className="num in">+{fmtCur(inc, 'DKK')}</span><span className="num out">−{fmtCur(spent, 'DKK')}</span><span className="muted">обидва рахунки</span></div>
      <div className="rate">
        <span>1 kr. = <b className="num">{rate(S).toFixed(2)} ₴</b><small>{S.money.rateSrc === 'nbu' && at ? ` · НБУ, ${at.getDate()} ${MON[at.getMonth()]}` : at ? ' · введено вручну' : ' · приблизно'}</small></span>
        <button className="sel" disabled={busy} onClick={refresh}>{busy ? 'Оновлюю…' : 'Курс НБУ'}</button>
      </div>
      <div className="rate-manual">
        <input inputMode="decimal" placeholder="свій курс, ₴ за 1 kr." value={manual} onChange={e => setManual(e.target.value)} aria-label="Свій курс гривень за одну крону" />
        <button className="sqb" disabled={!(num(manual) > 0)} onClick={() => { A.setRate(num(manual), 'manual'); setManual(''); toast('Курс збережено'); }}>Зберегти</button>
      </div>
    </div>
  );
}

function TxForm({ filter, edit, onDone }: { filter: Filter; edit: Tx | null; onDone: () => void }) {
  const { S, A } = useStore();
  const [kind, setKind] = useState<Kind>(edit ? (edit.xfer ? 'xfer' : edit.type) : 'out');
  const [acc, setAcc] = useState<AccId>(edit ? accOf(edit) : filter === 'all' ? 'dk' : filter);
  const [amt, setAmt] = useState(edit ? String(edit.amt) : '');
  const [cat, setCat] = useState(edit && !edit.xfer ? edit.cat : CATS.out[0]);
  const [note, setNote] = useState(edit?.note || '');
  const [date, setDate] = useState(edit?.date || TK());
  const [recv, setRecv] = useState('');
  const amtRef = useRef<HTMLInputElement>(null);
  useEffect(() => { amtRef.current?.focus(); }, []);
  const cur = account(S, acc).cur, to = OTHER[acc], toCur = account(S, to).cur;
  const autoRecv = r2(convert(S, num(amt), cur, toCur));
  const notes = [...new Set(realTx(S).slice(-60).reverse().map(t => t.note).filter(Boolean))].slice(0, 12);
  const cats = kind === 'xfer' ? [] : CATS[kind];
  const pickKind = (k: Kind) => { setKind(k); if (k !== 'xfer' && !CATS[k].includes(cat)) setCat(CATS[k][0]); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = num(amt); if (!(a > 0)) return;
    if (edit?.xfer) { A.updateTx(edit.id, { note, date }); onDone(); return; }
    if (kind === 'xfer') { A.addTransfer(acc, to, a, num(recv) || autoRecv, date, note); setAmt(''); setRecv(''); setNote(''); return; }
    if (edit) { A.updateTx(edit.id, { type: kind, amt: a, cat, note, date, acc }); onDone(); return; }
    A.addTx(kind, a, cat, note, date, acc); setAmt(''); setNote('');
    amtRef.current?.focus();
  };

  return (
    <form className="card s5 txform" id="txform" onSubmit={submit}>
      <div className="ch" style={{ marginBottom: 0 }}><div><h3>{edit ? 'Змінити запис' : 'Новий запис'}</h3><p>{edit ? 'Зміни й збережи' : 'Enter зберігає, поле суми лишається активним'}</p></div></div>
      {!edit?.xfer && (
        <div className="seg">
          {([['out', 'Витрата'], ['in', 'Дохід'], ['xfer', 'Переказ']] as const).filter(([k]) => !edit || k !== 'xfer').map(([k, l]) => <button type="button" key={k} aria-pressed={kind === k} onClick={() => pickKind(k)}>{l}</button>)}
        </div>
      )}
      <div className="seg accseg" role="group" aria-label={kind === 'xfer' ? 'З рахунку' : 'Рахунок'}>
        {(['dk', 'ua'] as const).map(id => (
          <button type="button" key={id} aria-pressed={acc === id} disabled={!!edit?.xfer} onClick={() => setAcc(id)}>
            <span className={`curtag ${account(S, id).cur}`}>{CUR_SIGN[account(S, id).cur]}</span>{kind === 'xfer' ? 'З: ' : ''}{account(S, id).name.replace(' рахунок', '')}
          </button>
        ))}
      </div>
      <label className="field" htmlFor="txAmt">{kind === 'xfer' ? 'Скільки переказуєш' : 'Сума'}
        <div className="amtfield big"><input ref={amtRef} id="txAmt" inputMode="decimal" required placeholder="0" value={amt} disabled={!!edit?.xfer} onChange={e => setAmt(e.target.value)} autoComplete="off" /><span>{CUR_SIGN[cur]}</span></div>
      </label>
      {kind === 'xfer' && !edit && (
        <label className="field" htmlFor="txRecv">Надійде на {account(S, to).name.toLowerCase()}
          <div className="amtfield"><input id="txRecv" inputMode="decimal" placeholder={autoRecv ? String(autoRecv) : '0'} value={recv} onChange={e => setRecv(e.target.value)} /><span>{CUR_SIGN[toCur]}</span></div>
          <small className="muted">{num(amt) > 0 ? `за курсом ≈ ${fmtCur(autoRecv, toCur)}; впиши точну суму, якщо банк дав інший курс` : 'рахується за поточним курсом'}</small>
        </label>
      )}
      {cats.length > 0 && (
        <div className="field"><span>Категорія</span>
          <div className="tags">{cats.map(c => <button type="button" key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        </div>
      )}
      <label className="field" htmlFor="txNote">Коментар
        <input id="txNote" list="txNotes" placeholder={kind === 'xfer' ? 'Напр. поповнення з картки' : 'Кава з друзями'} autoComplete="off" value={note} onChange={e => setNote(e.target.value)} />
        <datalist id="txNotes">{notes.map(n => <option key={n} value={n} />)}</datalist>
      </label>
      <div className="row">
        <label className="field" htmlFor="txDate" style={{ flex: '1 1 150px' }}>Дата<input id="txDate" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <div className="row" style={{ alignSelf: 'flex-end', gap: 6 }}>
          <button type="button" className="sqb" onClick={() => setDate(TK())}>Сьогодні</button>
          <button type="button" className="sqb" onClick={() => setDate(ymd(addD(new Date(), -1)))}>Вчора</button>
        </div>
      </div>
      {edit?.xfer && <p className="help">У переказі можна змінити коментар і дату. Щоб змінити суму, видали переказ і створи новий.</p>}
      <div className="row">
        <button className="btn acc">{edit ? 'Зберегти зміни' : kind === 'xfer' ? 'Переказати' : 'Записати'}</button>
        {edit && <button type="button" className="btn ghost" onClick={onDone}>Скасувати</button>}
      </div>
    </form>
  );
}

function CatCard({ list, cur }: { list: Tx[]; cur?: 'DKK' | 'UAH' }) {
  const { S, A } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [lim, setLim] = useState('');
  const c = cur || 'DKK', by: Record<string, number> = {};
  list.filter(t => t.type === 'out').forEach(t => { by[t.cat] = (by[t.cat] || 0) + convert(S, t.amt, curOfTx(S, t), c); });
  // categories with a limit are shown even when nothing is spent there yet
  for (const k of Object.keys(S.money.catBudgets)) by[k] = by[k] || 0;
  const arr = Object.entries(by).sort((a, b) => b[1] - a[1]), max = Math.max(1, arr[0]?.[1] || 1, ...Object.values(S.money.catBudgets).map(v => toDKK(S, v, 'DKK') * (c === 'UAH' ? rate(S) : 1))), total = arr.reduce((a, [, v]) => a + v, 0);
  const open = (k: string) => { setEditing(k); setLim(S.money.catBudgets[k] ? String(S.money.catBudgets[k]) : ''); };
  return (
    <div className="card s7">
      <div className="ch"><div><h3>Куди йдуть гроші</h3><p>{cur ? 'Витрати рахунку за місяць' : 'Обидва рахунки, у кронах за курсом'}. Натисни «ліміт», щоб обмежити категорію.</p></div></div>
      <div className="cats">
        {arr.map(([k, v]) => {
          const limit = S.money.catBudgets[k], limC = limit ? limit * (c === 'UAH' ? rate(S) : 1) : 0, over = limit > 0 && v > limC;
          return (
            <div className="catrow2" key={k}>
              <div className="cr-h">
                <span>{k}</span>
                <span className="num">{fmtCur(v, c)} {total > 0 && <small className="muted">{Math.round((v / total) * 100)}%</small>}</span>
              </div>
              <div className="bar cr-bar"><i style={{ width: pctW(v, limC || max) + '%', background: over ? 'var(--m1)' : limit && v > limC * 0.85 ? 'var(--m2)' : undefined }} />{limit > 0 && <u style={{ left: pctW(limC, max) + '%' }} />}</div>
              <div className="cr-f">
                {editing === k
                  ? <form onSubmit={e => { e.preventDefault(); A.setCatBudget(k, +lim.replace(',', '.') || 0); setEditing(null); }} className="row" style={{ gap: 6 }}>
                      <input autoFocus inputMode="decimal" placeholder="kr. на місяць" value={lim} aria-label={`Ліміт для ${k}, kr.`} onChange={e => setLim(e.target.value)} onBlur={() => setEditing(null)} />
                      <button className="sqb" onMouseDown={e => e.preventDefault()}>Ок</button>
                    </form>
                  : <button className={`linkbtn${over ? ' over' : ''}`} onClick={() => open(k)}>{limit ? `ліміт ${fmtCur(limit, 'DKK')}${over ? `, перевищено на ${fmtCur(v / (c === 'UAH' ? rate(S) : 1) - limit, 'DKK')}` : ''}` : 'ліміт'}</button>}
              </div>
            </div>
          );
        })}
        {!arr.length && <p className="muted" style={{ margin: 0 }}>Витрат за цей місяць немає.</p>}
      </div>
    </div>
  );
}

function TxList({ mk, filter, onEdit }: { mk: string; filter: Filter; onEdit: (t: Tx) => void }) {
  const { S, A } = useStore();
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = S.money.tx
    .filter(t => t.date.slice(0, 7) === mk && (filter === 'all' || accOf(t) === filter))
    .filter(t => !ql || `${t.cat} ${t.note} ${t.amt}`.toLowerCase().includes(ql))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const days = [...new Set(list.map(t => t.date))];
  const yday = ymd(addD(new Date(), -1));
  return (
    <div className="card s12">
      <div className="ch">
        <div><h3>Записи</h3><p>{list.length} за {MONTHN[+mk.slice(5) - 1].toLowerCase()}{filter !== 'all' ? ` · ${account(S, filter).name.toLowerCase()}` : ''}</p></div>
        <input className="txsearch" placeholder="Пошук: кава, Netto, 250…" value={q} onChange={e => setQ(e.target.value)} aria-label="Пошук записів" />
      </div>
      {days.map(d => {
        const items = list.filter(t => t.date === d), dt = new Date(d + 'T00:00');
        const spent = filter === 'all' ? sumIn(S, items.filter(t => !t.xfer), 'out') : sumIn(S, items.filter(t => !t.xfer), 'out', account(S, filter).cur);
        return (
          <div key={d} className="txday">
            <div className="txday-h"><b>{d === TK() ? 'Сьогодні' : d === yday ? 'Вчора' : `${WD[dt.getDay()]}, ${dt.getDate()} ${MON[dt.getMonth()]}`}</b>{spent > 0 && <span className="num">−{fmtCur(spent, filter === 'all' ? 'DKK' : account(S, filter).cur)}</span>}</div>
            {items.map(t => {
              const cur = curOfTx(S, t), x = t.xfer ? S.money.tx.find(o => o.xfer === t.xfer && o.id !== t.id) : null;
              return (
                <div className="item txitem" key={t.id}>
                  <span className={`curtag ${cur}`}>{CUR_SIGN[cur]}</span>
                  <span className="t">
                    {t.xfer ? <>{t.type === 'out' ? `Переказ → ${x ? account(S, accOf(x)).name.replace(' рахунок', '') : ''}` : `Переказ ← ${x ? account(S, accOf(x)).name.replace(' рахунок', '') : ''}`}</> : t.cat}
                    {t.note && <span className="muted"> · {t.note}</span>}
                  </span>
                  <span className="txamt">
                    <b className="num" style={{ color: t.xfer ? 'var(--muted)' : t.type === 'in' ? 'var(--good)' : 'var(--ink)' }}>{t.type === 'in' ? '+' : '−'}{fmtCur(t.amt, cur)}</b>
                    {filter === 'all' && cur === 'UAH' && <small className="muted num">≈ {fmtCur(convert(S, t.amt, 'UAH', 'DKK'), 'DKK')}</small>}
                  </span>
                  <button className="ib" onClick={() => onEdit(t)} aria-label="Змінити запис" title="Змінити"><Icon n="edit" /></button>
                  <DelBtn label={t.xfer ? 'Видалити переказ' : 'Видалити запис'} onDelete={() => A.delTx(t.id)} />
                </div>
              );
            })}
          </div>
        );
      })}
      {!list.length && <p className="muted">{ql ? 'Нічого не знайдено.' : 'Записів за цей місяць немає.'}</p>}
    </div>
  );
}

export function Money() {
  useAutoRate();
  const { S } = useStore();
  const now = TK().slice(0, 7);
  const [mk, setMk] = useState(now);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Tx | null>(null);
  const monthList = monthOf(S, mk, filter === 'all' ? undefined : filter);
  const startEdit = (t: Tx) => { setEditing(t); setTimeout(() => document.getElementById('txform')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0); };
  return (
    <section className="view">
      <div className="vh">
        <div><h2>Фінанси</h2><p>Дохід і витрати разом: бюджет, скарбнички, регулярні платежі. Два рахунки, разом за курсом НБУ.</p></div>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <div className="seg">
            {([['all', 'Усі'], ['dk', 'kr.'], ['ua', '₴']] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <div className="monthnav">
            <button className="btn ghost cal-nav" aria-label="Попередній місяць" onClick={() => setMk(shiftMonth(mk, -1))}>‹</button>
            <b>{MONTHN[+mk.slice(5) - 1]} {mk.slice(0, 4)}</b>
            <button className="btn ghost cal-nav" aria-label="Наступний місяць" disabled={mk >= now} onClick={() => setMk(shiftMonth(mk, 1))}>›</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}><MonthHero mk={mk} /></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <AccountCard id="dk" mk={mk} active={filter === 'dk'} onPick={() => setFilter(filter === 'dk' ? 'all' : 'dk')} />
        <AccountCard id="ua" mk={mk} active={filter === 'ua'} onPick={() => setFilter(filter === 'ua' ? 'all' : 'ua')} />
        <TotalCard mk={mk} />
        <WoltCard />
      </div>
      <div style={{ marginTop: 18 }}><InsightsCard mk={mk} /></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <Pots />
        <RecurringCard />
        <Trends />
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <TxForm key={editing ? 'e' + editing.id : 'new-' + filter} filter={filter} edit={editing} onDone={() => setEditing(null)} />
        <CatCard list={monthList} cur={filter === 'all' ? undefined : account(S, filter).cur} />
        <TxList mk={mk} filter={filter} onEdit={startEdit} />
      </div>
      <p className="help" style={{ marginTop: 14 }}><Icon n="search" /> Швидко з будь-якого місця: Ctrl K і «-45 кава» для кронового рахунку або «-250 ₴ таксі» для гривневого. Перекази між рахунками не рахуються як дохід чи витрата.</p>
    </section>
  );
}
