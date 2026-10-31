'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { streakDays, streakHours, TOOLS, TRIGGERS } from '@/lib/quit';
import { fmt } from '@/lib/util';
import { Icon } from './Icon';

/** A craving rises and falls in about 10–15 minutes. The tools below fill the first two, which are the hardest. */
const WAVE = 15 * 60;

/** Counts seconds up while mounted (or stops at `limit`). */
function useSeconds(limit = Infinity, run = true) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t0 = Date.now(), id = setInterval(() => setS(Math.min(limit, Math.floor((Date.now() - t0) / 1000))), 250);
    return () => clearInterval(id);
  }, [limit, run]);
  return s;
}

/** Box breathing: in 4, hold 4, out 4, hold 4. Two minutes. */
function Breath({ onDone }: { onDone: () => void }) {
  const total = 120, s = useSeconds(total);
  useEffect(() => { if (s >= total) onDone(); }, [s, onDone]);
  const phase = Math.floor((s % 16) / 4), names = ['Вдих', 'Затримай', 'Видих', 'Затримай'], left = 4 - (s % 4);
  return (
    <div className="sos-tool">
      <div className={`breath p${phase}`} aria-live="polite"><b>{names[phase]}</b><span className="num">{left}</span></div>
      <p className="help" style={{ textAlign: 'center', margin: 0 }}>Дихай за колом: вдих носом, затримка, повільний видих. Лишилось {fmt(total - s)}.</p>
    </div>
  );
}

const MOVES: [string, string][] = [['Присідання', 'Повільно, 15–20 разів, спина рівна'], ['Віджимання', 'Від підлоги або від стіни, скільки зможеш'], ['Планка', 'Тримай корпус рівним, дихай рівно'], ['Біг на місці', 'З високим підйомом колін']];
/** Four moves of 30 seconds: enough to take the blood to the muscles instead of the craving. */
function Moves({ onDone }: { onDone: () => void }) {
  const each = 30, s = useSeconds(MOVES.length * each), i = Math.min(MOVES.length - 1, Math.floor(s / each));
  useEffect(() => { if (s >= MOVES.length * each) onDone(); }, [s, onDone]);
  return (
    <div className="sos-tool">
      <div className="moveq"><span className="num">{each - (s % each)}</span><b>{MOVES[i][0]}</b><small>{MOVES[i][1]}</small></div>
      <div className="movedots">{MOVES.map((m, j) => <i key={m[0]} className={j < i ? 'done' : j === i ? 'cur' : ''} />)}</div>
      <p className="help" style={{ textAlign: 'center', margin: 0 }}>Крок {i + 1} з {MOVES.length}. Після останнього випий склянку води.</p>
    </div>
  );
}

/** A 30-second game that takes the attention: tap the lit square as fast as you can. */
function Game({ onDone }: { onDone: () => void }) {
  const total = 30, s = useSeconds(total), [on, setOn] = useState(5), [score, setScore] = useState(0), seed = useRef(12345);
  useEffect(() => { if (s >= total) onDone(); }, [s, onDone]);
  const hit = (i: number) => { if (i !== on) return; setScore(x => x + 1); let n = on; while (n === on) { seed.current = (seed.current * 1664525 + 1013904223) >>> 0; n = (seed.current >>> 16) % 16; } setOn(n); };
  return (
    <div className="sos-tool">
      <div className="gamebar"><span>Лови підсвічений квадрат</span><b className="num">{score}</b><span className="num">{total - s} с</span></div>
      <div className="gamegrid" role="group" aria-label="Гра">{[...Array(16)].map((_, i) => <button key={i} className={i === on ? 'on' : ''} aria-label={i === on ? 'Натисни' : 'Порожньо'} onClick={() => hit(i)} />)}</div>
    </div>
  );
}

type Tool = 'exercise' | 'breath' | 'game';

