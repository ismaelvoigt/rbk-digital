# Teste de convite e acesso por plano — desenvolvimento

Acesse o preview do ramo de desenvolvimento pelo painel RBK. Produção não faz parte deste teste.

1. Em **Farmácias e usuários → Cadastrar farmácia**, use uma farmácia fictícia e um e-mail que você possa abrir. Preencha o nome fantasia.
2. Envie o convite. O sistema só informa envio após aceitação pelo serviço de e-mail. Configuração de e-mail ausente gera erro e não cria o acesso novo.
3. Abra o convite, defina a senha e entre. O responsável começa como **Atendente**, com cadastro de autorizações e armazenamento. O título inicial mostra nome fantasia; sem ele, razão social.
4. Cadastre uma autorização com documentos fictícios. Aguarde as confirmações de armazenamento já existentes.
5. No painel RBK, abra **Editar cadastro → Perfil e plano da farmácia → Promover para administrador**. Ao atualizar a página do cliente, aparece **Equipe**, sem liberar módulos avançados.
6. Em ação separada, **Liberar módulos de gestão** libera os módulos existentes para o plano da farmácia. O atendente continua com a interface operacional pelo seu perfil.
7. Para testar exclusão, crie um segundo acesso fictício e deixe-o sem autorizações ou arquivos. Na lista, **Excluir usuário** verifica a elegibilidade; digite o e-mail exato para confirmar. Esta ação remove login e sessões, preservando a farmácia.
8. Tente abrir a mesma ação em um usuário com documentos/autorizações: a exclusão deve ser recusada. Para esse usuário, utilize inativação.

## Regras e limites

- Ações de convite, promoção, plano e exclusão pertencem à administração RBK com cadastro ativo em `rbk_admins`; o gestor RBK delegado não recebe poderes novos por este ajuste.
- Novas farmácias recebem armazenamento. Farmácias já existentes conservam plano completo para evitar mudança silenciosa de acesso.
- Uma farmácia existente (por exemplo, criada em credenciamento) conserva seu plano ao convidar outro responsável. Ajuste o plano explicitamente em Editar cadastro se desejar testar armazenamento nesse CNPJ.
- Exclusão é individual. Nenhuma conta real é removida durante implantação ou verificação.
- Autorizações vazias, histórico de criação/alteração de documentos, arquivos órfãos e outros registros de negócio também impedem exclusão para evitar perda por cascata.
- O último administrador com equipe ativa não pode ser excluído antes de haver outro administrador ativo.
- Registros de auditoria e a origem de convites dos colegas são preservados.
- Confirmação de envio significa aceitação pelo serviço de e-mail, não leitura/entrega garantida na caixa de entrada. Confira spam e expiração do link durante o teste.
