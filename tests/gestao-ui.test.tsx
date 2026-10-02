import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
Object.assign(globalThis,{React});
import {getAccessDecision} from '../src/lib/auth/accessPolicy';
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>({})}));
import Dashboard from '../src/app/dashboard/page';
import {readFileSync} from 'node:fs';
describe('Gestão RBK',()=>{
 it('mantém todos os links e textos antigos, acrescentando cards depois do resumo',()=>{
  const atual=readFileSync('src/app/dashboard/page.tsx','utf8');
  // Contrato explícito: funciona também em clones rasos, sem um commit local antigo.
  for(const href of ['/processos/auditorias','/processos/credenciamento/convites','/processos/credenciamento','/usuarios/novo','/usuarios','/autorizacoes','/proximas-dispensacoes','/administracao','/monitoramento','/financeiro','/crm'])expect(atual).toContain(`href="${href}"`);
  const html=renderToStaticMarkup(<Dashboard/>);
  for(const title of ['Processos','Farmácias e usuários','Autorizações','Próximas Dispensações','Administração','Centro de Monitoramento','Resumo da carteira','Auditorias','Credenciamentos','Usuários da operação','Gestão da RBK','Financeiro','CRM'])expect(html).toContain(title);
  expect(html.indexOf('Gestão da RBK')).toBeGreaterThan(html.indexOf('Usuários da operação'));
 });
 it.each(['/crm','/financeiro'])('somente RBK acessa %s',pathname=>{
  for(const perfil of ['operador','farmacia','administrador_farmacia','gerente_farmacia'])expect(getAccessDecision({authenticated:true,perfil,pathname}).allowed).toBe(false);
  for(const perfil of ['gestor_rbk','superadmin_rbk'])expect(getAccessDecision({authenticated:true,perfil,pathname}).allowed).toBe(true);
 });
});
