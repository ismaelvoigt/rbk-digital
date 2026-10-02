# RBK Digital — periodicidades PFPB

Verificação: 27/09/2026.

## Regras e fontes

O cadastro contém 42 identidades de regra e 2.035 registros de produtos do catálogo oficial. Há 39 regras ativas. A aplicação não utiliza um prazo padrão de 30 dias.

- O [Manual de Orientações do PFPB, item 8](https://abaete.mg.gov.br/wp-content/uploads/2021/06/manual-orientacao-port111.pdf), publicado pelo Ministério da Saúde e disponibilizado pela Prefeitura de Abaeté, discrimina as periodicidades mensais de 30 dias, contraceptivos de 25/30/80/90 dias, timolol de 25 dias e fraldas de 10 dias. É um manual histórico, não uma edição de 2026.
- O [catálogo oficial de códigos de barras de 2026](https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/codigos-de-barras/2026), com listas de junho, foi utilizado para identificar os produtos. A presença de um produto no catálogo não comprova, sozinha, seu intervalo de retirada.
- A [legislação publicada pelo Ministério da Saúde](https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/legislacao) inclui a Portaria GM/MS 12.091/2026. Seu art. 30 remete aos critérios do autorizador; não traz tabela numérica completa de periodicidades.
- O [serviço oficial Dignidade Menstrual](https://www.gov.br/pt-br/servicos/obter-autorizacao-para-retirada-gratuita-de-absorventes-higienicos-em-estabelecimentos-do-farmacia-popular) confirma 40 absorventes por 56 dias.

Não foi localizada uma nova tabela oficial completa de periodicidades datada de 2026. As regras foram cruzadas com o manual oficial disponível e o catálogo atual; as lacunas identificadas ficaram bloqueadas:

| Identidade pendente | Tratamento |
|---|---|
| Dapagliflozina 10 mg | Proposta de 30 dias inativa: intervalo específico não comprovado |
| Beclometasona 200 mcg | Inativa: apresentação não discriminada com segurança |
| Insulina humana 100 UI/mL sem especificação | Inativa: não presumir NPH |

A primeira versão tem vigência operacional no RBK a partir de **27/09/2026**. Essa data não representa uma nova vigência legal. Dispensações anteriores sem evidência temporal permanecem para revisão manual.

## Comportamento implementado

- EAN válido e único, nome de produto compatível e metadados sem conflito; sem EAN, somente identidade estruturada completa e única.
- Sem correspondência segura: não calculado, com possibilidade de definição manual justificada.
- Fonte, versão e cópia da regra salvas na previsão e no histórico.
- Atualizações do catálogo não reescrevem previsões anteriores. Alterações materiais da dispensação exigem revisão.
- Alerta interno a partir de dois dias antes da retirada prevista.
- Planejamento de Compras consulta as mesmas previsões armazenadas; quantidades futuras não são presumidas a partir de retiradas anteriores.
- Ícone de três pessoas no cartão Equipe, no padrão visual do painel.

## Verificações

- 529 testes locais aprovados; testes remotos separados não são contados nesse total.
- Compilação de produção aprovada; análise dos componentes alterados sem erros, com quatro avisos preexistentes no painel.
- Teste no Supabase real aprovado para 10, 25, 30, 56, 80 e 90 dias, alerta D-2, contato e Compras.
- Duas farmácias temporárias: chamadas cruzadas por farmacia_id recusadas; tabelas de regras e previsões sem acesso direto por usuário.
- 42 regras e 2.035 produtos comparados campo a campo com a carga local.
- Revisão independente: conflitos produto/EAN e compatibilidade de snapshots antigos corrigidos, com testes de regressão.

## Implantação

A instalação foi dividida em schema, regras, 14 lotes de produtos e inicialização conservadora de previsões. Cada etapa é registrada em migração; o endereço público só é promovido após validação.

Publicação concluída em https://rbk-digital.vercel.app, implantação `dpl_FKKeZkLeAeSD1gw6LrDv9ACFPMZa`, estado Ready confirmado pelo endereço público. Verificação visual realizada com conta temporária: ícone de Equipe e seis previsões corretas. Dados temporários removidos; consulta final confirmou zero farmácias de teste remanescentes. Arquivos desta entrega sincronizados com o projeto original.

## Avisos da análise de segurança

As novas tabelas do catálogo têm bloqueio de acesso direto deliberado. O aviso informativo [RLS habilitada sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) corresponde a essa decisão: a aplicação consulta funções restritas, não as tabelas diretamente.

A análise também apontou funções preexistentes executáveis por [usuários autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [anônimos](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), além de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Esses avisos não foram introduzidos pelas funções do novo módulo. Não foram alteradas as configurações globais de autenticação nesta entrega.
