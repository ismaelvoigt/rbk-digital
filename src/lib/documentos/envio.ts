import type { SupabaseClient } from '@supabase/supabase-js';

export type EstadoEnvio = 'selecionado' | 'enviando' | 'salvo' | 'falhou';
export type EnvioDocumento = {
  id: string;
  autorizacaoId: string;
  categoria: string;
  caminho: string;
  nome: string;
  file: File;
  armazenado?: boolean;
  confirmado?: boolean;
};

async function verificarObjeto(client: SupabaseClient, caminho: string, tamanho?: number) {
  const {data,error} = await client.storage.from('documentos').info(caminho);
  if (error || !data || !data.size || (tamanho !== undefined && data.size !== tamanho)) {
    throw new Error('Não foi possível confirmar o arquivo no armazenamento. Tente novamente.');
  }
}

export async function confirmarDocumento(client: SupabaseClient, id: string, esperado?: {autorizacaoId:string;caminho:string}) {
  const {data,error} = await client.from('documentos')
    .select('id,autorizacao_id,caminho_arquivo,status').eq('id',id).maybeSingle();
  if (error || !data || data.status !== 'recebido' || !data.caminho_arquivo ||
      (esperado && (data.autorizacao_id !== esperado.autorizacaoId || data.caminho_arquivo !== esperado.caminho))) {
    throw new Error('Não foi possível confirmar o vínculo do documento. Tente novamente.');
  }
  await verificarObjeto(client,data.caminho_arquivo);
  return data;
}

async function armazenarDocumento(client:SupabaseClient,envio:EnvioDocumento) {
  if (!envio.armazenado) {
    // A unique, stable path lets a retry recover a lost acknowledgement without overwriting.
    try {
      const {error} = await client.storage.from('documentos').upload(envio.caminho,envio.file,{
        upsert:false,contentType:envio.file.type || 'application/octet-stream',
      });
      if (error) throw error;
    } catch {
      // Check the exact object even after an ambiguous network error.
      await verificarObjeto(client,envio.caminho,envio.file.size);
      envio.armazenado = true;
    }
    if (!envio.armazenado) {
      await verificarObjeto(client,envio.caminho,envio.file.size);
      envio.armazenado = true;
    }
  }
}

export async function enviarDocumento(client: SupabaseClient, envio: EnvioDocumento) {
  if (envio.confirmado) return;
  await armazenarDocumento(client,envio);
  const row = {id:envio.id,autorizacao_id:envio.autorizacaoId,categoria:envio.categoria,
    nome_arquivo:envio.nome,caminho_arquivo:envio.caminho,status:'recebido'};
  try {
    const {data,error} = await client.from('documentos').insert(row)
      .select('id,autorizacao_id,caminho_arquivo,status').single();
    if (error || !data || data.id !== envio.id || data.autorizacao_id !== envio.autorizacaoId ||
        data.caminho_arquivo !== envio.caminho || data.status !== 'recebido') {
      throw new Error('Não foi possível confirmar o vínculo do documento.');
    }
  } catch {
    // Never delete the object: the insert may have committed before the connection failed.
    await confirmarDocumento(client,envio.id,{autorizacaoId:envio.autorizacaoId,caminho:envio.caminho});
  }
  envio.confirmado = true;
}

export async function enviarLote(client: SupabaseClient, envios: EnvioDocumento[],
  atualizar?: (envio:EnvioDocumento,estado:EstadoEnvio)=>void) {
  let proximo = 0;
  let completo = true;
  async function worker() {
    while (proximo < envios.length) {
      const envio = envios[proximo++];
      if (envio.confirmado) continue;
      atualizar?.(envio,'enviando');
      try {
        await enviarDocumento(client,envio);
        atualizar?.(envio,'salvo');
      } catch {
        completo = false;
        atualizar?.(envio,'falhou');
      }
    }
  }
  await Promise.all([worker(),worker()]);
  return completo;
}

export async function substituirDocumentoConfirmado(client:SupabaseClient,envio:EnvioDocumento,caminhoAnterior:string | null) {
  await armazenarDocumento(client,envio);
  try {
    const update = client.from('documentos').update({nome_arquivo:envio.nome,caminho_arquivo:envio.caminho,status:'recebido'})
      .eq('id',envio.id);
    const condicionado = caminhoAnterior ? update.eq('caminho_arquivo',caminhoAnterior) : update.is('caminho_arquivo',null);
    const {data,error} = await condicionado.select('id,autorizacao_id,caminho_arquivo,status').single();
    if (error || !data || data.id !== envio.id || data.autorizacao_id !== envio.autorizacaoId || data.caminho_arquivo !== envio.caminho) {
      throw new Error('Não foi possível confirmar a substituição.');
    }
  } catch {
    await confirmarDocumento(client,envio.id,{autorizacaoId:envio.autorizacaoId,caminho:envio.caminho});
  }
  envio.confirmado = true;
  // Only retire the previous object after a confirmed swap. Cleanup failure does not undo it.
  if (caminhoAnterior && caminhoAnterior !== envio.caminho) {
    void client.storage.from('documentos').remove([caminhoAnterior]).catch(()=>{});
  }
}
