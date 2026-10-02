import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutorizacaoPdf, DocumentoPdf } from './pdf';

export async function carregarDadosPdf(client: SupabaseClient, id: string, farmId?:string) {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sessão expirada. Faça login novamente para baixar o PDF.');
  // Cliente autenticado: as mesmas políticas de acesso da página continuam em vigor.
  const { data, error } = await (farmId?client.rpc('modulos_autorizacoes',{p_farm:farmId}):client.from('autorizacoes'))
    .select('numero_autorizacao, data_autorizacao, cpf_cliente, farmacia, observacao')
    .eq('id', id).single();
  if (error || !data) throw new Error('Não foi possível acessar esta autorização. Atualize a página e tente novamente.');
  const documentos: DocumentoPdf[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const result = await (farmId?client.rpc('modulos_documentos',{p_farm:farmId,p_autorizacao:id}):client.from('documentos'))
      .select('id, categoria, status, nome_arquivo, caminho_arquivo')
      .eq('autorizacao_id', id).order('id', { ascending: true }).range(offset, offset + batchSize - 1);
    if (result.error || !Array.isArray(result.data)) throw new Error('Não foi possível carregar os documentos. Tente baixar o PDF novamente.');
    documentos.push(...result.data);
    if (result.data.length < batchSize) break;
  }
  return { autorizacao: data as AutorizacaoPdf, documentos };
}

export async function carregarArquivoPdf(client: SupabaseClient, documento: DocumentoPdf) {
  if (!documento.caminho_arquivo) throw new Error('Registro sem arquivo anexado.');
  // Download privado com a sessão atual, sem expor URLs assinadas nem usar chave administrativa.
  const { data, error } = await client.storage.from('documentos').download(documento.caminho_arquivo);
  if (error || !data) throw new Error('Não foi possível baixar o anexo. Confira sua conexão e o acesso ao arquivo.');
  return data;
}
