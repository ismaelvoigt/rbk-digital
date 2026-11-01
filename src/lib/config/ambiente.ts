type Environment = Record<string, string | undefined>;
const productionOrigin = 'https://rbk-digital.vercel.app';
const developmentProject = 'prj_RZi39iUZqcywEt1JGmmD7KvMrHlQ';
const developmentDatabase = 'https://ympeqcycjadvvumanmwm.supabase.co';

export function publicOrigin(env: Environment = process.env): string {
  const development = env.NEXT_PUBLIC_RBK_ENV === 'development';
  const value = env.RBK_PUBLIC_ORIGIN?.trim() || (!development ? productionOrigin : '');
  if (!value) throw new Error('Configure RBK_PUBLIC_ORIGIN para desenvolvimento.');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('Origem pública inválida.');
  }
  if (development && url.origin === productionOrigin) throw new Error('Desenvolvimento não pode apontar para a origem de produção.');
  return url.origin;
}

export function assertDevelopmentIsolation(env: Environment = process.env): void {
  const development = env.NEXT_PUBLIC_RBK_ENV === 'development';
  if (env.VERCEL_PROJECT_ID === developmentProject && !development) {
    throw new Error('O projeto de testes exige NEXT_PUBLIC_RBK_ENV=development.');
  }
  if (!development) return;
  if (env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== developmentDatabase) {
    throw new Error('Desenvolvimento exige o banco isolado rbk-digital-testes.');
  }
  publicOrigin(env);
}
