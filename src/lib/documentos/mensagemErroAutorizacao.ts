export function mensagemErroAutorizacao(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "23505") {
    return "Esta autorização já está cadastrada. Revise o número da autorização informado. Se você esperava cadastrar uma nova autorização, confira se o número foi digitado corretamente.";
  }

  return "Não foi possível salvar a autorização.";
}
