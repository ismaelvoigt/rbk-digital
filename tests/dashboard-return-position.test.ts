import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';

const pages=[
 ['lista de farmácias','src/app/usuarios/page.tsx'],
 ['cadastro de farmácia','src/app/usuarios/novo/page.tsx'],
 ['edição de farmácia','src/app/usuarios/[id]/editar/page.tsx'],
 ['autorizações da farmácia','src/app/usuarios/[id]/autorizacoes/page.tsx'],
 ['monitoramento','src/app/monitoramento/page.tsx'],
 ['detalhe do monitoramento','src/app/monitoramento/farmacias/[id]/page.tsx'],
 ['auditorias','src/app/processos/auditorias/audits.tsx'],
 ['credenciamento','src/app/processos/credenciamento/portfolio.tsx'],
 ['equipe','src/app/equipe/page.tsx'],
 ['módulos com escopo','src/components/modulos/EscopoModulo.tsx'],
 ['próximas dispensações','src/components/proximas/ProximasModulo.tsx'],
] as const;

describe('posição do retorno ao Dashboard',()=>{
 it.each(pages)('%s mostra o retorno antes do título e fora do cabeçalho',(_name,path)=>{
  const source=readFileSync(path,'utf8');
  const link=source.indexOf('← Voltar ao Dashboard');
  const title=source.indexOf('<h1');
  const header=source.match(/<header\b[\s\S]*?<\/header>/)?.[0]??'';
  expect(link).toBeGreaterThanOrEqual(0);
  expect(title).toBeGreaterThan(link);
  expect(header).not.toContain('← Voltar ao Dashboard');
 });

 it('move o slot do credenciamento incorporado antes do título, sem alterar o destino superior',()=>{
  const source=readFileSync('src/app/processos/credenciamento/convites/convites-client.tsx','utf8');
  expect(source).toContain("eyebrow.before(slot)");
  expect(source).toContain("getElementById('dashboard-return-slot')");
  expect(source).toContain('target="_top"');
 });
});