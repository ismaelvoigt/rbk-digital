import {createClient} from '../supabase/client';
export async function gestao<T>(action:string,data:Record<string,unknown>={}):Promise<T>{
 const {data:result,error}=await createClient().rpc('gestao_rbk',{p_action:action,p_data:data});
 if(error){
  if(['P0001','23505','42501'].includes(error.code))throw new Error(error.message);
  if(['23514','23502','22P02','22007','22008'].includes(error.code))throw new Error('Confira os campos obrigatórios, valores e datas.');
  throw new Error('Não foi possível concluir a operação. Tente novamente.');
 }
 return result as T;
}
export const dinheiro=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export const dataBR=(d:string|null|undefined)=>d?d.slice(0,10).split('-').reverse().join('/'):'—';
export const hoje=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
export const mensagem=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir. Tente novamente.';
