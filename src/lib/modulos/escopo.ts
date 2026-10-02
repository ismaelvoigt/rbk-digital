import type {SupabaseClient} from '@supabase/supabase-js';
import {resolveRole} from '../auth/rbac';
export type FarmaciaModulo={id:string;cnpj:string;nome_fantasia:string|null;razao_social:string|null};
export async function pesquisarFarmacias(client:SupabaseClient,busca=''):Promise<FarmaciaModulo[]>{
 const r=await client.rpc('modulos_farmacias',{p_busca:busca}).select('id,cnpj,nome_fantasia,razao_social');
 if(r.error)throw new Error('Não foi possível consultar as farmácias autorizadas. Tente novamente.');
 return Array.isArray(r.data)?r.data:[];
}
export async function contextoModulo(client:SupabaseClient){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)throw new Error('Sessão expirada. Faça login novamente.');
 const [p,a]=await Promise.all([client.from('users').select('perfil,status,farm_id').eq('id',user.id).maybeSingle(),client.from('rbk_admins').select('user_id').eq('user_id',user.id).eq('ativo',true).maybeSingle()]);
 const role=resolveRole(p.data?.perfil??null,!!a.data);
 if(p.error||a.error||p.data?.status!=='active'||!role||role==='operador')throw new Error('Seu perfil não possui acesso a este módulo.');
 const gestor=role==='gestor_rbk'||role==='superadmin_rbk';
 if(gestor)return {gestor:true,farmacia:null};
 if(!p.data?.farm_id)throw new Error('Seu login não possui uma farmácia vinculada. Solicite a correção do cadastro.');
 const farmId=p.data.farm_id;
 const farms=await pesquisarFarmacias(client);
 const farmacia=farms.find(f=>f.id===farmId);
 if(!farmacia)throw new Error('A farmácia vinculada está indisponível para este login.');
 return {gestor:false,farmacia};
}
export function exigirFarmacia(farmId?:string):string{
 if(!farmId)throw new Error('Selecione uma farmácia/CNPJ antes de consultar.');
 return farmId;
}
export const nomeFarmacia=(f:FarmaciaModulo)=>f.nome_fantasia||f.razao_social||'Farmácia';
export const cnpjFormatado=(value:string)=>value.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
