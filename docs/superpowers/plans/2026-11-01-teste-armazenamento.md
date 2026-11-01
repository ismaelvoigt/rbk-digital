# Teste de armazenamento e exclusão de acesso — Implementation Plan

**Goal:** Convidar o responsável como atendente, separar perfil de plano e excluir individualmente acessos sem uso.
**Architecture:** Perfil em users, plano em farms. Novas farmácias entram em armazenamento; cadastros anteriores conservam completo. Apenas administradores RBK ativos alteram plano/promovem/excluem. Conferência e exclusão transacionais, com bloqueio de gravações concorrentes e registro privado da exclusão.
**Tech Stack:** Next.js, Supabase/Postgres, Vitest/PGlite.
**Spec:** Solicitação e decisão do usuário neste chat em 01/11/2026.

## Global Constraints
- Somente desenvolvimento; nenhuma alteração de produção/main.
- Nenhuma exclusão em lote nem exclusão de contas reais durante implementação.
- Promoção preserva usuário, farmácia, arquivos e plano.
- Exclusão de login preserva farmácia; recusa qualquer autorização, arquivo, documento ou vínculo de negócio e contas RBK/própria conta.

## Review Focus
- Cadastro repetido não rebaixa perfil/plano nem transfere usuário.
- Administração de equipe continua disponível no plano armazenamento após promoção.
- Plano é validado também no banco e APIs, não apenas na interface.
- Tokens antigos não permitem novas gravações após exclusão.
- Falha de envio não é apresentada como convite entregue.

## Tasks
- [x] Testes de banco: plano/perfil independentes, isolamento, exclusão com vínculos, confirmação e gravação tardia.
- [x] Migração: plano legado completo, novo armazenamento, ações RBK e exclusão atômica sem arquivos.
- [x] Convite inicial e lista: responsável operador marcado, preservação dos existentes.
- [x] Interface: promoção e plano separados; exclusão com confirmação por e-mail; menus adequados ao plano.
- [ ] Verificar testes, tipos, build e revisão; aplicar somente banco de desenvolvimento e publicar preview.

## Ledger
- Decisão: executar neste ramo de desenvolvimento já utilizado, mantendo arquivos duplicados preexistentes fora dos commits.
- Decisão: vínculos adicionais bloqueiam exclusão, para evitar cascata destrutiva; histórico de criação de documentos também bloqueia mesmo após remoção do arquivo.

- Verificação: 626 testes aprovados, 4 integrações ignoradas, 3 falhas preexistentes por private/ficha-template.xlsx ausente. Tipos e build aprovados; lint sem erros (avisos antigos). Revisão independente concluída e correções cobertas por regressões.
- Banco desenvolvimento ympeqcycjadvvumanmwm atualizado; antes/depois: 2 usuários, 1 farmácia, 12 documentos; zero exclusões.
- Requisito do teste do usuário: criar administrador RBK separado; ambiente atual tem zero RBK ativos. E-mail solicitado, sem alterar contas de atendente.
