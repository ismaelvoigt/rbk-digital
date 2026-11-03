"use client";
import Link from "next/link";
import { RbkHeader } from "../../components/RbkHeader";
import PesquisaAutorizacoes from "../../components/autorizacoes/PesquisaAutorizacoes";
export default function Autorizacoes() {
  return (
    <main className="rbk-shell min-h-screen">
      <RbkHeader />
      <div className="rbk-container py-8">
        <Link
          href="/farmacia"
          className="mb-4 inline-block text-sm font-bold text-red-700"
        >
          ← Voltar a Farmácia
        </Link>
        <h1 className="mb-6 text-3xl font-semibold">
          Autorizações da farmácia
        </h1>
        <PesquisaAutorizacoes />
      </div>
    </main>
  );
}
