import Link from 'next/link';

export default function CarregandoDocumentos() {
  return <main className="rbk-shell min-h-screen p-8 text-sm text-gray-600">
    <h1 className="mb-4 text-xl font-bold text-gray-900">Documentos da autorização</h1>
    <p role="status">Abrindo documentos...</p>
    <Link href="/autorizacoes" className="mt-5 block font-bold text-red-600">Voltar para autorizações</Link>
  </main>;
}