/** The SOS sheet: what to pick when the craving is strong, quick alternatives, and a short record of what set it off. */
export function SosBody({ close, habit }: { close: () => void; habit?: number }) {
  const { S, A, go } = useStore();
  const [hid, setHid] = useState<number | undefined>(habit ?? S.badHabits[0]?.id);
  const [trigger, setTrigger] = useState('');
  const [tool, setTool] = useState<Tool | null>(null);
  const [used, setUsed] = useState<Tool | undefined>();
  const [ended, setEnded] = useState(false);
  const [slipped, setSlipped] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const wave = useSeconds(WAVE, !slipped);
  const h = S.badHabits.find(x => x.id === hid);
  const finish = useCallback((t: Tool) => { setUsed(t); setTool(null); setEnded(true); }, []);
  const onBreath = useCallback(() => finish('breath'), [finish]), onMoves = useCallback(() => finish('exercise'), [finish]), onGame = useCallback(() => finish('game'), [finish]);

  if (!S.badHabits.length) return (
    <div className="sos">
      <p className="help" style={{ margin: 0 }}>Спочатку додай звичку, від якої хочеш відмовитись, і лічильник днів без зривів почне рахуватись.</p>
      <button className="btn acc" onClick={() => { close(); go('quit'); }}>До розділу «Відмова»</button>
    </div>
  );

  if (slipped) return (
    <div className="sos">
      <div className="sos-msg"><b>Це не кінець, це дані.</b><p>Серію перезапущено, але найкращий результат і всі чисті дні лишились з тобою. Один зрив не стирає тижні роботи над собою.</p></div>
      {h && <div className="kv k3"><div><span className="k">Найкраща серія</span><span className="v num">{Math.max(h.best, 0)}<small>дн</small></span></div><div><span className="k">Зривів</span><span className="v num">{h.slips.length}</span></div><div><span className="k">Нова серія</span><span className="v num">0<small>дн</small></span></div></div>}
      <p className="help" style={{ margin: 0 }}>Що допоможе наступного разу: {trigger ? <>ти вказав причину «{trigger.toLowerCase()}», тож заздалегідь придумай, чим замінити цей момент.</> : 'коли виникне потяг, відмітити причину й одразу запустити одну з вправ.'}</p>
      <button className="btn" onClick={close}>Закрити</button>
    </div>
  );

  return (
    <div className="sos">
      <div className="sos-wave">
        <div className="row" style={{ justifyContent: 'space-between' }}><b>Потяг мине</b><span className="num muted">{fmt(wave)} з ≈{WAVE / 60} хв</span></div>
        <div className="bar"><i style={{ width: Math.min(100, (wave / WAVE) * 100) + '%', background: 'var(--accent)' }} /></div>
        <p className="help" style={{ margin: 0 }}>Найсильніша частина хвилі триває кілька хвилин. Тобі не треба перемагати назавжди: лише пережити цей момент.</p>
      </div>

      {S.badHabits.length > 1 && (
        <div className="tags" role="group" aria-label="Звичка">{S.badHabits.map(x => <button key={x.id} type="button" aria-pressed={x.id === hid} onClick={() => setHid(x.id)}>{x.name}</button>)}</div>
      )}
      {h && <p className="help" style={{ margin: 0 }}>Зараз без зривів: <b>{streakDays(h) ? `${streakDays(h)} дн` : `${streakHours(h)} год`}</b>. Це варто зберегти.</p>}

      {!tool && (
        <>
          <div>
            <div className="subh" style={{ margin: '0 0 8px' }}>Що спричинило? <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>(необовʼязково)</span></div>
            <div className="tags" role="group" aria-label="Причина потягу">{TRIGGERS.map(t => <button key={t} type="button" aria-pressed={trigger === t} onClick={() => setTrigger(trigger === t ? '' : t)}>{t}</button>)}</div>
          </div>
          <div>
            <div className="subh" style={{ margin: '0 0 8px' }}>Зроби це зараз (2 хвилини)</div>
            <div className="sostools">
              <button onClick={() => setTool('exercise')}><span className="ic"><Icon n="flame" /></span><b>Вправи</b><small>4 рухи по 30 с</small></button>
              <button onClick={() => setTool('breath')}><span className="ic"><Icon n="wave" /></span><b>Дихання</b><small>квадрат 4-4-4-4</small></button>
              <button onClick={() => setTool('game')}><span className="ic"><Icon n="play" /></span><b>Гра</b><small>30 с, відволікає</small></button>
            </div>
          </div>
        </>
      )}
      {tool === 'breath' && <Breath onDone={onBreath} />}
      {tool === 'exercise' && <Moves onDone={onMoves} />}
      {tool === 'game' && <Game onDone={onGame} />}
      {tool && <button className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => setTool(null)}>Зупинити й вибрати інше</button>}

      {!tool && (
        <div className="sos-end">
          <div className="subh" style={{ margin: '0 0 8px' }}>{ended ? `Після «${TOOLS[used!].toLowerCase()}»: як зараз?` : 'Чим закінчилось?'}</div>
          <div className="row">
            <button className="btn acc" disabled={!h} onClick={() => { A.logCraving(hid!, trigger || 'Інше', 'resisted', used); close(); }}>Потяг минув, витримав</button>
            {ended && <button className="btn ghost" onClick={() => { setEnded(false); }}>Ще тримає</button>}
            <button className="btn ghost danger" disabled={!h} onClick={() => { if (!window.confirm('Записати зрив? Серія перезапуститься, але найкращий результат і чисті дні збережуться.')) return; A.slipBad(hid!, trigger || 'Інше', used); setSlipped(true); }}>Зірвався</button>
          </div>
          <p className="help" style={{ margin: '10px 0 0' }}>Відкрито о {new Date(openedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}. Якщо щось іде дуже погано, зателефонуй близькій людині або на лінію підтримки.</p>
        </div>
      )}
    </div>
  );
}
