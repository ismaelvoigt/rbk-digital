# Autorizações paginadas e relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Executar na sessão atual.

**Goal:** Pesquisa de 20 por página, seleção acumulada e PDF completo por dia/período/mês ou seleção.
**Architecture:** Serviço de consultas RLS com escopo validado; componente comum para os dois acessos; exportação incremental reutilizando renderizador existente, com partes para download explícito.
**Tech Stack:** Next.js/React/TypeScript, Supabase, pdf-lib, Vitest.
**Spec:** docs/superpowers/specs/2026-11-02-autorizacoes-pesquisa-design.md

## Global Constraints
Somente desenvolvimento para aprovação. Não alterar dados, planos ou permissões. Consultar com sessão atual e farm_id explícito quando selecionado. Não persistir CPFs/documentos. Relatórios nunca limitados a 20 resultados totais.

## Review Focus
Troca de farmácia/sessão não reaproveita seleção; respostas atrasadas não substituem pesquisas mais recentes; filtros em edição não alteram pesquisa aplicada; relatório superior a uma página não omite registros; falha após partes geradas não apaga partes concluídas nem omite erro.

### Task 1: Consulta e filtros
- [x] Testes falhando de datas reais, mês, paginação/range20, contagem e escopo; implementar src/lib/autorizacoes/pesquisa.ts.
- [x] Busca completa por páginas com ordenação estável e snapshot de criação; seleção por IDs revalidada no escopo e sem duplicação.

### Task 2: PDFs em partes
- [x] Testes falhando de lista+documentos, limites de partes, ausência de documentos, falha parcial e escopo.
- [x] Implementar src/lib/autorizacoes/relatorioPesquisa.ts reutilizando carregarArquivoPdf/gerarAutorizacaoPdf/renderizarAnexo; listas com numeração/totais e parte N. Sem baixar automaticamente vários PDFs.

### Task 3: Interface comum
- [x] Testes falhando de seleção entre pesquisas/páginas, limpar filtros vs seleção, mês, relatório completo e página 20.
- [x] Criar PesquisaAutorizacoes e integrar páginas existentes com verificação de acesso preservada.
- [x] Exibir PDFs concluídos como links de download e erros sem perder seleção.

### Task 4: Validação e entrega
- [x] Testes apropriados, lint, TypeScript, build, revisão independente.
- [x] Publicar somente no desenvolvimento e entregar para aprovação.

## Decisões de implementação e evidências

Ruling: gerar a primeira parte automaticamente e as seguintes sob demanda, mantendo apenas o PDF de documentos mais recente na memória. As partes anteriores permanecem regeneráveis por seus IDs, evitando acumular muitos Blobs grandes; a seleção e os dados não são persistidos no navegador.

Ruling: compartilhar consulta e interface, substituindo duplicação das duas páginas. Os testes legados que inspecionavam consultas dentro das páginas passaram a inspecionar a camada compartilhada; novos testes de comportamento verificam RLS/escopo, paginação, seleção e PDFs.

Revisão independente identificou uma janela de edição de CPF/data/número entre listagem e documentos. Corrigido com comparação dos metadados capturados e duas regressões observadas falhando antes da correção. Revisão de acompanhamento sem bloqueios.

Validação: 687 testes aprovados; 3 falhas preexistentes por modelo privado de planilha ausente; 6 ignorados, incluindo os testes opcionais de ambiente/volume. TypeScript, lint e build aprovados. Teste real opcional de desenvolvimento aprovado com atendente/RLS; 45 autorizações e 42 PDFs fictícios confirmados. Listagem PDF de 60 registros renderizada e inspecionada visualmente, com três páginas e horário de Brasília. Publicação exclusivamente no desenvolvimento para aprovação do usuário.

## Restrição de perfis confirmada pelo usuário

Seleção acumulada, filtros rápidos dia/mês e relatórios são exclusivos de gestor/superadmin RBK, gerente_farmacia e administrador_farmacia (incluindo legado farmacia). Atendente mantém consulta enxuta CPF/número/datas e conferência de documentos; a paginação continua em 20 para limitar o carregamento. O papel é validado novamente nos serviços de relatório, e uma mudança de papel exige atualizar o contexto. A conta fictícia de atendente não é promovida; os dados de teste da mesma farmácia podem ser consultados pelo gestor RBK.

Validação após a restrição de perfis: 694 testes aprovados, 3 falhas preexistentes, 6 opcionais ignorados; TypeScript, lint e build aprovados. Teste real no desenvolvimento comprova consulta do atendente e recusa de agregação/seleção para relatórios. Matriz visual dos quatro perfis de gestão e ausência de controles no atendente cobertas. Revisão independente do ajuste sem bloqueios.
