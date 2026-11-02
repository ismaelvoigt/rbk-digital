# Teste de convite e acesso por plano — desenvolvimento

Acesse o preview do ramo de desenvolvimento pelo painel RBK. Produção não faz parte deste teste.

1. Em **Farmácias e usuários → Cadastrar farmácia**, use uma farmácia fictícia e um e-mail que você possa abrir. Preencha o nome fantasia.
2. Envie o convite. O sistema só informa envio após aceitação pelo serviço de e-mail. Configuração de e-mail ausente gera erro e não cria o acesso novo.
3. Abra o convite, defina a senha e entre. O responsável começa como **Atendente**, com cadastro de autorizações e armazenamento. O título inicial mostra nome fantasia; sem ele, razão social.
4. Cadastre uma autorização com documentos fictícios. Aguarde as confirmações de armazenamento já existentes.
5. No painel RBK, abra **Editar cadastro → Perfil e plano da farmácia → Promover para administrador**. Ao atualizar a página do cliente, aparece **Equipe**, sem liberar módulos avançados.
6. Em ação separada, **Liberar módulos de gestão** libera os módulos existentes para o plano da farmácia. O atendente continua com a interface operacional pelo seu perfil.
7. Para testar exclusão, use uma farmácia inteiramente fictícia. Na lista, **Excluir definitivamente** consulta a elegibilidade e mostra o escopo. Confirme digitando o CNPJ. A ação exclui a farmácia e os acessos vinculados conforme os bloqueios existentes. Não há mais uma exclusão separada de usuário por e-mail.
8. Confira os bloqueios e quantidades apresentados pelo servidor. Não confirme exclusão de cadastro ou documentação reais. Para suspender acesso preservando histórico, utilize inativação.
9. Na edição do cadastro, altere o e-mail: **Reenviar convite** fica desabilitado até salvar. Após salvar, clique explicitamente no botão; confira que o envio usa o novo endereço salvo e mantém a mesma conta. O cliente receberá um link para definir sua senha, mesmo se já tiver acessado anteriormente.

## Regras e limites

- Ações de convite, promoção, plano e exclusão pertencem à administração RBK com cadastro ativo em `rbk_admins`; o gestor RBK delegado não recebe poderes novos por este ajuste.
- Novas farmácias recebem armazenamento. Farmácias já existentes conservam plano completo para evitar mudança silenciosa de acesso.
- Uma farmácia existente (por exemplo, criada em credenciamento) conserva seu plano ao convidar outro responsável. Ajuste o plano explicitamente em Editar cadastro se desejar testar armazenamento nesse CNPJ.
- A única exclusão apresentada é a definitiva da farmácia, confirmada pelo CNPJ. O endpoint anterior de exclusão por e-mail responde 410 para orientar a atualização de telas antigas. Nenhuma exclusão real é executada durante implantação ou verificação.
- Os critérios de elegibilidade, congelamento e retomada da exclusão da farmácia permanecem os existentes. A exclusão inclui os acessos e registros apresentados na confirmação; não equivale a apenas remover um login.
- Reenvio usa recuperação de acesso da identidade existente e não cria outro usuário, não altera perfil/plano e não envia automaticamente ao editar e-mail. Há espera de um minuto entre tentativas. Falha ao enviar não é apresentada como sucesso.
- Confirmação de envio significa aceitação pelo serviço de e-mail, não leitura/entrega garantida na caixa de entrada. Confira spam e expiração do link durante o teste.
