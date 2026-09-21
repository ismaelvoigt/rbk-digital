export function filtroFarmacias(search: string) {
  const params = new URLSearchParams(search);
  const cnpj = (params.get("cnpj") ?? "").replace(/\D/g, "").slice(0, 14);
  return { cnpj, todas: !cnpj && params.get("todas") === "1" };
}

export function queryFarmacias(cnpj: string, todas: boolean) {
  const numeros = cnpj.replace(/\D/g, "").slice(0, 14);
  if (numeros) return `?cnpj=${numeros}`;
  return todas ? "?todas=1" : "";
}

export function retornoFarmacias(search: string) {
  const filtro = filtroFarmacias(search);
  return `/usuarios${queryFarmacias(filtro.cnpj, filtro.todas)}`;
}
