# Portal Auditoria PFPB Implementation Plan

**Goal:** implementar coleta segura, incremental e rastreável no RBK Digital.
**Architecture:** Next routes → RPCs restritas → PostgreSQL/Storage privado; cliente TUS direto.
**Tech Stack:** Next 16, React 19, Supabase, PostgreSQL, tus-js-client, Vitest/PGlite.
**Spec:** ../specs/2026-09-18-auditoria-portal.md
**Execution:** inline nesta tarefa, com testes antes da implementação e revisão final.

## Restrições globais
Sem produção, sem IA, sem documentos reais; RBAC existente por vínculo; configuração bloqueada por padrão e ref explícita de staging.

- [ ] Banco: tests/auditoria-sql.test.ts executará schema aditivo supabase/auditoria-schema.sql. Verificar SELECT negado entre farms, operações restritas, idempotência, tokens e totais, leitura de objeto real, lock de fechamento.
- [ ] API: src/lib/auditoria/{server,domain}.ts e api/auditorias/[[...segments]]/route.ts; api/portal-auditoria/route.ts. Testar token aleatório/hash, limites, validação de origem, corpos limitados, proteção staging. Manager usa bearer validado; portal só capability hash.
- [ ] Upload: src/lib/auditoria/upload.ts, testes de TUS resumível/retry com servidor sintético. Assinar caminho reservado; metadata verificada na finalização; não liberar download de quarentena.
- [ ] UI: processos/auditorias/page.tsx e portal/auditoria/page.tsx; progresso, comprovantes, histórico, encerramento/reabertura, revogação. Adicionar entrada no dashboard e exceção pública estrita no proxy.
- [ ] Verificar TypeScript/lint/build e cenários locais. Relatar separadamente testes não executados em staging. Entregar schema, código, relatório e projeções de custo.
