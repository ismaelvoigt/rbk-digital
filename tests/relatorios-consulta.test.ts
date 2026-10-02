import { createClient } from '@supabase/supabase-js';
import { it, expect, vi } from 'vitest';
import { pesquisarRelatorios, salvarCrm } from '../src/lib/relatorios/consulta';
function setup({signedIn=true,active=true,denied=false}={}) {
  const urls: URL[]=[];
  const client=createClient('https://example.invalid','test-key',{auth:{persistSession:false},global:{fetch:async (input,init)=>{
    const url=new URL(String(input)); urls.push(url);
    let data: unknown=null;
    if(url.pathname.endsWith('/users')) data={perfil:'farmacia',status:active?'active':'inactive'};
    if((url.pathname.endsWith('/autorizacoes')||url.pathname.endsWith('/modulos_autorizacoes'))) data=init?.method==='PATCH' ? (denied?null:{id:'a',crm:'1234',crm_uf:'SP'}) : [{id:'a',numero_autorizacao:'123456789012345'}];
    return new Response(JSON.stringify(data),{status:denied&&init?.method==='PATCH'?406:200,headers:{'Content-Type':'application/json','Content-Range':'25-25/26'}});
  }}});
  vi.spyOn(client.auth,'getUser').mockResolvedValue({data:{user:signedIn?{id:'user'}:null},error:null} as never);
  return {client,urls};
}
it('consulta a página solicitada e combina filtros exatos com datas inclusivas',async()=>{
  const {client,urls}=setup();
  const result=await pesquisarRelatorios(client,{modoData:'periodo',inicio:'2026-09-01',fim:'2026-09-26',crm:'001234',uf:'SP',cpf:'123.456.789-01'},1,'farm-a');
  expect(result.total).toBe(26);
  const query=urls.find(url=>(url.pathname.endsWith('/autorizacoes')||url.pathname.endsWith('/modulos_autorizacoes')))!.searchParams;
  expect(query.get('crm')).toBe('eq.1234'); expect(query.get('crm_uf')).toBe('eq.SP');
  expect(query.get('cpf_cliente')).toBe('eq.12345678901');
  expect(query.getAll('data_autorizacao')).toEqual(['gte.2026-09-01','lte.2026-09-26']);
  expect(query.get('offset')).toBe('25'); expect(query.get('limit')).toBe('25');
  expect(query.get('order')).toContain('id');
});
it('não busca autorizações sem sessão ou com perfil inativo',async()=>{
  for(const settings of [{signedIn:false},{active:false}]){
    const {client,urls}=setup(settings);
    await expect(pesquisarRelatorios(client,{},0)).rejects.toThrow();
    expect(urls.some(u=>u.pathname.endsWith('/autorizacoes'))).toBe(false);
  }
});
it('salva CRM normalizado e detecta atualização negada em vez de anunciar sucesso',async()=>{
  expect(await salvarCrm(setup().client,'a','001234','SP','farm-a')).toMatchObject({crm:'1234',crm_uf:'SP'});
  await expect(salvarCrm(setup({denied:true}).client,'a','1234','SP','farm-a')).rejects.toThrow();
});
