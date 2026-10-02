import {exigirFarmacia} from '../modulos/escopo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarDadosPdf, carregarArquivoPdf } from '../autorizacoes/carregarPdf';
import { gerarAutorizacaoPdf, nomeArquivoPdf, type PdfAssets } from '../autorizacoes/pdf';
import { renderizarAnexo } from '../autorizacoes/renderizarAnexo';
import { consolidarPdfs } from './consolidar';

export function baixarArquivo(blob: Blob, nome: string) {
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download=nome; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
async function carregarLayout(): Promise<PdfAssets> {
  const [logo,regular,bold]=await Promise.all(['/rbk-digital-logo-original.png','/fonts/Lato-Regular.ttf','/fonts/Lato-Bold.ttf'].map(async path=>{
    const response=await fetch(path);
    if(!response.ok || response.redirected) throw new Error('Não foi possível carregar o layout do PDF. Atualize a página e tente novamente.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  return {logo,regular,bold};
}
export async function exportarPdfs(client: SupabaseClient, ids: string[], onProgress:(message:string)=>void, farmId?:string) {
  exigirFarmacia(farmId);
  const assets=await carregarLayout();
  let numero='', semArquivo=0, atual=0;
  const gerar=async(id:string)=>{
    atual++;
    exigirFarmacia(farmId);
  const {autorizacao,documentos}=await carregarDadosPdf(client,id,farmId);
    numero=autorizacao.numero_autorizacao;
    semArquivo+=documentos.filter(d=>!d.caminho_arquivo).length;
    try {
      return await gerarAutorizacaoPdf(autorizacao,documentos,assets,{
        carregarArquivo:d=>carregarArquivoPdf(client,d),renderizarArquivo:renderizarAnexo,
        onProgress:message=>onProgress(`Autorização ${atual} de ${ids.length}: ${message}`),
      });
    } catch(error) {throw new Error(`Autorização ${numero}: ${error instanceof Error?error.message:'Falha ao gerar PDF.'}`);}
  };
  // O PDF individual usa exatamente o gerador já aprovado; o consolidado reúne suas páginas.
  const bytes=ids.length===1?await gerar(ids[0]):await consolidarPdfs(ids,gerar,onProgress);
  baixarArquivo(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),ids.length===1?nomeArquivoPdf(numero):`autorizacoes-consolidado-${ids.length}.pdf`);
  return `PDF gerado. Confira os downloads do navegador.${semArquivo?` ${semArquivo} registro(s) sem arquivo anexado não foram incluídos.`:''}`;
}
export async function baixarAnexos(client:SupabaseClient,id:string,onProgress:(message:string)=>void, farmId?:string) {
  exigirFarmacia(farmId);
  const {autorizacao,documentos}=await carregarDadosPdf(client,id,farmId);
  const arquivos=documentos.filter(d=>d.caminho_arquivo);
  if(!arquivos.length) throw new Error('Esta autorização não possui arquivos anexados.');
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip(); let total=0;
  for(const [index,doc] of arquivos.entries()) {
    onProgress(`Baixando anexo ${index+1} de ${arquivos.length}...`);
    const blob=await carregarArquivoPdf(client,doc);
    total+=blob.size;
    if(total>100*1024*1024) throw new Error('Os anexos excedem 100 MB. Baixe os arquivos individualmente na página de documentos.');
    const nome=(doc.nome_arquivo || `documento-${index+1}`).replace(/[^\p{L}\p{N}._-]/gu,'_').slice(0,180);
    zip.file(`${String(index+1).padStart(3,'0')}-${nome}`,await blob.arrayBuffer());
  }
  const blob=await zip.generateAsync({type:'blob'});
  baixarArquivo(blob,nomeArquivoPdf(autorizacao.numero_autorizacao).replace('.pdf','-anexos.zip'));
  return 'Anexos originais reunidos em ZIP. Confira os downloads do navegador.';
}
