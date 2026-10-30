'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// The app works from browser storage first and syncs with the server, so it renders on the client only.
const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <div className="boot" aria-busy="true">Pulse OS</div>,
});

export default function ClientApp({ db }: { db: boolean }) {
  // offline copy of the app (see public/sw.js); only in the production build, where files are not rebuilt all the time
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return <App db={db} />;
}
