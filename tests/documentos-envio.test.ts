import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarDocumento, enviarLote, confirmarDocumento, type EnvioDocumento } from '../src/lib/documentos/envio';

// External boundaries only: storage and database acknowledgements can fail independently.
function ambiente() {
  const objects = new Map<string, number>();
  const rows = new Map<string, Record<string, unknown>>();
  const upload = vi.fn(async (path: string, file: File) => { objects.set(path, file.size); return {data:{path},error:null}; });
  const info = vi.fn(async (path: string) => ({data: objects.has(path) ? {size:objects.get(path)} : null,error:objects.has(path)?null:{message:'not found'}}));
  const insert = vi.fn(async (row: Record<string, unknown>) => { rows.set(row.id as string,row); return {data:row,error:null}; });
  const client = {storage:{from:()=>({upload,info})},from:()=>({
    insert:(row:Record<string,unknown>)=>({select:()=>({single:()=>insert(row)})}),
    select:()=>({eq:(_key:string,id:string)=>({maybeSingle:async()=>({data:rows.get(id)??null,error:null})})}),
  })} as unknown as SupabaseClient;
  return {client,objects,rows,upload,info,insert};
}
function job(id='one'): EnvioDocumento { return {id,autorizacaoId:'auth',categoria:'documento_cliente',caminho:`user/auth/${id}.jpg`,nome:'foto.jpg',file:new File(['image'],'foto.jpg',{type:'image/jpeg'})}; }

describe('confirmação e retomada documental',()=>{
 it('só confirma após objeto com tamanho correto e vínculo retornado',async()=>{
  const a=ambiente(),j=job();await enviarDocumento(a.client,j);
  expect(a.objects.get(j.caminho)).toBe(5);expect(a.rows.get('one')).toMatchObject({autorizacao_id:'auth',caminho_arquivo:j.caminho,status:'recebido'});
  expect(j.confirmado).toBe(true);
 });
 it('não confirma objeto ausente ou tamanho divergente',async()=>{
  const a=ambiente(),j=job();a.info.mockResolvedValue({data:{size:2},error:null});
  await expect(enviarDocumento(a.client,j)).rejects.toThrow(/armazenamento/);expect(j.confirmado).not.toBe(true);expect(a.rows.size).toBe(0);
 });
 it('recupera resposta perdida no upload sem sobrescrever o objeto',async()=>{
  const a=ambiente(),j=job();a.upload.mockImplementationOnce(async(path,file)=>{a.objects.set(path,file.size);throw new Error('connection lost')});
  await enviarDocumento(a.client,j);expect(j.confirmado).toBe(true);expect(a.upload).toHaveBeenCalledTimes(1);
 });
 it('recupera resposta perdida no registro pelo mesmo id',async()=>{
  const a=ambiente(),j=job();a.insert.mockImplementationOnce(async row=>{a.rows.set(row.id as string,row);throw new Error('connection lost')});
  await enviarDocumento(a.client,j);expect(j.confirmado).toBe(true);expect(a.rows.size).toBe(1);
 });
 it('não aceita resposta vazia nem vínculo com outro caminho',async()=>{
  const a=ambiente(),j=job();a.insert.mockResolvedValue({data:null as never,error:null});
  await expect(enviarDocumento(a.client,j)).rejects.toThrow(/vínculo/);expect(j.confirmado).not.toBe(true);
  a.rows.set(j.id,{id:j.id,autorizacao_id:'other',caminho_arquivo:j.caminho,status:'recebido'});
  await expect(confirmarDocumento(a.client,j.id,{autorizacaoId:'auth',caminho:j.caminho})).rejects.toThrow();
 });
 it('retoma registro falho sem reenviar imagem ou documentos já confirmados',async()=>{
  const a=ambiente(),jobs=[job('one'),job('two')];let fail=true;
  const save=a.insert.getMockImplementation()!;a.insert.mockImplementation(async row=>{if(row.id==='two'&&fail)throw new Error('offline');return save(row)});
  const first=await enviarLote(a.client,jobs);expect(first).toBe(false);expect(jobs.map(j=>!!j.confirmado)).toEqual([true,false]);
  fail=false;expect(await enviarLote(a.client,jobs)).toBe(true);expect(a.upload).toHaveBeenCalledTimes(2);expect(a.rows.size).toBe(2);
 });
 it('limita dois envios e aguarda todos os resultados mesmo com falha',async()=>{
  const a=ambiente();let active=0,max=0;
  const up=a.upload.getMockImplementation()!;a.upload.mockImplementation(async(p,f)=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return up(p,f)});
  const jobs=Array.from({length:5},(_,i)=>job(String(i)));expect(await enviarLote(a.client,jobs)).toBe(true);expect(max).toBe(2);expect(a.rows.size).toBe(5);
 });
 it('confirmar documento rejeita registro ausente e objeto ausente',async()=>{
  const a=ambiente();await expect(confirmarDocumento(a.client,'none')).rejects.toThrow();
  a.rows.set('one',{id:'one',autorizacao_id:'auth',caminho_arquivo:'missing',status:'recebido'});
  await expect(confirmarDocumento(a.client,'one')).rejects.toThrow();
 });
});

describe('substituição segura',()=>{
 it('não apaga o anterior quando o update não retorna linha',async()=>{
  const {substituirDocumentoConfirmado}=await import('../src/lib/documentos/envio');
  const a=ambiente(),j=job();const remove=vi.fn();
  a.client.from=(()=>({update:()=>({eq:()=>({select:()=>({single:async()=>({data:null,error:null})})})}),select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})) as never;
  const storage=a.client.storage.from.bind(a.client.storage);a.client.storage.from=(()=>({...storage('documentos'),remove})) as never;
  await expect(substituirDocumentoConfirmado(a.client,j,'old')).rejects.toThrow();expect(remove).not.toHaveBeenCalled();
 });
});
