import { expect, test } from 'vitest';
import { dashboardReturn, invitationEntry } from '../src/lib/credenciamento/navigation';

test('entry from the current local dashboard carries its return address', () => {
  const entry = new URL(invitationEntry('http://localhost:3000'));
  expect(entry.origin).toBe('https://rbk-auditoria-homologacao.vercel.app');
  expect(entry.pathname).toBe('/processos/credenciamento/convites');
  expect(dashboardReturn(entry.search)).toBe('http://localhost:3000/dashboard');
});
test('entry from the published app returns to its own dashboard', () => {
  expect(dashboardReturn(new URL(invitationEntry('https://rbk-digital.vercel.app')).search))
    .toBe('https://rbk-digital.vercel.app/dashboard');
});
test.each(['https://evil.example/dashboard','javascript:alert(1)','//evil.example','http://localhost:3000.evil.example/dashboard','http://localhost:3000/dashboard?redirect=evil','https://rbk-digital.vercel.app@evil.example/dashboard'])('rejects unapproved dashboard destination %s', destination => {
  expect(dashboardReturn('?returnTo='+encodeURIComponent(destination))).toBe('/dashboard');
});
test('direct entry keeps the dashboard of the current environment', () => {
  expect(dashboardReturn('')).toBe('/dashboard');
});
