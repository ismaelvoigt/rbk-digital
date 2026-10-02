import {exigirFarmacia} from '../modulos/escopo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRole } from '../auth/rbac';
import { normalizarCrm, normalizarFiltros, type FiltrosRelatorios } from './filtros';

export type AutorizacaoRelatorio = {
  id: string; numero_autorizacao: string; data_autorizacao: string | null;
  cpf_cliente: string | null; farmacia: string | null; crm: string | null; crm_uf: string | null;
};
export const TAMANHO_PAGINA = 25;
async function validarAcesso(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.');
  const [perfil, admin] = await Promise.all([
    client.from('users').select('perfil,status').eq('id',user.id).maybeSingle(),
    client.from('rbk_admins').select('user_id').eq('user_id',user.id).eq('ativo',true).maybeSingle(),
  ]);
  if (perfil.error || admin.error || perfil.data?.status !== 'active' || !resolveRole(perfil.data.perfil,Boolean(admin.data))) throw new Error('Seu perfil não possui acesso aos relatórios.');
}
function erroConsulta(code?: string) {
  return ['42703','PGRST204'].includes(code || '')
    ? 'O campo CRM ainda não está disponível neste ambiente. A atualização do banco precisa ser aplicada antes de usar o módulo.'
    : 'Não foi possível carregar as autorizações. Confira sua conexão e tente novamente.';
}
export async function pesquisarRelatorios(client: SupabaseClient, filtros: FiltrosRelatorios, pagina: number, farmId?: string) {
  const f = normalizarFiltros(filtros);
  if (!Number.isSafeInteger(pagina) || pagina < 0) throw new Error('Página inválida.');
  await validarAcesso(client);
  // Somente cliente autenticado: as políticas RLS existentes delimitam as autorizações visíveis.
  let query = client.rpc('modulos_autorizacoes',{p_farm:exigirFarmacia(farmId)},{count:'exact'}).select('id,numero_autorizacao,data_autorizacao,cpf_cliente,farmacia,crm,crm_uf');
  if (f.inicio) query=query.gte('data_autorizacao',f.inicio);
  if (f.fim) query=query.lte('data_autorizacao',f.fim);
  if (f.numero) query=query.eq('numero_autorizacao',f.numero);
  if (f.cpf) query=query.eq('cpf_cliente',f.cpf);
  if (f.crm) query=query.eq('crm',f.crm);
  if (f.uf) query=query.eq('crm_uf',f.uf);
  const {data,error,count} = await query.order('data_autorizacao',{ascending:false,nullsFirst:false}).order('id',{ascending:true}).range(pagina*TAMANHO_PAGINA,(pagina+1)*TAMANHO_PAGINA-1);
  if (error || !data || count === null) throw new Error(erroConsulta(error?.code));
  return { autorizacoes:data as AutorizacaoRelatorio[], total:count };
}
export async function salvarCrm(client: SupabaseClient, id: string, numero: string, uf: string, farmId?:string) {
  const scope=exigirFarmacia(farmId);
  const check=await client.rpc('modulos_autorizacoes',{p_farm:scope}).select('id').eq('id',id).single();
  if(check.error||!check.data)throw new Error('Autorização fora da farmácia selecionada.');
  const values=normalizarCrm(numero,uf);
  await validarAcesso(client);
  const {data,error}=await client.from('autorizacoes').update(values).eq('id',id).select('id,crm,crm_uf').single();
  if (error || !data) throw new Error('Não foi possível salvar o CRM. Confira sua permissão de edição e tente novamente.');
  return data as {id:string;crm:string|null;crm_uf:string|null};
}
