# Exclusão de fichas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Limpar credenciamentos com confirmação simples e proteger exclusão de auditorias pelo CNPJ.
**Architecture:** Exclusão lógica em cre_processes, filtrada pela mesma RPC que controla convites e gravações. Auditoria valida CNPJ na interface e no banco, preservando proteção contra envio iniciado. Nenhum arquivo será apagado.
**Tech Stack:** Next.js, TypeScript, PostgreSQL, Vitest/PGlite.
**Spec:** docs/superpowers/specs/2026-11-02-exclusao-fichas-design.md

## Global Constraints
Preservar vínculos, arquivos e eventos. Não excluir registros reais durante testes.

## Review Focus
Acesso de outro gestor; convite antigo; requisição sem confirmação; CNPJ incorreto; tentativa de renovar ficha excluída.

### Task 1: Proteções e exclusão lógica
- [x] Testes SQL de remoção, preservação e bloqueios, observando falha inicial.
- [x] Migration aditiva com deleted_at/deleted_by, remove na cre_command, filtros e revogação; validar CNPJ dentro de aud_private.manager sem substituir lógica de outras versões.
- [x] Executar testes SQL e conferir permissões.

### Task 2: Interfaces
- [x] Testes da confirmação simples e da digitação do CNPJ, observando falha inicial.
- [x] Excluir ficha em form.html, com id explícito e atualização apenas após confirmação da RPC; Audits pede CNPJ, identifica referência e envia confirmação ao banco.
- [x] Testes focados, TypeScript e build; revisão independente antes de integrar.

## Validação
658 testes aprovados, 3 falhas preexistentes por ausência de private/ficha-template.xlsx, 4 ignorados. TypeScript e build webpack aprovados. Revisão independente: sem bloqueios, 31 testes focados aprovados. Migration aplicada ao desenvolvimento e verificada sem exclusões reais.
