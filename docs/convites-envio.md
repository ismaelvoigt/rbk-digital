# Entrega dos convites de Auditoria e Credenciamento

O convite é salvo primeiro, pelas RPCs existentes e com suas permissões atuais. A confirmação inicial da auditoria e cada renovação de link iniciam a entrega. No credenciamento isso ocorre na criação e na renovação. Repetir uma confirmação já concluída não envia novamente.

E-mail usa SMTP de um provedor transacional, com TLS obrigatório. WhatsApp usa o fallback oficial `wa.me`, pois o projeto não tem credenciais de API oficial ou templates aprovados. O gestor precisa abrir a mensagem e confirmar o envio; nunca é registrado como entregue. O mesmo link completo, incluindo o fragmento secreto, é usado nos dois canais.

## Configuração no servidor

1. Aplicar `supabase/invitation-deliveries.sql` no banco de homologação que já contém `aud_audits` e `cre_processes`. O script não foi aplicado a nenhum banco remoto por esta alteração.
2. Configurar as variáveis abaixo no ambiente do servidor. Não usar prefixo `NEXT_PUBLIC_`.

```dotenv
INVITE_PUBLIC_ORIGIN=https://seu-portal-de-homologacao.example.com
INVITE_SMTP_HOST=smtp.seu-provedor.example.com
INVITE_SMTP_PORT=587
INVITE_SMTP_USER=usuario-do-provedor
INVITE_SMTP_PASSWORD=segredo-do-provedor
INVITE_EMAIL_FROM=convites@seu-dominio.example.com
```

A origem configurada deve corresponder exatamente à origem que gera o convite. Links locais ou de outra origem não são enviados. Porta 465 usa TLS desde a conexão; 587 exige STARTTLS. `INVITE_EMAIL_FROM` deve ser um endereço simples, com domínio/remetente validado no provedor. Nenhum segredo é retornado ao navegador ou incluído nos registros.

A restrição existente à homologação continua em vigor: `AUDIT_PORTAL_ENABLED`, `AUDIT_STAGING_PROJECT_REF` e as verificações de ambiente não foram alteradas.

## Resultados e histórico

`invitation_deliveries` registra uma tentativa por canal: referência ao processo, hash do link, canal, resultado e horários de início/atualização. Não armazena token, corpo da mensagem, endereço de e-mail, telefone, credenciais ou resposta bruta do provedor. A tabela tem RLS e acesso apenas por `service_role`. O histórico é lido no servidor somente depois da autorização da RPC existente; o portal público da farmácia não recebe esse histórico.

Estados: `pending`, `accepted`, `failed`, `manual`, `not_configured`, `invalid_contact`, `unsafe_link`, `unavailable`. `accepted` significa aceitação SMTP, não entrega na caixa de entrada. Não há webhook de entrega ou leitura. O WhatsApp permanece `manual`, sem presumir que o gestor enviou a mensagem.

Cada canal é independente. Erros de SMTP são reduzidos a um resultado seguro. Se o registro inicial falhar, o envio automático é suspenso e a tela informa a falha de registro, preservando o convite e o compartilhamento manual. Se o registro final falhar, a resposta mostra o resultado observado e o aviso; o registro pode ficar `pending`.

Não há repetição automática de SMTP (um timeout pode ocorrer depois de o provedor aceitar). Uma renovação invalida o link anterior, conforme o fluxo existente, e inicia uma nova tentativa. O transporte SMTP tem limite total de 15 segundos; não há fila ou envio em segundo plano.

## Validação antes de ativar

Testes automatizados usam provedores simulados; nenhum e-mail ou WhatsApp real é enviado. Após configurar o banco e o SMTP, conferir em homologação com uma farmácia de teste: criação, renovação, conteúdo do link, recebimento do e-mail, abertura do WhatsApp e histórico dos dois canais.

Referências: [SMTP Nodemailer](https://nodemailer.com/smtp) e [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Configuração RBK confirmada

O remetente e usuário SMTP autorizado é `ismael@rbkassessoria.com.br`. A configuração existente no Supabase usa Titan/HostGator: `smtp.titan.email`, porta `465`, TLS desde a conexão. Esses dados foram preparados em `.env.local`, preservando as outras variáveis. A senha SMTP deve ser preenchida privadamente em `INVITE_SMTP_PASSWORD`.

A origem de homologação preparada é `https://rbk-auditoria-homologacao.vercel.app`. A configuração local atual do banco principal não deve ser usada para ativar os portais: o teste integrado requer o ambiente de homologação validado e a tabela de registros, conforme as etapas anteriores.

Destinatários autorizados apenas para o teste: `ismael.farmaciapopular@gmail.com` e WhatsApp `+55 61 98460-9796`. Eles não substituem os contatos das farmácias no código.

A farmácia não precisa de login, senha nem conta no RBK Digital. O token individual presente no link autoriza as operações do respectivo processo. Links expirados ou revogados são recusados, e o acesso do gestor ao sistema continua autenticado.
