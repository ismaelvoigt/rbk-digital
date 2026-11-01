"use client";
import { useEffect, useId, useState } from "react";
import { UFS } from "../lib/cadastro/ufs";
type Props = {
  estado: string;
  cidade: string;
  onEstadoChange: (value: string) => void;
  onCidadeChange: (value: string) => void;
  disabled?: boolean;
};
type Cities = { uf: string; names: string[]; ready: boolean; error: boolean };
export function LocalidadeFields({
  estado,
  cidade,
  onEstadoChange,
  onCidadeChange,
  disabled = false,
}: Props) {
  const messageId = useId();
  const [cities, setCities] = useState<Cities>({
    uf: "",
    names: [],
    ready: false,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  const validUf = UFS.some((uf) => uf.sigla === estado);
  useEffect(() => {
    if (!validUf) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    async function load() {
      try {
        const response = await fetch(
          `/localidades/municipios-v1/${estado}.json`,
          { signal: controller.signal, cache: "force-cache" },
        );
        if (!response.ok) throw Error("Unavailable");
        const names: unknown = await response.json();
        if (
          !Array.isArray(names) ||
          !names.length ||
          !names.every((n) => typeof n === "string" && n.trim())
        )
          throw Error("Invalid municipalities");
        if (active) setCities({ uf: estado, names, ready: true, error: false });
      } catch {
        if (active)
          setCities({ uf: estado, names: [], ready: false, error: true });
      } finally {
        clearTimeout(timer);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [estado, validUf, attempt]);
  const ready = cities.uf === estado && cities.ready;
  const error = cities.uf === estado && cities.error;
  const names = ready ? cities.names : [];
  const loading = validUf && !ready && !error;
  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="estado"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          UF
        </label>
        <select
          id="estado"
          name="estado"
          value={estado}
          disabled={disabled}
          onChange={(event) => {
            onEstadoChange(event.target.value);
            onCidadeChange("");
          }}
          className="rbk-input"
        >
          <option value="">Selecione uma UF</option>
          {estado && !validUf && (
            <option value={estado}>{estado} (cadastrada)</option>
          )}
          {UFS.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.sigla} — {uf.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="cidade"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Cidade
        </label>
        <select
          id="cidade"
          name="cidade"
          value={cidade}
          disabled={disabled || !ready}
          onChange={(event) => onCidadeChange(event.target.value)}
          aria-busy={loading}
          aria-describedby={loading || error ? messageId : undefined}
          className="rbk-input"
        >
          <option value="">
            {!estado
              ? "Selecione a UF primeiro"
              : loading
                ? "Carregando cidades…"
                : "Selecione uma cidade"}
          </option>
          {cidade && !names.includes(cidade) && (
            <option value={cidade}>{cidade} (cadastrada)</option>
          )}
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {loading && (
          <p
            id={messageId}
            role="status"
            className="mt-2 text-sm text-gray-500"
          >
            Carregando cidades…
          </p>
        )}
        {error && (
          <div
            id={messageId}
            role="alert"
            className="mt-2 text-sm text-red-700"
          >
            Não foi possível carregar as cidades.{" "}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCities({
                  uf: estado,
                  names: [],
                  ready: false,
                  error: false,
                });
                setAttempt((value) => value + 1);
              }}
              className="font-semibold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
