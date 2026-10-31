import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {carregarDocumentosAutorizacao} from '../src/lib/documentos/carregamento';
it('consulta autorização e documentos em paralelo após validar sessão',async()=>{
 let liberar:()=>void=()=>{};const gate=new Promise<void>(r=>{liberar=r});const iniciadas:string[]=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:(t:string)=>({select:()=>({eq:()=>{
  iniciadas.push(t);
  return t==='autorizacoes'?{single:async()=>{await gate;return{data:{numero_autorizacao:'123'},error:null}}}:Promise.resolve({data:[{id:'doc'}],error:null});
 }})})}as unknown as SupabaseClient;
 const result=carregarDocumentosAutorizacao(client,'auth');
 try{await vi.waitFor(()=>expect(iniciadas).toEqual(['autorizacoes','documentos']),{timeout:150});}
 finally{liberar();}
 expect(await result).toMatchObject({numeroAutorizacao:'123',documentos:[{id:'doc'}]});
});
it('sessão ausente não dispara consulta documental',async()=>{
 const from=vi.fn();const client={auth:{getUser:async()=>({data:{user:null},error:null})},from} as unknown as SupabaseClient;
 expect(await carregarDocumentosAutorizacao(client,'auth')).toBeNull();expect(from).not.toHaveBeenCalled();
});
it('erro não transforma falha de consulta em listagem vazia',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:(t:string)=>({select:()=>({eq:()=>t==='autorizacoes'?{single:async()=>({data:{numero_autorizacao:'123'},error:null})}:Promise.resolve({data:null,error:{message:'offline'}})})})}as unknown as SupabaseClient;
 await expect(carregarDocumentosAutorizacao(client,'auth')).rejects.toThrow();
});
