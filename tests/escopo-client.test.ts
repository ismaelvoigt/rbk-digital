import {createClient} from '@supabase/supabase-js';
import {it,expect,vi} from 'vitest';
import {contextoModulo} from '../src/lib/modulos/escopo';
import {carregarVendas} from '../src/lib/vendas/consulta';
import {carregarEstoque} from '../src/lib/compras/consulta';
import {carregarDadosPdf} from '../src/lib/autorizacoes/carregarPdf';
import {exportarPdfs,baixarAnexos} from '../src/lib/relatorios/exportar';
const farm={id:'farm-a',cnpj:'12345678000190',nome_fantasia:'Alfa',razao_social:'Alfa Ltda'};
function setup(role='farmacia',bound:string|null='farm-a'){
 const calls:{path:string;body:Record<string,unknown>}[]=[];
 const client=createClient('https://example.invalid','key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
 const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):{};calls.push({path:url.pathname,body});
 let data:unknown=null;
 if(url.pathname.endsWith('/users'))data={perfil:role,status:'active',farm_id:bound};
 if(url.pathname.endsWith('/modulos_farmacias'))data=[farm];
 if(url.pathname.endsWith('/modulos_autorizacoes'))data=String(init?.headers&&JSON.stringify(init.headers)).includes('vnd.pgrst.object')?{numero_autorizacao:'a'}:[{id:'a',numero_autorizacao:'a',data_autorizacao:'2026-09-26'}];
 if(url.pathname.endsWith('/modulos_itens')||url.pathname.endsWith('/modulos_documentos'))data=[];
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 }}});
 vi.spyOn(client.auth,'getUser').mockResolvedValue({data:{user:{id:'user'}},error:null} as never);
 return {client,calls};
}
it('vincula a farmácia do login e exige seleção inicial do gestor',async()=>{
 expect(await contextoModulo(setup().client)).toEqual({gestor:false,farmacia:farm});
 expect(await contextoModulo(setup('gestor_rbk').client)).toEqual({gestor:true,farmacia:null});
 await expect(contextoModulo(setup('farmacia',null).client)).rejects.toThrow(/vinculada/);
});
it('não consulta vendas, estoque ou exporta arquivos sem farmácia',async()=>{
 const {client,calls}=setup();
 await expect(carregarVendas(client,{inicio:'2026-09-01',fim:'2026-09-26'})).rejects.toThrow(/Selecione/);
 await expect(carregarEstoque(client)).rejects.toThrow(/Selecione/);
 await expect(exportarPdfs(client,['a'],()=>{})).rejects.toThrow(/Selecione/);
 await expect(baixarAnexos(client,'a',()=>{})).rejects.toThrow(/Selecione/);
 expect(calls).toEqual([]);
});
it('envia a mesma farmácia ao backend para autorizações, itens, estoque e PDF',async()=>{
 const {client,calls}=setup();
 await carregarVendas(client,{inicio:'2026-09-01',fim:'2026-09-26'},{farmId:'farm-a'});
 await carregarEstoque(client,'farm-a');
 await carregarDadosPdf(client,'a','farm-a');
 const queries=calls.filter(c=>['modulos_autorizacoes','modulos_itens','modulos_documentos','compras_obter'].some(n=>c.path.endsWith('/'+n)));
 expect(queries).toHaveLength(5);for(const q of queries)expect(q.body.p_farm).toBe('farm-a');
 expect(calls.some(c=>c.path.endsWith('/autorizacoes')||c.path.endsWith('/dispensacao_itens')||c.path.endsWith('/documentos'))).toBe(false);
});
