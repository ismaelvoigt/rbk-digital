# Relatórios e PDFs — RBK Digital

Implementação local de 26/09/2026. Publicação e migração remota não executadas.

## Funcionalidade

- Rota `/relatorios`, acessível pelo Dashboard do gestor/administrador e pelo card da área da farmácia em desktop (a partir de 1024 px).
- Filtros combináveis: dia, período inclusivo, autorização, CPF, CRM e UF. Sem nome.
- Tabela paginada (25 registros), seleção individual ou múltipla mantida entre páginas. Mudar filtros ou pesquisar novamente limpa seleção/resultados anteriores.
- PDF individual reutiliza `gerarAutorizacaoPdf`, mantendo layout e anexos do gerador já existente. O botão na página de documentos permanece intacto.
- PDF consolidado reúne as páginas dos PDFs individuais na ordem de seleção; limite de 20 autorizações, 200 páginas e 100 MB. Qualquer falha interrompe a entrega para não gerar arquivo parcial.
- ZIP por autorização preserva os bytes dos anexos originais e normaliza nomes. Registros sem arquivo não são apresentados como anexos incluídos.
- CRM opcional no novo cadastro e editor no módulo para registros antigos. Exige UF quando preenchido; números normalizados sem zeros iniciais. Ambos em branco removem o CRM. Sem OCR ou inferência automática.
- Retorno ao Dashboard conduz ao painel permitido ao perfil (`/dashboard` ou `/farmacia`).

## Banco e implantação

Aplicar a migração `supabase/migrations/20260926183717_autorizacoes_crm_relatorios.sql` no ambiente escolhido antes de publicar o módulo. Ela adiciona `crm` e `crm_uf` opcionais, restrição de consistência e índice, sem preencher registros antigos, alterar arquivos ou mudar permissões RLS.

As consultas/downloads usam a sessão do usuário e as políticas existentes. Nenhuma chave administrativa é usada neste módulo. Não concede acesso adicional ao gestor. Na produção inspecionada, autorizações/documentos ainda têm políticas de proprietário (`user_id`); a implantação do acesso por carteira/farmácia do projeto é uma dependência separada. Antes de publicar para gestores, confirmar essas permissões no ambiente de destino com contas reais autorizadas.

Não executar automaticamente todas as migrações históricas pendentes: o repositório já contém alterações de outras tarefas. Rever a implantação específica deste módulo. Sem as colunas CRM, a busca informa que a atualização do banco é necessária; não ignora silenciosamente o filtro.

## Verificação

- Compilação Next.js de produção: passou.
- TypeScript: passou.
- ESLint do módulo e testes novos: sem erros/avisos. Páginas antigas possuem avisos preexistentes.
- 20 testes novos passaram: normalização e datas inclusivas, CPF/número, CRM/UF, consulta paginada, sessão/perfil, falha ao salvar, consolidação, aborto sem arquivo parcial, integridade do ZIP e migração PostgreSQL via PGlite.
- Suíte completa: 329 testes passaram, 2 falharam e 1 foi ignorado. As duas falhas também foram reproduzidas numa cópia da versão original, sem as mudanças desta tarefa:
  - `tests/documentos-usuario-fluxo.test.ts`: busca textual por `/dashboard` na página de documentos.
  - `tests/farmacia-integracao.test.ts`: exige texto fixo `href="/farmacia"` na consulta de autorizações.
  Ambas são expectativas antigas incompatíveis com a navegação dinâmica por perfil já presente no projeto; não foram alteradas nesta tarefa.
- Navegador com servidor local e API fictícia: cards dos dois perfis, retorno correto, filtros por dia/período/CPF/número/CRM-UF, seleção entre páginas, limite de 20, edição do CRM, geração individual/consolidada/ZIP e mensagem de erro/reativação de botão após falha do anexo.
- Responsividade: desktop e 390 px; largura do documento igual à viewport no mobile. Tabela tem rolagem própria. Card da farmácia verificado visível em 1440 px e oculto em 390 px; card de gestão e retorno ao Dashboard verificados. Compilação aprovada após esse ajuste.
- O navegador integrado mostrou sucesso da geração, mas não expôs o evento de download nem um arquivo salvo verificável. O contrato de entrega ao navegador, nomes, páginas e bytes do ZIP foram conferidos por testes automatizados do serviço. Validar o salvamento final no navegador de uso antes da publicação.
- Revisão independente do código: sem achados bloqueantes.

Prévia local usa apenas dados fictícios e não escreve na produção. Limitações e testes não substituem homologação autenticada com RLS real do ambiente de destino.
