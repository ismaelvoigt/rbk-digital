"use client";

import { useNavegacaoPerfil } from "../../../../../lib/auth/useNavegacaoPerfil";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/client";
import { RbkBrand } from "../../../../../components/RbkBrand";

function formatarNumeroAutorizacao(valor: string) {
  const digits = valor.replace(/\D/g, "").slice(0, 15);

  if (digits.length <= 3) return digits;

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}.${digits.slice(12)}`;
}

export default function DocumentoSucesso() {
  const navegacao = useNavegacaoPerfil();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [numeroAutorizacao, setNumeroAutorizacao] = useState("");

  const [verificacao,setVerificacao] = useState<'verificando' | 'confirmado' | 'falhou'>('verificando');

  useEffect(() => {
    let ativo = true;
    async function carregarAutorizacao() {
      try {
        const [{data:autorizacao,error:autorizacaoErro},{data:documentos,error:documentosErro}] = await Promise.all([
          supabase.from('autorizacoes').select('numero_autorizacao').eq('id',id).single(),
          supabase.from('documentos').select('id,caminho_arquivo,status').eq('autorizacao_id',id),
        ]);
        if (autorizacaoErro || !autorizacao || documentosErro || !documentos?.length) throw new Error('Sem confirmação');
        for (const documento of documentos) {
          if (documento.status !== 'recebido' || !documento.caminho_arquivo) throw new Error('Documento pendente');
          const {data,error} = await supabase.storage.from('documentos').info(documento.caminho_arquivo);
          if (error || !data?.size) throw new Error('Arquivo indisponível');
        }
        if (ativo) { setNumeroAutorizacao(autorizacao.numero_autorizacao); setVerificacao('confirmado'); }
      } catch { if (ativo) setVerificacao('falhou'); }
    }
    void carregarAutorizacao();
    return () => { ativo = false; };

  }, [id, supabase]);

  if (verificacao !== 'confirmado') return (
    <main className="rbk-shell min-h-screen p-8">
      <p role={verificacao === 'falhou' ? 'alert' : 'status'}>
        {verificacao === 'verificando' ? 'Verificando armazenamento dos documentos...' : 'Não foi possível confirmar o armazenamento de todos os documentos. Confira a autorização e os arquivos pendentes.'}
      </p>
      <Link href={`/autorizacoes/${id}/documentos`} className="mt-5 inline-block font-bold text-red-600">Conferir documentos</Link>
    </main>
  );

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <RbkBrand compact light />
          <Link href={`/autorizacoes/${id}/documentos`} className="text-sm font-bold text-gray-500 hover:text-red-600">← Voltar</Link>
        </div>
      </header>

      <div className="rbk-container max-w-3xl py-10 sm:py-14">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50 shadow-sm ring-1 ring-green-100">
            <span className="text-5xl font-black text-green-600">✓</span>
          </div>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-green-600">Operação concluída</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Documento enviado com sucesso!</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">Seu documento foi salvo e vinculado à autorização.</p>
        </div>

        <div className="rbk-card mt-9 p-7 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Autorização</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{numeroAutorizacao ? `#${formatarNumeroAutorizacao(numeroAutorizacao)}` : ""}</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Documento vinculado ao registro
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/nova-autorizacao" className="rbk-primary rounded-[13px] px-6 py-4 text-center text-sm font-bold">Cadastrar nova autorização</Link>
          {navegacao && <Link href={navegacao.href} className="rbk-secondary rounded-[13px] px-6 py-4 text-center text-sm font-bold">{navegacao.label}</Link>}
        </div>
      </div>
    </main>
  );
}
