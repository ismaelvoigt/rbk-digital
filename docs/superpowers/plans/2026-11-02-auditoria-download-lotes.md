# Download de lotes em ZIP

Aprovado: uso em desktop; um ZIP por lote e um ZIP com pasta por lote para todos os lotes. Preservar nomes originais, distinguindo homônimos. Incluir apenas arquivos recebidos de lotes concluídos, sem ofícios ou arquivos de outras auditorias. Não aplicar espera de quarentena.

Arquitetura: endpoint GET exclusivo com sessão por cookies validada no servidor e autorização atual via aud_manager(detail). Gerar ZIP64 em fluxo com zip.js, arquivos sequenciais e sem acumular dados em memória. Resposta privada, sem cache, attachment. Renovar URL temporária de cada arquivo ao iniciar sua leitura. Falha/cancelamento interrompe o ZIP, sem saltar arquivos silenciosamente. Timeout da função continua aplicável; disponibilizar lote individual para seleções grandes/conexões lentas.

- [x] Testes de seleção, nomes duplicados/traversal, extração real ZIP64, falha e cancelamento; observar falhas iniciais.
- [x] Implementar seleção/fluxo ZIP e endpoint com autenticação/autorização, testes de endpoint sem sessão e sem permissão.
- [x] Adicionar Baixar lote e Baixar todos os lotes, sem carregar Blob no navegador; testes de interface.
- [x] TypeScript, build, suíte, revisão independente, publicar no desenvolvimento.

Validação local: 671 testes aprovados; 3 falhas preexistentes por private/ficha-template.xlsx ausente. TypeScript, lint e build aprovados. ZIP64 real extraído em teste; seleção, sessão/cookies renovados, RBAC, nomes repetidos e cancelamento cobertos. Teste manual sintético de 30 arquivos de 100 MiB (3.145.728.000 bytes) em fluxo para descarte, com crescimento de RSS abaixo de 512 MiB. Revisão independente sem bloqueios. Ainda necessário validar transferência real grande no ambiente publicado: limite da função 300 s e velocidade da conexão podem interromper downloads grandes; interface orienta baixar por lote nesse caso. Nenhum documento de cliente foi baixado para validar o recurso.
