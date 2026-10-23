'use client';

import dynamic from 'next/dynamic';

// All data lives in the browser (localStorage), so the app renders on the client only.
const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <div className="boot" aria-busy="true">Pulse OS</div>,
});

export default function ClientApp() {
  return <App />;
}
