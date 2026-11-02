# Interface enxuta para atendente/balconista

Pedido: remover do perfil operador a pesquisa de páginas, os textos indicados nos três recortes do cadastro e os cards Próximas Dispensações e Pendências no início. Manter cards e pesquisa para gerente/administrador da farmácia, incluindo perfil legado farmacia.

- [x] Testes RED/GREEN por perfil: operador sem busca (incluindo Ctrl+K), próximos/pendências e instruções; gerente/administrador/legado mantêm acompanhamento; progresso e envio permanecem.
- [x] Hook usePerfilAtual extrai a resolução já existente (users ativo + precedência rbk_admins); aceita perfil já resolvido opcional para não duplicar consulta no cadastro.
- [x] HeaderSearch não renderiza nem registra atalho para operador ou perfil ainda não validado. RbkBrand repassa perfil opcional; demais páginas continuam com resolução completa.
- [x] Nova autorização oculta somente orientações introdutórias para operador; status selecionado/confirmado/falha, progresso, erro e aviso de envio em andamento permanecem.
- [x] Farmácia só monta os dois cards de acompanhamento depois de confirmar perfil de gestão; operador não dispara a consulta do card de próximas dispensações.
- [x] Revisão independente detectou perda de precedência rbk_admins ao fornecer o perfil bruto de users no início; corrigido mantendo resolução completa nesse cabeçalho. Teste cobre rbk_admins + operador legado.
- [x] Layout móvel conferido em build local, largura 390px; captura salva no chat. A consulta de perfil ainda pendente também mantém a interface sem itens de gestão, evitando flashes.

Escopo exclusivamente de interface em desenvolvimento. Não altera permissões backend, RLS, rotas por perfil ou funcionalidades de gerente/gestor. Sem acesso ou alteração de produção.

Validação final: 606 testes aprovados, 4 live ignorados e três falhas baseline de tests/pfpb-workbook.test.ts por template ausente. TypeScript e build Webpack aprovados. Lint sem erros, quatro avisos legados em farmacia/page.tsx. Revisão final sem achados importantes.
