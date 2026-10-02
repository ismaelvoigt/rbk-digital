'use client';

import { useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { carregarDadosPdf, carregarArquivoPdf } from '../../lib/autorizacoes/carregarPdf';

export default function BaixarAutorizacaoPdf({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const ocupado = useRef(false);

  async function baixar() {
    if (ocupado.current || disabled) return;
    ocupado.current = true;
    setGerando(true);
    setErro('');
    setMensagem('');
    try {
      const client = createClient();
      const { autorizacao, documentos } = await carregarDadosPdf(client, id);
      if (!documentos.some(d => d.caminho_arquivo)) throw new Error('Não há arquivos anexados a esta autorização para reunir no PDF.');
      const { gerarAutorizacaoPdf, nomeArquivoPdf } = await import('../../lib/autorizacoes/pdf');
      const { renderizarAnexo } = await import('../../lib/autorizacoes/renderizarAnexo');
      const [logo, regular, bold] = await Promise.all([
        '/rbk-digital-logo-original.png', '/fonts/Lato-Regular.ttf', '/fonts/Lato-Bold.ttf',
      ].map(async (url) => {
        const response = await fetch(url);
        if (!response.ok || response.redirected) throw new Error('Não foi possível carregar o layout do PDF. Atualize a página e tente novamente.');
        return new Uint8Array(await response.arrayBuffer());
      }));
      const bytes = await gerarAutorizacaoPdf(autorizacao, documentos, { logo, regular, bold }, {
        carregarArquivo: documento => carregarArquivoPdf(client, documento),
        renderizarArquivo: renderizarAnexo, onProgress: setProgresso,
      });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivoPdf(autorizacao.numero_autorizacao);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Safari pode começar a consumir o arquivo somente após o evento de clique.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const semArquivo = documentos.filter(d => !d.caminho_arquivo).length;
      setMensagem(`PDF gerado com os anexos. Confira os downloads do navegador.${semArquivo ? ` ${semArquivo} registro(s) sem arquivo anexado não foram incluídos.` : ''}`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      ocupado.current = false;
      setGerando(false);
      setProgresso('');
    }
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={baixar} disabled={disabled || gerando} aria-busy={gerando}
        className="rbk-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>
        {gerando ? 'Gerando PDF...' : 'Baixar PDF'}
      </button>
      <p className="mt-2 text-xs text-gray-500">Reúne imagens e PDFs anexados, com identificação em cada página.</p>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      <p role="status" className="mt-2 text-sm text-gray-600">{gerando ? progresso || 'Preparando PDF...' : mensagem}</p>
    </div>
  );
}
