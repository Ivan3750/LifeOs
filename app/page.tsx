import ClientApp from '@/components/ClientApp';
import Login from '@/components/Login';
import { authConfigured, isAuthed } from '@/lib/server/auth';
import { dbConfigured } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!authConfigured()) return <Login setup />;
  if (!(await isAuthed())) return <Login />;
  return <ClientApp db={dbConfigured()} />;
}
