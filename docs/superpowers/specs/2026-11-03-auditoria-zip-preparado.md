# ZIP de auditoria preparado em etapas

Pedido aprovado: preparar o ZIP em etapas, armazenar temporariamente, liberar somente depois de concluir e validar; desenvolvimento primeiro. Nenhuma mudança em produção.

O ZIP64 STORE será construído por partes S3, com snapshot imutável dos arquivos recebidos em lotes concluídos. Workflow durável processa checkpoints de até16 arquivos, acumulando buffers privados até atingir >=8 MiB por parte, exceto a última, valida tamanho e SHA256 original de cada documento, calcula CRC32 e salva metadados/ETags. Completa o upload multipart e lê cada parte por Range para conferir SHA256 antes de marcar pronto. Download final é uma URL curta do Storage privado, sem passagem do arquivo pela função de cinco minutos.

Autorização: aud_manager(detail) no pedido, status e download; worker confere o solicitante ativo e sua autorização atual no banco. Dados/jobs/bucket privados, somente service_role. Nenhuma URL assinada ou segredo nos estados do workflow. API retorna somente progresso/erros genéricos. Mudanças nos arquivos invalidam a liberação. Expiração de 24 horas; workflow de limpeza e verificação de expiração antes de assinar. Cópias temporárias removidas, originais preservados. ZIP e partes órfãs são limpos em falha/expiração.

Limites operacionais explícitos: até 50 GiB/10 mil documentos inicialmente, documento até 100 MiB (já limite de upload). Não há limite de cinco minutos para o trabalho completo, apenas etapas curtas. Mantém pastas por lote e nome da razão social. Interface exibe Preparando, Validando, Pronto, Falhou/Expirado e permite nova tentativa após falha.

Teste com dados sintéticos; jamais copiar documentos do Jean para desenvolvimento. Credenciamento e produção não fazem parte desta alteração.
