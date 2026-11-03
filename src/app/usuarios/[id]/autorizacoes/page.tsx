"use client";
import Link from "next/link";
import { RbkHeader } from "../../../../components/RbkHeader";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRetornoFarmacias } from "../../../../lib/usuarios/useRetornoFarmacias";
import { createClient } from "../../../../lib/supabase/client";
import { resolveRole } from "../../../../lib/auth/rbac";
import PesquisaAutorizacoes from "../../../../components/autorizacoes/PesquisaAutorizacoes";
type Usuario = {
  id: string;
  nome: string;
  email: string;
  farm_id: string | null;
  farms: {
    nome_fantasia: string | null;
    razao_social: string | null;
    cnpj: string | null;
  } | null;
};
export default function Page() {
  const params = useParams();
  return (
    <AutorizacoesUsuario
      key={params.id as string}
      usuarioId={params.id as string}
    />
  );
}
function AutorizacoesUsuario({ usuarioId }: { usuarioId: string }) {
  const retorno = useRetornoFarmacias(),
    client = useMemo(() => createClient(), []);
  const [usuario, setUsuario] = useState<Usuario | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
        if (authError || !user)
          throw new Error("Sessão expirada. Faça login novamente.");
        const [p, a] = await Promise.all([
          client
            .from("users")
            .select("perfil,status")
            .eq("id", user.id)
            .single(),
          client
            .from("rbk_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .maybeSingle(),
        ]);
        const role =
          p.data?.status === "active"
            ? resolveRole(p.data.perfil, Boolean(a.data))
            : null;
        if (
          p.error ||
          a.error ||
          (role !== "gestor_rbk" && role !== "superadmin_rbk")
        )
          throw new Error("Você não tem acesso à consulta desta farmácia.");
        const result = await client
          .from("users")
          .select(
            "id,nome,email,farm_id,farms!users_farm_id_fkey(nome_fantasia,razao_social,cnpj)",
          )
          .eq("id", usuarioId)
          .in("perfil", [
            "farmacia",
            "operador",
            "administrador_farmacia",
            "gerente_farmacia",
          ])
          .single();
        if (result.error || !result.data?.farm_id)
          throw new Error(
            "Não foi possível localizar a farmácia deste usuário.",
          );
        const row = {
          ...result.data,
          farms: Array.isArray(result.data.farms)
            ? (result.data.farms[0] ?? null)
            : result.data.farms,
        };
        if (active) setUsuario(row as Usuario);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível localizar o usuário.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, usuarioId]);
  const farmacia = usuario ? usuario.farms : null,
    nomeFarmacia =
      farmacia?.nome_fantasia || farmacia?.razao_social || "Farmácia";
  return (
    <main className="min-h-screen bg-gray-50">
      <RbkHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <nav aria-label="Navegação de farmácias" className="mb-5">
          <Link href={retorno} className="text-sm text-gray-600">
            ← Voltar para farmácias
          </Link>
        </nav>
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm text-red-700"
        >
          ← Voltar ao Dashboard
        </Link>
        <h1 className="mb-6 text-3xl font-semibold">
          Autorizações da farmácia
        </h1>
        {loading && <p role="status">Conferindo acesso à farmácia…</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}
        {!loading && !error && usuario?.farm_id && (
          <>
            <section className="rbk-card mb-6 p-5">
              <h2 className="text-xl font-semibold">{nomeFarmacia}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {usuario.nome} · {usuario.email}
              </p>
              <p className="mt-2 text-sm">
                CNPJ: {farmacia?.cnpj || "Não informado"}
              </p>
            </section>
            <PesquisaAutorizacoes
              key={usuario.id + ":" + usuario.farm_id}
              farmId={usuario.farm_id}
              nomeFarmacia={nomeFarmacia}
            />
          </>
        )}
      </div>
    </main>
  );
}
