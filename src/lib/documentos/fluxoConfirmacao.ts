export function resultadoConfirmacao(substituicaoRealizada: boolean) {
  if (substituicaoRealizada) {
    return {
      tipo: "atualizada" as const,
      destino: null,
    };
  }

  return {
    tipo: "navegar" as const,
    destino: "/farmacia",
  };
}
