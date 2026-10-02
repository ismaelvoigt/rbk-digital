import { it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { exportarPdfs, baixarAnexos } from '../src/lib/relatorios/exportar';
const logo=readFileSync('public/rbk-digital-logo-original.png');
vi.mock('../src/lib/autorizacoes/renderizarAnexo',()=>({renderizarAnexo:async function*(){yield {bytes:readFileSync('public/rbk-digital-logo-original.png'),formato:'png',pagina:1,totalPaginas:1};}}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function contexto(fail=false){
  let result:Blob|undefined;
  const anchor={href:'',download:'',click:vi.fn(),remove:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>anchor,body:{appendChild:()=>{}}});
  vi.stubGlobal('window',{setTimeout:()=>0});
  vi.spyOn(URL,'createObjectURL').mockImplementation(blob=>{result=blob as Blob;return 'blob:test';});
  vi.stubGlobal('fetch',async(path:string)=>new Response(readFileSync('public'+path)));
  const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:()=>{
    let id=''; const query={select:()=>query,eq:(_key:string,value:string)=>{id=value;return query;},order:()=>query,single:async()=>({data:{numero_autorizacao:id==='a'?'123456789012345':'123456789012346',data_autorizacao:'2026-09-26',cpf_cliente:'00000000000',farmacia:'Demonstração',observacao:null},error:null}),range:async()=>({data:[{id:'doc',categoria:'receita_medica',status:'recebido',nome_arquivo:'../receita.png',caminho_arquivo:id}],error:null})}; return query;
  },storage:{from:()=>({download:async(path:string)=>({data:fail&&path==='b'?null:new Blob([logo]),error:fail&&path==='b'?{message:'denied'}:null})})}} as unknown as SupabaseClient;
  client.rpc=(()=>client.from('autorizacoes')) as unknown as typeof client.rpc;
  return {client,anchor,blob:()=>result};
}
it('entrega PDF consolidado íntegro ao navegador com o nome esperado',async()=>{
 const test=contexto();await exportarPdfs(test.client,['a','b'],()=>{},'farm-a');
 expect(test.anchor.download).toBe('autorizacoes-consolidado-2.pdf');
 expect(test.anchor.click).toHaveBeenCalledOnce();
 expect((await PDFDocument.load(await test.blob()!.arrayBuffer())).getPageCount()).toBe(2);
});
it('falha em anexo não dispara download parcial',async()=>{
 const test=contexto(true);await expect(exportarPdfs(test.client,['a','b'],()=>{},'farm-a')).rejects.toThrow('123456789012346');
 expect(test.anchor.click).not.toHaveBeenCalled();expect(test.blob()).toBeUndefined();
});
it('ZIP mantém bytes originais e elimina caminhos do nome de arquivo',async()=>{
 const test=contexto();await baixarAnexos(test.client,'a',()=>{},'farm-a');
 const zip=await JSZip.loadAsync(await test.blob()!.arrayBuffer());
 expect(Object.keys(zip.files)).toEqual(['001-.._receita.png']);
 expect(await zip.file('001-.._receita.png')!.async('uint8array')).toEqual(new Uint8Array(logo));
 expect(test.anchor.download).toBe('autorizacao-123456789012345-anexos.zip');
});
