import {describe,it,expect} from 'vitest';
import {getAccessDecision} from '../src/lib/auth/accessPolicy';
import {getRouteForPerfil} from '../src/lib/auth/routeForPerfil';
const allowed=(perfil:string,pathname:string)=>getAccessDecision({authenticated:true,perfil,pathname}).allowed;
describe('perfis da equipe',()=>{
 it('atendente só acessa operação',()=>{
  for(const p of ['/farmacia','/nova-autorizacao','/autorizacoes','/pendencias','/autorizacoes/a/documentos'])expect(allowed('operador',p)).toBe(true);
  for(const p of ['/equipe','/administracao','/vendas','/compras','/relatorios','/usuarios'])expect(allowed('operador',p)).toBe(false);
 });
 it('gerente consulta administração sem gerir equipe',()=>{
  for(const p of ['/farmacia','/nova-autorizacao','/autorizacoes','/pendencias','/administracao','/vendas','/compras','/relatorios'])expect(allowed('gerente_farmacia',p)).toBe(true);
  expect(allowed('gerente_farmacia','/equipe')).toBe(false);
  expect(getRouteForPerfil('gerente_farmacia')).toBe('/farmacia');
 });
 it('administrador tem equipe e mantém isolamento de ambiente',()=>{
  expect(allowed('administrador_farmacia','/equipe')).toBe(true);
  expect(allowed('farmacia','/equipe')).toBe(true);
  expect(allowed('gestor_rbk','/equipe')).toBe(false);
  expect(allowed('administrador_farmacia','/usuarios')).toBe(false);
 });
});
