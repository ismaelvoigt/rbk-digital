import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirFarmacia } from "../modulos/escopo";
import {
  periodo,
  type Intervalo,
  type AutorizacaoVenda,
  type ItemVenda,
} from "./domain";
export type DadosVendas = {
  autorizacoes: AutorizacaoVenda[];
  itens: ItemVenda[];
  estruturaDisponivel: boolean;
};
const PAGINA = 500,
  MAX_REGISTROS = 100000;
export async function carregarVendas(
  client: SupabaseClient,
  p: Intervalo,
  opcoes: { farmId?: string } = {},
): Promise<DadosVendas> {
  // Validação também fora da interface; nenhuma chave administrativa nesta consulta.
  periodo("personalizado", new Date(), p.inicio, p.fim);
  const farmId = exigirFarmacia(opcoes.farmId);
  const autorizacoes: AutorizacaoVenda[] = [];
  for (let ultimoId = ""; ;) {
    let query = client
      .rpc("modulos_autorizacoes", {p_farm:farmId})
      .select(
        "id,numero_autorizacao,data_autorizacao,farmacia,cpf_cliente,observacao,created_at",
      )
      .gte("data_autorizacao", p.inicio)
      .lte("data_autorizacao", p.fim);
    if (ultimoId) query = query.gt("id", ultimoId);
    const r = await query.order("id", { ascending: true }).range(0, PAGINA - 1);
    if (r.error || !Array.isArray(r.data))
      throw new Error(
        "Não foi possível carregar todas as autorizações. Tente novamente.",
      );
    autorizacoes.push(...r.data);
    if (r.data.length) ultimoId = r.data[r.data.length - 1].id;
    if (autorizacoes.length > MAX_REGISTROS)
      throw new Error(
        "Muitos registros. Reduza o período para consultar e exportar.",
      );
    if (r.data.length < PAGINA) break;
  }
  const itens: ItemVenda[] = [];
  // Consultar a tabela mesmo sem autorizações permite informar migração pendente.
  const lotes = autorizacoes.length ? Math.ceil(autorizacoes.length / 100) : 1;
  for (let lote = 0; lote < lotes; lote++) {
    const ids = autorizacoes
      .slice(lote * 100, (lote + 1) * 100)
      .map((a) => a.id);
    for (let ultimoId = ""; ;) {
      let query = client
        .rpc("modulos_itens", {p_farm:farmId})
        .select(
          "id,autorizacao_id,documento_id,posicao,produto,ean,unidade,quantidade,valor_unitario,valor_total,valor_pfpb,principio_ativo,indicacao,data_dispensacao,status,origens",
        );
      query = ids.length
        ? query.in("autorizacao_id", ids)
        : query.eq("autorizacao_id", "00000000-0000-0000-0000-000000000000");
      if (ultimoId) query = query.gt("id", ultimoId);
      const r = await query
        .order("id", { ascending: true })
        .range(0, PAGINA - 1);
      if (r.error) {
        if (["42P01", "PGRST205"].includes(r.error.code))
          return { autorizacoes, itens: [], estruturaDisponivel: false };
        throw new Error(
          "Não foi possível carregar os itens dos cupons. Nenhum total parcial será apresentado.",
        );
      }
      if (!Array.isArray(r.data))
        throw new Error(
          "Resposta incompleta ao consultar os itens. Tente novamente.",
        );
      itens.push(...(r.data as ItemVenda[]));
      if (r.data.length) ultimoId = r.data[r.data.length - 1].id;
      if (itens.length > MAX_REGISTROS)
        throw new Error(
          "Muitos itens. Reduza o período para consultar e exportar.",
        );
      if (r.data.length < PAGINA) break;
    }
  }
  return { autorizacoes, itens, estruturaDisponivel: true };
}
