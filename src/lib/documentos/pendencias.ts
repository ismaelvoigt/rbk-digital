const obrigatorios = [
  ["documento_cliente", "Documento do Cliente"],
  ["receita_medica", "Receita Médica"],
  ["cupom_fiscal", "Cupom Fiscal"],
  ["cupom_vinculado", "Cupom Vinculado"],
] as const;

export type DocumentoStatus = { categoria: string; status: string };

export function getPendenciasDocumentais(documentos: DocumentoStatus[]): string[] {
  return obrigatorios
    .filter(([categoria]) =>
      !documentos.some((documento) =>
        documento.categoria === categoria && documento.status === "recebido",
      ),
    )
    .map(([, titulo]) => titulo);
}
