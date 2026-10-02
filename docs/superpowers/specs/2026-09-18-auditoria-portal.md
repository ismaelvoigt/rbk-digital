# Portal de documentos — especificação aprovada pelo usuário

Escopo: Processos → Auditorias PFPB, Gestor RBK vinculado à farmácia e Superadmin validado por rbk_admins. Reutilizar rbk_private.actor_role/can_access_farm. Não depende do credenciamento. Nenhuma alteração de produção.

Link com 256 bits aleatórios no fragmento URL; somente SHA-256 no banco. API recebe token em header, valida expiração/revogação a cada operação. Nenhuma análise interna retorna ao cliente. Link renovado invalida anterior. Mesma auditoria aceita vários lotes com idempotência e numeração sob lock; manifesto congelado; finalização consulta objetos do storage, não confia em tamanho informado pelo navegador.

Storage privado, direto via TUS de 6 MiB, signed upload restrito a um caminho aleatório, sem upsert. PDFs/JPEG/PNG/TIFF até 100 MiB por arquivo, 100 arquivos/lote, 1 GiB por lote e 5 GiB por auditoria. ZIP/executáveis/macro não aceitos nesta versão. Scanner obrigatório antes de download; arquivos permanecem em quarentena se scanner indisponível. Nenhuma exclusão automática; limites podem ser revisados após homologação.

Limitação explícita: credenciais signed upload já emitidas continuam válidas pelo prazo do Supabase (2 horas); revogação/fechamento bloqueiam emissão e finalização imediatamente, mas não eliminam bytes em trânsito. Não promover a produção sem avaliar essa janela e testar comportamento real do Storage.

Logs somente eventos, IDs e contagens, sem token/conteúdo. Quotas e rate limit persistidos; gateway deve prover rate limit de IP confiável adicional. Dados exibidos no portal: identificação mínima, lotes/arquivos recebidos, datas, totais/protocolo RBK; sem observações internas. IA desativada e fila preparada sem consumidor automático.

Testes: PostgreSQL local com papéis/RLS reais; controles do token/API; cliente TUS; desktop/mobile com dados sintéticos. Testes integrados em Supabase staging ficam pendentes enquanto não houver projeto e credenciais confirmados.
