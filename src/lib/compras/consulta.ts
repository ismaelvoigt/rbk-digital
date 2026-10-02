import {exigirFarmacia,pesquisarFarmacias,nomeFarmacia} from '../modulos/escopo';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {EstoqueItem} from './domain';
export type BaseEstoque={farm_id:string;versao:string;data_posicao:string;arquivo:string;atualizado_em:string;itens:EstoqueItem[]};
export type ContextoEstoque={farmId:string|null;nome:string;base:BaseEstoque|null;disponivel:boolean};
export async function carregarEstoque(client:SupabaseClient,selectedFarm?:string):Promise<ContextoEstoque>{
 const farmId=exigirFarmacia(selectedFarm);
 const [farms,r]=await Promise.all([pesquisarFarmacias(client),client.rpc('compras_obter',{p_farm:farmId})]);
 const farm=farms.find(f=>f.id===farmId);
 const nome=farm?nomeFarmacia(farm):'Farmácia selecionada';
 if(r.error){if(['PGRST202','42883'].includes(r.error.code))return {farmId,nome,base:null,disponivel:false};throw new Error('Não foi possível consultar o estoque. Atualize a tela antes de planejar.');}
 return {farmId,nome,base:r.data as BaseEstoque|null,disponivel:true};
}
export async function salvarEstoque(client:SupabaseClient,c:ContextoEstoque,data:string,arquivo:string,itens:EstoqueItem[]){
 if(!c.farmId)throw new Error('Vincule uma farmácia ao perfil antes de importar.');
 const r=await client.rpc('compras_importar',{p_farm:c.farmId,p_data:data,p_arquivo:arquivo,p_itens:itens,p_versao:c.base?.versao??null});
 if(r.error)throw new Error(r.error.message||'Não foi possível importar.');return r.data as BaseEstoque;
}
