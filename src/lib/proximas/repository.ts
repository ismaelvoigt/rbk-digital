import {createClient} from '../supabase/client';
import type {Contexto,Demanda,Edicao,Evento,Filtro,Resultado} from './domain';
export interface ProximasRepository {
 contexto(busca?:string):Promise<Contexto>;
 listar(farm:string,filtro:Filtro,pagina?:number):Promise<Resultado>;
 salvar(farm:string,id:string,versao:number,dados:Edicao):Promise<void>;
 historico(farm:string,id:string):Promise<Evento[]>;
 demanda(farm:string,inicio:string,fim:string):Promise<Demanda>;
}
export type Rpc=(name:string,args:Record<string,unknown>)=>Promise<unknown>;
export function repository(call:Rpc):ProximasRepository{
 const scope=(f:string)=>{if(!f)throw new Error('Selecione uma farmácia/CNPJ.');return f;};
 return {
 contexto:(busca='')=>call('proximas_contexto',{p_busca:busca}) as Promise<Contexto>,
 listar:(farm,p,pagina=0)=>call('proximas_listar',{p_farm:scope(farm),p_inicio:p.inicio,p_fim:p.fim,p_filtro:p.filtro,p_pagina:pagina}) as Promise<Resultado>,
 salvar:async(farm,id,versao,dados)=>{await call('proximas_salvar',{p_farm:scope(farm),p_id:id,p_versao:versao,p_dados:dados});},
 historico:(farm,id)=>call('proximas_historico',{p_farm:scope(farm),p_id:id}) as Promise<Evento[]>,
 demanda:async(farm,inicio,fim)=>{
  const data=await call('proximas_demanda',{p_farm:scope(farm),p_inicio:inicio,p_fim:fim}) as Demanda;
  if(!data||!Array.isArray(data.produtos)||typeof data.nao_calculadas!=='number')throw new Error('Resposta incompleta ao consultar a demanda futura. Tente novamente.');
  return data;
 },
 };
}
export const supabaseRepository=repository(async(name,args)=>{
 const {data,error}=await createClient().rpc(name,args);
 if(error){if(['PGRST202','42883','42P01'].includes(error.code))throw new Error('O módulo ainda não foi ativado neste ambiente.');throw new Error(error.message||'Não foi possível concluir a operação.');}
 return data;
});
