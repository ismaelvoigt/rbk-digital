import type {SupabaseClient} from '@supabase/supabase-js';

export type DocumentoListado = {
  id:string;
  categoria:string;
  status:string;
  nome_arquivo:string | null;
  caminho_arquivo:string | null;
};

export async function carregarDocumentosAutorizacao(client:SupabaseClient,id:string) {
  const {data:{user},error:sessionError} = await client.auth.getUser();
  if (sessionError || !user) return null;
  // Independent queries share the authenticated client and keep the existing RLS checks.
  const [autorizacao,documentos] = await Promise.all([
    client.from('autorizacoes').select('numero_autorizacao').eq('id',id).single(),
    client.from('documentos').select('id,categoria,status,nome_arquivo,caminho_arquivo').eq('autorizacao_id',id),
  ]);
  if (autorizacao.error || !autorizacao.data || documentos.error || !documentos.data) {
    throw new Error('Não foi possível carregar os documentos. Tente novamente.');
  }
  return {numeroAutorizacao:autorizacao.data.numero_autorizacao as string,documentos:documentos.data as DocumentoListado[]};
}
