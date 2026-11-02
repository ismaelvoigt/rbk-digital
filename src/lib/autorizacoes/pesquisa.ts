import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRole } from "../auth/rbac";
export const PAGINA_AUTORIZACOES = 20;
export type FiltrosPesquisa = {
  modo: "livre" | "dia" | "periodo" | "mes";
  dia?: string;
  inicio?: string;
  fim?: string;
  mes?: string;
  cpf?: string;
  numero?: string;
};
export type PesquisaAplicada = {
  inicio: string;
  fim: string;
  cpf: string;
  numero: string;
};
export type EscopoPesquisa = {
  actorId: string;
  farmId: string | null;
  farmacia?: string;
};
export type LinhaAutorizacao = {
  id: string;
  farm_id: string;
  numero_autorizacao: string;
  cpf_cliente: string | null;
  data_autorizacao: string | null;
  farmacia: string | null;
  observacao: string | null;
};
const CAMPOS =
  "id,farm_id,numero_autorizacao,cpf_cliente,data_autorizacao,farmacia,observacao";
function diasMes(ano: number, mes: number) {
  return mes === 2
    ? ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(mes)
      ? 30
      : 31;
}
function validarData(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (
    !m ||
    +m[1] < 1 ||
    +m[2] < 1 ||
    +m[2] > 12 ||
    +m[3] < 1 ||
    +m[3] > diasMes(+m[1], +m[2])
  )
    throw new Error("Informe uma data válida.");
  return value;
}
export function normalizarPesquisa(f: FiltrosPesquisa): PesquisaAplicada {
  let inicio = "",
    fim = "";
  if (f.modo === "dia") inicio = fim = validarData(f.dia || "");
  else if (f.modo === "periodo") {
    inicio = validarData(f.inicio || "");
    fim = validarData(f.fim || "");
    if (inicio > fim)
      throw new Error("A data inicial não pode ser maior que a final.");
  } else if (f.modo === "mes") {
    if (!/^\d{4}-\d{2}$/.test(f.mes || ""))
      throw new Error("Selecione um mês válido.");
    inicio = validarData(`${f.mes}-01`);
    const [a, m] = inicio.split("-").map(Number);
    fim = `${f.mes}-${diasMes(a, m)}`;
  } else if (f.modo !== "livre")
    throw new Error("Selecione um filtro de data válido.");
  const cpf = (f.cpf || "").replace(/[.\s-]/g, ""),
    numero = (f.numero || "").replace(/[.\s]/g, "");
  if (cpf && !/^\d{11}$/.test(cpf))
    throw new Error("Informe o CPF completo com 11 dígitos.");
  if (numero && !/^\d{15}$/.test(numero))
    throw new Error("Informe o número completo da autorização com 15 dígitos.");
  if (!inicio && !fim && !cpf && !numero)
    throw new Error(
      "Informe CPF, autorização, dia, período ou mês para pesquisar.",
    );
  return { inicio, fim, cpf, numero };
}
export async function obterEscopoPesquisa(
  client: SupabaseClient,
  requestedFarmId?: string,
): Promise<EscopoPesquisa> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Sessão expirada. Faça login novamente.");
  const [p, a] = await Promise.all([
    client
      .from("users")
      .select("perfil,status,farm_id")
      .eq("id", user.id)
      .maybeSingle(),
    client
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle(),
  ]);
  const role = resolveRole(p.data?.perfil || null, Boolean(a.data));
  if (p.error || a.error || p.data?.status !== "active" || !role)
    throw new Error("Perfil sem acesso às autorizações.");
  const gestor = role === "gestor_rbk" || role === "superadmin_rbk";
  if (
    !gestor &&
    (!p.data.farm_id || (requestedFarmId && requestedFarmId !== p.data.farm_id))
  )
    throw new Error("Farmácia não autorizada para esta sessão.");
  const farmId = requestedFarmId || (gestor ? null : p.data.farm_id);
  let farmacia: string | undefined;
  if (farmId) {
    const farm = await client
      .from("farms")
      .select("id,nome_fantasia,razao_social")
      .eq("id", farmId)
      .maybeSingle();
    if (farm.error || !farm.data)
      throw new Error("Farmácia não encontrada ou sem acesso.");
    farmacia = farm.data.nome_fantasia || farm.data.razao_social || undefined;
  }
  return { actorId: user.id, farmId, farmacia };
}
export async function validarEscopoPesquisa(
  client: SupabaseClient,
  scope: EscopoPesquisa,
) {
  const atual = await obterEscopoPesquisa(client, scope.farmId || undefined);
  if (atual.actorId !== scope.actorId || atual.farmId !== scope.farmId)
    throw new Error(
      "A sessão ou a farmácia mudou. Atualize a página para continuar.",
    );
}
function consulta(client: SupabaseClient, scope: EscopoPesquisa) {
  let q = client.from("autorizacoes").select(CAMPOS, { count: "exact" });
  if (scope.farmId) q = q.eq("farm_id", scope.farmId);
  return q;
}
export async function pesquisarAutorizacoes(
  client: SupabaseClient,
  scope: EscopoPesquisa,
  f: PesquisaAplicada,
  pagina: number,
  snapshot: string,
) {
  if (!Number.isSafeInteger(pagina) || pagina < 0)
    throw new Error("Página inválida.");
  await validarEscopoPesquisa(client, scope);
  let q = consulta(client, scope).lte("created_at", snapshot);
  if (f.inicio) q = q.gte("data_autorizacao", f.inicio);
  if (f.fim) q = q.lte("data_autorizacao", f.fim);
  if (f.cpf) q = q.eq("cpf_cliente", f.cpf);
  if (f.numero) q = q.eq("numero_autorizacao", f.numero);
  const r = await q
    .order("data_autorizacao", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(
      pagina * PAGINA_AUTORIZACOES,
      (pagina + 1) * PAGINA_AUTORIZACOES - 1,
    );
  if (r.error || !Array.isArray(r.data) || r.count === null)
    throw new Error(
      "Não foi possível consultar as autorizações. Tente novamente.",
    );
  return {
    linhas: (r.data as LinhaAutorizacao[]).map((row) => ({
      ...row,
      farmacia: row.farmacia || scope.farmacia || null,
    })),
    total: r.count,
  };
}
export async function listarPesquisaCompleta(
  client: SupabaseClient,
  scope: EscopoPesquisa,
  f: PesquisaAplicada,
  snapshot: string,
  progresso?: (s: string) => void,
) {
  const result: LinhaAutorizacao[] = [];
  let total: number | undefined;
  for (let pagina = 0; ; pagina++) {
    const r = await pesquisarAutorizacoes(client, scope, f, pagina, snapshot);
    if (total !== undefined && r.total !== total)
      throw new Error(
        "Os resultados mudaram durante a leitura. Pesquise novamente.",
      );
    total = r.total;
    result.push(...r.linhas);
    progresso?.(`Lendo ${result.length} de ${total} autorizações…`);
    if (result.length >= total) break;
    if (!r.linhas.length)
      throw new Error(
        "A pesquisa não pôde ser lida completamente. Tente novamente.",
      );
  }
  if (new Set(result.map((r) => r.id)).size !== total)
    throw new Error(
      "Os resultados mudaram. Pesquise novamente para gerar o relatório completo.",
    );
  return result;
}
export async function revalidarSelecao(
  client: SupabaseClient,
  scope: EscopoPesquisa,
  ids: string[],
) {
  await validarEscopoPesquisa(client, scope);
  const unicos = [...new Set(ids)],
    rows: LinhaAutorizacao[] = [];
  for (let offset = 0; offset < unicos.length; offset += 20) {
    const selected = unicos.slice(offset, offset + 20);
    const r = await consulta(client, scope).in("id", selected);
    if (r.error || !Array.isArray(r.data) || r.data.length !== selected.length)
      throw new Error(
        "Uma autorização selecionada foi removida ou não está mais acessível. Atualize a seleção.",
      );
    rows.push(...r.data);
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (unicos.some((id) => !byId.has(id)))
    throw new Error("A seleção mudou. Atualize a página.");
  return unicos.map((id) => ({
    ...byId.get(id)!,
    farmacia: byId.get(id)!.farmacia || scope.farmacia || null,
  }));
}
