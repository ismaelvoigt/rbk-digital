import { usuarioReply } from "../../../../lib/usuarios/adminRequest";
// Old open tabs must not retain a second deletion path with email confirmation.
function retired() {
  return usuarioReply(
    {
      error:
        "Esta ação foi substituída. Atualize a tela e use Excluir definitivamente, confirmando o CNPJ da farmácia.",
    },
    410,
  );
}
export async function GET() {
  return retired();
}
export async function DELETE() {
  return retired();
}
