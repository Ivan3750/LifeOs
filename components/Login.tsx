'use client';

import { useState, type FormEvent } from 'react';

export default function Login({ setup = false }: { setup?: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) { location.reload(); return; }
      const j = await res.json().catch(() => ({}));
      setError(res.status === 429 ? `Забагато спроб. Спробуй через ${j.retryIn || 60} с.` : 'Неправильний пароль.');
    } catch {
      setError('Сервер не відповідає. Перевір, що застосунок запущено.');
    }
    setBusy(false);
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand"><span className="logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 20V11a6 6 0 0 1 12 0v9" /></svg></span>Pulse OS</div>
        {setup ? (
          <>
            <h1>Потрібне налаштування</h1>
            <p className="muted">Скопіюй <code>.env.example</code> у <code>.env</code>, впиши <code>APP_PASSWORD</code> і дані бази, потім перезапусти <code>npm run dev</code>.</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1>Вхід</h1>
            <p className="muted">Введи пароль від свого дашборду.</p>
            <label className="field" htmlFor="pw">Пароль
              <input id="pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            {error && <p className="login-err" role="alert">{error}</p>}
            <button className="btn acc" disabled={busy || !password}>{busy ? 'Перевіряю…' : 'Увійти'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
