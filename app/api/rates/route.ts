import { isAuthed, unauthorized } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Official NBU rate: how many hryvnias one Danish krone costs today. */
export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  try {
    const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=DKK&json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(String(res.status));
    const [row] = (await res.json()) as { rate: number; exchangedate: string }[];
    if (!(row?.rate > 0)) throw new Error('empty');
    return Response.json({ uahPerDkk: row.rate, date: row.exchangedate });
  } catch {
    return Response.json({ error: 'НБУ зараз не відповідає. Курс можна ввести вручну.' }, { status: 502 });
  }
}
