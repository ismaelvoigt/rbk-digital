import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import Credenciamento from '../src/app/processos/credenciamento/convites/page';

afterEach(() => vi.unstubAllEnvs());

test('main app offers the existing test environment instead of a form backed by the wrong database', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sqamrlckyuesfmibxizy.supabase.co');
  vi.stubEnv('AUDIT_PORTAL_ENABLED', '');
  const page = renderToStaticMarkup(React.createElement(Credenciamento));
  expect(page).toContain('https://rbk-auditoria-homologacao.vercel.app/processos/credenciamento/convites');
  expect(page).toContain('Abrindo credenciamento');
  expect(page).not.toContain('target="_blank"');
  expect(page).not.toContain('Retomar credenciamentos');
  expect(page).not.toContain('<iframe');
});

test('validated staging keeps the implemented invitation form embedded', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-staging.supabase.co');
  vi.stubEnv('AUDIT_STAGING_PROJECT_REF', 'test-staging');
  vi.stubEnv('AUDIT_PORTAL_ENABLED', 'true');
  vi.stubEnv('VERCEL_ENV', 'preview');
  const page = renderToStaticMarkup(React.createElement(Credenciamento));
  expect(page).toContain('src="/portal/credenciamento?gestor=1"');
  expect(page).not.toContain('Abrir credenciamentos de teste');
});
