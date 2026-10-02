import { describe,it,expect,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { segmentosImagem } from '../src/lib/autorizacoes/renderizarAnexo';
import { carregarArquivoPdf } from '../src/lib/autorizacoes/carregarPdf';
const doc={id:'a',categoria:'receita_medica',status:'recebido',nome_arquivo:'receita.pdf',caminho_arquivo:'private/receita.pdf'};
describe('anexos incorporados',()=>{
  it('não corta imagens normais',()=>{expect(segmentosImagem(800,1200)).toEqual([{y:0,height:1200}]);});
  it('divide cupom comprido sem perder nenhuma linha, com sobreposição',()=>{
    const partes=segmentosImagem(600,4000);
    expect(partes.length).toBeGreaterThan(3);
    expect(partes[0].y).toBe(0);
    partes.slice(1).forEach((p,i)=>expect(p.y).toBeLessThan(partes[i].y+partes[i].height));
    const last=partes.at(-1)!;expect(last.y+last.height).toBe(4000);
  });
  it('faz download com o cliente autenticado e o caminho exato',async()=>{
    const blob=new Blob(['PDF']);const download=vi.fn(async()=>({data:blob,error:null}));
    const from=vi.fn(()=>({download}));const client={storage:{from}} as unknown as SupabaseClient;
    expect(await carregarArquivoPdf(client,doc)).toBe(blob);
    expect(from).toHaveBeenCalledWith('documentos');expect(download).toHaveBeenCalledWith('private/receita.pdf');
  });
  it('não substitui falha de download por arquivo vazio',async()=>{
    const client={storage:{from:()=>({download:async()=>({data:null,error:{}})})}} as unknown as SupabaseClient;
    await expect(carregarArquivoPdf(client,doc)).rejects.toThrow('Não foi possível baixar');
    await expect(carregarArquivoPdf(client,{...doc,caminho_arquivo:null})).rejects.toThrow('sem arquivo');
  });
});
