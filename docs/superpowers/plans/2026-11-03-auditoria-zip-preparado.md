# Auditoria ZIP preparado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Execute inline; review the complete branch at the end.

**Goal:** Produzir ZIPs grandes retomáveis no desenvolvimento e liberar download apenas após validação.
**Architecture:** Snapshot privado no Postgres, Workflow durável, upload S3 multipart, ZIP64 STORE e validação Range SHA256. Native Storage download after readiness.
**Tech Stack:** Next.js, Supabase, AWS SDK S3, Workflow 5, Vitest.
**Spec:** docs/superpowers/specs/2026-11-03-auditoria-zip-preparado.md

- [x] TDD: codificador ZIP64 por etapas, CRC, tamanho, grupos, extração real e offsets >4GiB.
- [x] Banco privado: jobs, partes, acesso do worker, snapshot, expiração.
- [x] Worker: iniciar/repetir partes, completar, validar, cleanup; testes de interrupção e integridade.
- [x] API: autenticar, criar/retomar, progresso, download pronto; negar prematuro e não autorizado.
- [x] UI: preparar/progresso/repetir, preservar downloads por lote no restante.
- [ ] Build/testes, review independente; aplicar migração exclusivamente dev, publicar dev e testar artefato fictício.

## Ledger
- Inicio: usuário aprovou a solução em etapas. Produção intocada. Ajuste local de rótulo preservado em stash; não incluir.
- Ruling: S3 multipart com JWT service_role no servidor evita novas credenciais S3 e mantém objetos privados; Workflow guarda somente IDs e progresso pequeno.

- Ruling: limite de tamanho é do ZIP final, incluindo diretório/cabeçalhos, não apenas fontes.
- Ruling: muitos arquivos pequenos exigem buffers privados intermediários; cada advance grava checkpoint após até16 arquivos ou orçamento de45s, independentemente do mínimo multipart. Upload/fetch de cada objeto com deadline de60s.
- Review: corrigidas repetição de ready, diretório duplicado após parte salva e checkpoint perdido, quota concorrente (RPC com advisory lock), capacidade no limite.
- Migrations aplicadas somente DEV. Service-role rollback self-test passou para criação, contexto do solicitante, permissão e limpeza.
- Auto-review rejeitou remoção de FKs; alternativa aprovada explicitamente pelo usuário mantém FKs com ON DELETE SET NULL. Nenhum vínculo fica sem validação referencial.
- Teste sintético >4GiB passou em60s, memória<1GiB. 40 PDFs fictícios confirmados em Storage DEV; nenhuma cópia de produção.
- Pendente: confirmar deploy DEV e download/extração no ambiente hospedado.
