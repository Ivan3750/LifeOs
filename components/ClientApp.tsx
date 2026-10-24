'use client';

import dynamic from 'next/dynamic';

// The app works from browser storage first and syncs with the server, so it renders on the client only.
const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <div className="boot" aria-busy="true">Pulse OS</div>,
});

export default function ClientApp({ db }: { db: boolean }) {
  return <App db={db} />;
}
