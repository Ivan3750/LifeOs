import { describe, expect, it } from 'vitest';
import { dbError, dbSettings } from '@/lib/server/db';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe('database settings', () => {
  it('reads a PostgreSQL URL with an escaped password and defaults the port', () => {
    const s = dbSettings(env({ DATABASE_URL: 'postgres://lifeos:p%40ss%20w%2Frd@db.example.com/lifeos' }))!;
    expect(s.o).toMatchObject({ host: 'db.example.com', port: 5432, user: 'lifeos', password: 'p@ss w/rd', database: 'lifeos' });
    expect(s.ssl).toBe(false);
    expect(s.o.ssl).toBeUndefined();
  });

  it('turns SSL on from sslmode in the URL, without checking the certificate unless asked', () => {
    const a = dbSettings(env({ DATABASE_URL: 'postgresql://u:p@h:6543/d?sslmode=require' }))!;
    expect(a.o.port).toBe(6543);
    expect(a.o.ssl).toEqual({ rejectUnauthorized: false });
    const b = dbSettings(env({ DATABASE_URL: 'postgres://u:p@h/d?sslmode=require', DB_SSL_VERIFY: 'true' }))!;
    expect(b.o.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('lets DB_SSL override the URL, and reads separate variables', () => {
    expect(dbSettings(env({ DATABASE_URL: 'postgres://u:p@h/d?sslmode=require', DB_SSL: 'false' }))!.o.ssl).toBeUndefined();
    const s = dbSettings(env({ DB_HOST: 'h', DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'n', DB_SSL: 'true' }))!;
    expect(s.o).toMatchObject({ host: 'h', port: 5432, user: 'u', password: 'p', database: 'n', ssl: { rejectUnauthorized: false } });
  });

  it('is not configured without a URL or a host and a user', () => {
    expect(dbSettings(env({}))).toBeNull();
    expect(dbSettings(env({ DB_HOST: 'h' }))).toBeNull();
  });
});

describe('database errors', () => {
  it('explains the usual failures and never prints connection details', () => {
    expect(dbError({ code: '28P01', message: 'password authentication failed for user "x" at secret.host' })).toBe('28P01: неправильний логін або пароль до бази');
    expect(dbError({ code: '3D000' })).toContain('DB_NAME');
    expect(dbError({ code: 'ENOTFOUND' })).toContain('DB_HOST');
    expect(dbError({ message: 'The server does not support SSL connections' })).toContain('DB_SSL=false');
    expect(dbError(new Error('secret@host:5432'))).toBe('не вдалося підключитися до бази');
  });
});
