export function nomeInicialFarmacia(
  farm: { nome_fantasia?: string | null; razao_social?: string | null } | null,
) {
  return (
    farm?.nome_fantasia?.trim() || farm?.razao_social?.trim() || "Sua farmácia"
  );
}
