# Vendas e Indicadores

Módulo em `/vendas`, acessível pelos Dashboards da farmácia e de gestão. Responsivo, com títulos ao lado dos ícones e retorno ao Dashboard conforme o perfil.

## Escopo entregue

- Hoje, 7 dias incluindo hoje, mês e ano acumulados, intervalo personalizado de até 10 anos.
- Data da autorização como referência consistente para incluir registros sem extração. Calendário America/Sao_Paulo. Data expressa no cupom aparece separadamente no detalhe.
- Autorizações únicas; soma de quantidades declaradas; total líquido documentado; previsto PFPB explícito na fonte; ticket médio da base completa.
- Evolução diária/mensal, ranking por produto/EAN e unidade, princípio ativo ou indicação, comparação com intervalo imediatamente anterior de igual duração.
- Tabela de 25 itens por página, detalhe da fonte de cada campo, documentos vinculados.
- Exportação de TODOS os registros consultados: XLSX de três abas ou ZIP de três CSVs (Itens, Autorizações, Resumo e critérios). CPF e observação existentes na base estão na aba de autorizações e no detalhe de origem.

## Ativação

O esquema observado em produção contém apenas autorizações e documentos, sem campos de itens ou valores. O módulo não cria números a partir desses anexos.

Aplicar uma única vez `supabase/vendas-schema.sql` no ambiente escolhido antes de alimentar os itens. O script foi validado com PostgreSQL local (PGlite); não foi executado em produção. Não depende da migração separada de CRM nem de farm_id na autorização.

A tela funciona sem a tabela nova: mantém a contagem de autorizações, informa a estrutura pendente e não apresenta valores inventados. Quando a tabela existe, mas está vazia, informa ausência de itens confirmados.

O processamento/extração dos cupons deve gravar `dispensacao_itens` pelo servidor, após validar acesso à autorização, origem e revisão. Esta entrega prepara armazenamento e leitura; NÃO implementa OCR novo, classificação clínica, extração retroativa, conciliação de pagamentos ou projeção de estoque.

## Contrato para a extração

Cada item é uma linha canônica da dispensação, com chave única `(autorizacao_id, posicao)`. Reprocessamento faz upsert por essa chave; ao ler cupom fiscal e vinculado, reconciliar as linhas antes de gravar. Não criar duas vendas para os dois documentos da mesma operação.

- `documento_id`: cupom fiscal ou vinculado já anexado à mesma autorização; obrigatório.
- `produto`, `ean`, `unidade`, `quantidade`, `valor_unitario`, `valor_total`, `data_dispensacao`: somente o que a fonte efetivamente informa. Campos ausentes recebem NULL. EAN preservado como texto.
- `valor_total`: total líquido da linha. Não é calculado silenciosamente de quantidade × preço, pois descontos podem existir.
- `valor_pfpb`: valor da linha explicitamente atribuído ao PFPB; nunca presumir igual ao valor de venda. Se só houver valor do cupom inteiro, não replicar em cada item nem ratear sem uma fonte documentada.
- `principio_ativo` e `indicacao`: somente com associação verificada e documentada (por exemplo, cadastro oficial por EAN, com versão e campo); sem inferência a partir de nomes livres.
- `origens`: objeto de campo → texto descritivo obrigatório para cada campo preenchido. Identificar documento, página/linha ou cadastro/versão/campo. Não usar descrições genéricas que não permitam conferir.
- `status`: pendente por padrão; confirmado após conciliação/revisão; cancelado para não compor indicadores. Substituir o arquivo, categoria ou autorização do documento invalida os confirmados e exige nova confirmação.

Quantidades somam os valores declarados, sem converter caixas, comprimidos ou outras unidades; os rankings separam as unidades. Totais conhecidos são exibidos com contagem de cobertura. Campos nulos não viram zero. Itens pendentes/cancelados não entram nas somas. Ticket considera apenas autorizações com itens confirmados, todos os respectivos totais conhecidos e sem itens pendentes. Percentuais são omitidos quando a base é zero, ausente ou incompleta.

## Acesso e integridade

Leitura pelo cliente autenticado, sob a mesma visibilidade RLS das autorizações existentes. Não amplia acesso administrativo nem atribui acesso a outras farmácias. A API do navegador não recebe permissão de escrita nos itens; a integração usa credencial exclusivamente no servidor. Sem chave administrativa no módulo cliente.

A função privada de invalidação é executada somente por trigger após edição autorizada de documento; usa search_path vazio e não pode ser chamada por anon/authenticated. RLS, ausência de acesso anônimo, bloqueio de escrita cliente, documento de outra autorização, duplicidade, valores negativos/NaN, origem obrigatória e substituição de cupom foram testados.

Leitura por cursor de ID evita perder registros não lidos quando há exclusões entre páginas. Limite explícito de 100 mil autorizações ou itens por intervalo: acima dele a consulta pede intervalo menor e não apresenta total truncado. Consultas paginadas não são um snapshot transacional; alterações simultâneas podem requerer atualização do painel.

## Verificação

18 testes específicos do módulo passaram: datas/calendário, ausências, valores parciais, centavos, pending, agrupamentos, paginação, falhas, CSV/XLSX, RLS e integridade SQL. Build e tipos passaram; lint dos arquivos novos sem erros.

A suíte existente apresentou duas falhas anteriores em `documentos-usuario-fluxo.test.ts` e `farmacia-integracao.test.ts`: expectativas textuais antigas de navegação. Os arquivos fonte verificados por esses testes permanecem idênticos à base original. Não foram modificados para encobrir as falhas.

Prévia usa servidor de dados fictícios separado, fora do código entregue. Nenhum dado real foi alterado. Publicação e ativação no banco de produção permanecem pendentes de revisão da prévia.
