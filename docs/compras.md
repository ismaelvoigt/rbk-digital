# Planejamento de Compras
Rota /compras. Card nos dashboards /farmacia e /dashboard. Perfil e sessão existentes, consulta sob RLS; estoque da farmácia vinculada ao usuário.

## Critérios
- Data da autorização, período inclusivo, somente itens confirmados. Consultas de compras limitadas explicitamente às autorizações cadastradas pelo usuário, mesmo se houver RLS administrativo mais amplo. Não é um consolidado de todos os operadores nem de todas as vendas da farmácia.
- EAN/GTIN de 8/12/13/14 dígitos normalizado para 14; cruzamento exige mesma unidade (maiúsculas). Não converte caixas/comprimidos nem concilia por nome. Estoques e itens sem EAN ficam visíveis sem associação automática.
- Média diária: consumo confirmado / dias corridos. Mensal: diária × 30. Projeções: diária × 30/60/90. Estoque é o saldo da posição importada, sem baixa automática.
- Cobertura: saldo / média diária, somente média positiva e unidade conhecida. Reposição: teto(max(0, diária × horizonte − saldo)). Sem estoque, sem unidade compatível ou consumo incompleto/pendente no grupo: cobertura/reposição indisponíveis.
- Produtos apenas no estoque não recebem consumo zero presumido. Zero declarado na fonte continua sendo zero. Lacunas de autorizações e pendências da base são informadas.
- Alertas padrão: risco até 7 dias e baixo estoque até 15 dias; selecionáveis. Projeção não ajusta sazonalidade e não inclui outras vendas.

## Importação e persistência
XLSX/CSV, até 5 MB, 20 mil produtos, 100 colunas. XLSX descompactado até 30 MB/500 entradas/20 abas. Seleção de aba, linha de cabeçalho, mapeamento de EAN/produto/quantidade/unidade, unidade fixa opcional, formato numérico explícito. CSV padrão brasileiro; XLSX numérico padrão decimal canônico. Prévia, lista de erros, EAN científico rejeitado, fórmulas não avaliadas, duplicidade EAN+unidade rejeitada. Importação inteira precisa estar válida.

Estoque JSON em snapshot por farm_id, gravado pela RPC compras_importar com validação no banco e controle de versão. Uma nova posição substitui integralmente a anterior; produtos ausentes não recebem saldo zero. Leitura exige acesso autorizado à farmácia ativa. Escrita exige permissão correspondente. Sem acesso anônimo nem escrita direta na tabela. Data da posição e arquivo exibidos no painel.

## Exportação
Todos os produtos do período, sem limitar à página da tabela. XLSX com Planejamento e Critérios; CSV com metadados por linha. EAN textual e proteção de fórmulas; valores ausentes ficam vazios. Indicadores e gráficos por unidade, tabela com todas as unidades.

## Publicação
Esquemas aditivos vendas-schema.sql e compras-schema.sql aplicados no projeto rbk-digital. Não executar todas as migrações históricas. A tarefa separada de OCR/conferência de cupons não faz parte deste módulo; sem itens confirmados, o painel informa ausência de dados.

## Verificação após publicação — 26/09/2026
Deployment dpl_8aeDYa1YWybyxMVnhTnYQ54GfMfx promovido para https://rbk-digital.vercel.app/compras. Navegador autenticado validou carregamento, estado sem estoque/itens confirmados, card de gestão e retorno. Não foram importados dados de teste na produção. Fluxo com dados fictícios validado localmente em desktop e 390 px, incluindo importações CSV/XLSX e arquivos exportados realmente baixados.
