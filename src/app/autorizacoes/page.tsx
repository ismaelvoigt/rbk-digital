"use client";
import Link from "next/link";
import { RbkHeader } from "../../components/RbkHeader";
import { useNavegacaoPerfil } from "../../lib/auth/useNavegacaoPerfil";
import PesquisaAutorizacoes from "../../components/autorizacoes/PesquisaAutorizacoes";
export default function Autorizacoes() {
  const navegacao = useNavegacaoPerfil();
  return (
    <main className="rbk-shell min-h-screen">
      <RbkHeader>
        {navegacao && (
          <Link href={navegacao.href} className="text-sm text-gray-600">
            Início
          </Link>
        )}
      </RbkHeader>
      <div className="rbk-container py-8">
        {navegacao?.href === "/dashboard" && (
          <Link
            href="/dashboard"
            className="mb-4 inline-block text-sm text-red-700"
          >
            ← Voltar ao Dashboard
          </Link>
        )}
        <h1 className="mb-6 text-3xl font-semibold">
          Autorizações da farmácia
        </h1>
        <PesquisaAutorizacoes />
      </div>
    </main>
  );
}
