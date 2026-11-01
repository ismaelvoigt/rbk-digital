# Cadastro compacto em uma página, sem CRM

Solicitação aprovada: testar a proposta de mesma página com cards recolhidos após selecionar, resumo sempre visível e botão de salvar acessível; remover CRM do cadastro da nova autorização.

- [x] Testes RED/GREEN: seleção recolhe prévia sem perder File; Conferir/Recolher; opcionais podem ser conferidos/removidos; cadastro não mostra CRM e não envia CRM/UF; resumo conta quatro categorias obrigatórias.
- [x] Componente opt-in `compactarAposSelecionar`: resumo com nome/quantidade, Conferir e Substituir/Adicionar; modo expandido preserva câmera, galeria e remoção.
- [x] Cadastro remove imports, estados, validação e payload de CRM/UF. Não altera campos antigos, relatórios, banco ou permissões.
- [x] Rodapé sticky com progresso selecionado/confirmado distintos, opcionais separados, mensagens e botão de salvar. Áreas seguras de celular e labels dos campos associadas.
- [x] Revisão independente sem achados acionáveis; TypeScript e build Webpack aprovados; lint sem erros, dois avisos legados no card.
- [x] Layout móvel conferido no navegador em 390×844 e 320×740: sem rolagem horizontal, rodapé no limite da viewport, seleção/conferir/recolher/remover funcionais. Captura salva no chat com arquivo fictício; sem envio ao banco.
- [ ] Publicação automática na mesma prévia de desenvolvimento/PR2.

Escopo: uma página; nenhum upload automático ao selecionar, nenhuma mudança nas garantias de confirmação ou retomada. Conferir/Recolher não altera o arquivo selecionado. Sem alteração em main/produção.

Validação final: 598 testes aprovados, 4 live ignorados, três falhas baseline do template ausente. Primeira execução sem permissão de rede bloqueou os dois testes TUS locais; reexecutados com permissão, passaram. TypeScript e build aprovados.
