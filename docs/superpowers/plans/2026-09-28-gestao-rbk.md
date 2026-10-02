# Gestão RBK Implementation Plan
> Execução nesta sessão com superpowers:executing-plans; escopo e publicação autorizados pelo pedido do usuário.
**Goal:** adicionar Financeiro e CRM preservando o painel atual.
**Architecture:** Next.js client pages com RPC autenticada; PostgreSQL privado e tabelas aditivas, nenhum gateway externo.
**Tech Stack:** Next 16, React 19, Supabase/PostgreSQL, Vitest/PGlite.
**Spec:** docs/superpowers/specs/2026-09-28-gestao-rbk.md
## Global Constraints
Preservar cards/rotas. Reutilizar CNPJ/farm_id. Sem cobranças/envios externos. Testar antes de publicar.
## Review Focus
- Concorrência de pagamentos e edição: saldo, chave idempotente, updated_at.
- Fim de mês, início futuro e cancelamento: competências sem duplicatas e MRR correto.
- Gestor acessando CNPJ de outra carteira: negar vínculo e leitura.
- CNPJ formatado repetido: reutilizar ou informar conflito, nunca duplicar.
- Erro na gravação: manter formulário e comunicar falha sem sucesso falso.
## Task 1: Dados e regras
- [x] Testar em tests/gestao-sql.test.ts cadastro, filtros, permissões, conversão, recorrência e pagamentos antes da implementação.
- [x] Criar supabase/gestao-rbk.sql: tabelas rbk_crm_clientes, rbk_contratos, rbk_cobrancas, rbk_pagamentos, rbk_comunicados, rbk_gestao_eventos; RPC gestao_rbk(p_action text,p_data jsonb).
- [x] Rodar testes SQL até aprovação.
## Task 2: Interface e acesso
- [x] Testar preservação do dashboard e acesso em tests/gestao-ui.test.tsx.
- [x] Criar src/lib/gestao/types.ts e client.ts; componentes CRM, Financeiro e campos compartilhados.
- [x] Adicionar cards no final do dashboard e proteção de /crm e /financeiro.
- [x] Validar cadastro, edição, filtros e gravação manual em testes de interface.
## Task 3: Integração e publicação
- [x] Suíte completa, TypeScript, build, revisão independente e correções.
- [x] Reconciliar alterações recentes de documentos e preservar publicação mais recente.
- [x] Aplicar migração aditiva validada; testes no banco e publicação Vercel.
- [x] Confirmar publicação pronta e registrar evidências em outputs.

## Resultado
567 testes aprovados; TypeScript, lint e build aprovados. Revisão independente com três achados corrigidos e cobertos por testes. Migração 20260928180650 aplicada e validação real revertida. Produção READY: dpl_9k1mF3jf4ydtsPYQbVuqb3p5MV7h. Painel, CRM e Financeiro conferidos na sessão autenticada.
