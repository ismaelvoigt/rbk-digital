# Desempenho do armazenamento e abertura de documentos

Solicitação: melhorar armazenamento e transição entre cards/telas em desenvolvimento, preservando confirmação efetiva e produção.

## Evidência inicial

Consultas somente leitura no banco isolado, sem abrir conteúdo dos anexos ou escrever documentos. Os quatro arquivos da autorização de teste somavam 512.969 bytes. Em cinco amostras alternadas, o fluxo serial de getUser → autorização → documentos mediu 664, 746, 508, 519 e 541 ms; o novo fluxo getUser → autorização/documentos em paralelo mediu 617, 384, 367, 325 e 348 ms. Medianas 541 e 367 ms. Estas medições partem do computador conectado; não representam pintura da interface nem latência no celular.

## Implementação

- [x] Testes RED antes da implementação: consultas independentes em paralelo e próximo upload iniciado enquanto registro anterior está pendente.
- [x] Consultar autorização e documentos em paralelo depois da sessão, mantendo RLS e falhando quando qualquer consulta falha.
- [x] Sobrepor confirmações dos arquivos anteriores com os uploads seguintes: até dois uploads de bytes simultâneos e quatro documentos em processamento total.
- [x] Preservar tamanho confirmado no Storage e vínculo confirmado no banco para mostrar salvo; manter IDs e retomada da etapa anterior.
- [x] Adicionar loading de rota com retorno disponível; erro recuperável, nova tentativa e proteção contra respostas antigas.
- [x] Testes de interação de carregamento/erro/retry e revisão independente sem achados acionáveis.

## Validação

Simulação isolada de quatro arquivos, com upload de 40 ms, consulta Storage de 30 ms e registro de 30 ms: antes 206/206/207 ms, depois 145/144/145 ms. Não é medição de upload real. O teste de concorrência continua limitando a dois uploads e bloqueia excesso de documentos em processamento.

Manter testes live desligados e as três falhas baseline de pfpb-workbook por private/ficha-template.xlsx ausente documentadas. Nenhuma alteração em schema, RLS, políticas de autenticação ou produção. O teclado numérico do cadastro foi publicado separadamente no commit 28b2f8b.
