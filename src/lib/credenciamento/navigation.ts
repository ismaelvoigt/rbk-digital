const invitationPage = 'https://rbk-auditoria-homologacao.vercel.app/processos/credenciamento/convites';
const dashboards = new Set([
  'http://localhost:3000/dashboard',
  'http://127.0.0.1:3000/dashboard',
  'https://rbk-digital.vercel.app/dashboard',
]);

export function dashboardReturn(search: string) {
  const destination = new URLSearchParams(search).get('returnTo') || '';
  return dashboards.has(destination) ? destination : '/dashboard';
}

export function invitationEntry(origin: string) {
  const destination = `${origin}/dashboard`;
  return dashboards.has(destination)
    ? `${invitationPage}?returnTo=${encodeURIComponent(destination)}`
    : invitationPage;
}
