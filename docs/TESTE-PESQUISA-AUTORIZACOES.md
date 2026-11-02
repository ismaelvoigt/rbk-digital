# Aprovação da pesquisa de autorizações

Somente desenvolvimento: https://rbk-digital-testes.vercel.app/autorizacoes

As novas funções são exclusivas do gestor RBK e dos gerentes/administradores das farmácias. Para aprovar os relatórios, entre com seu acesso RBK de desenvolvimento e abra a [farmácia fictícia](https://rbk-digital-testes.vercel.app/usuarios/6d1553be-4879-4683-8f99-ea1a957087af/autorizacoes).

A conta `rbkdigital@rbkdigital.com.br` permanece como atendente: deve exibir somente a consulta enxuta, sem seleção acumulada ou relatórios. Farmácia: **Farmácia Fictícia - Balcão**. Nenhum registro foi criado ou alterado em produção para este teste.

## Conjunto fictício criado

| Data | Autorizações | CPF fictício |
| --- | ---: | --- |
| 02/11/2026 | 25 | 000.000.000-00 |
| 01/11/2026 | 10 | 111.111.111-11 |
| 31/10/2026 | 10 | 222.222.222-22 |

Números: `970000000000001` a `970000000000045`. Observação identificadora: `RBK-DEMO-PESQUISA-20261102`. São 42 PDFs anexados, marcados como **DOCUMENTO FICTÍCIO / SEM VALIDADE**; três autorizações estão intencionalmente sem anexos. A primeira autorização tem um documento de duas páginas. Outros registros fictícios anteriores podem aparecer na mesma farmácia.

## Roteiro de aprovação

1. Pesquisar Dia = 02/11/2026 e conferir 20 registros na primeira página; avançar e voltar sem perder marcações.
2. Marcar autorizações, mudar para 31/10/2026 e marcar outras. A seleção acumulada deve manter as anteriores e não duplicar uma autorização já selecionada.
3. Limpar pesquisa: os filtros e resultados são limpos, mas a seleção permanece. Limpar seleção é uma ação separada.
4. Pesquisar Mês = 2026-11 ou Período = 31/10/2026 a 02/11/2026. Gerar PDF da pesquisa deve incluir todas as páginas de resultados.
5. Baixar a listagem geral e o PDF com documentos da primeira parte. Gerar as demais partes pelos botões numerados. Cada parte inclui sua listagem antes dos documentos.
6. Conferir avisos de autorizações sem anexos. Elas continuam relacionadas no PDF, sem fingir que têm documentos.
7. Gerar PDF das selecionadas após pesquisas de datas diferentes.

A seleção permanece enquanto esta consulta estiver aberta; mudar de farmácia, sair da conta ou recarregar a página inicia outra consulta. Somente o PDF de documentos mais recente fica pronto na memória; partes anteriores podem ser geradas novamente. Isso evita acumular muitos arquivos grandes no navegador. Não há download automático em massa.

## Repetir a preparação

O script `tools/seed-autorizacoes-pesquisa-demo.mjs` aceita exclusivamente o projeto `ympeqcycjadvvumanmwm` e a farmácia fictícia esperada. Usa autenticação normal e confirma Storage antes de registrar documentos. É idempotente e não apaga dados.

Fornecer a senha temporariamente em `RBK_DEMO_PASSWORD`; não gravar credenciais no repositório. O teste opcional `RBK_TEST_DEV_PESQUISA=1` valida a paginação real e a recusa dos relatórios para o atendente. A sessão criada para o teste é encerrada apenas localmente.
