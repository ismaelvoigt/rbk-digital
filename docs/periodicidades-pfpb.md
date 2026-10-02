# Periodicidades PFPB — projeto de atualização

Escopo autorizado: regras versionadas por item, EAN, previsões, aviso D-2, compras, histórico, isolamento e publicação. Inclui ícone de três pessoas no cartão Equipe.

## Decisões
- Tabelas globais de regras e produtos oficiais sem escrita por usuários. Versões com vigência, revisão, fonte e status; sem intervalo genérico por indicação.
- Resolver EAN exato validado; na falta de EAN, apenas identidade estruturada completa (princípio, concentração, apresentação, indicação, tipo). Não interpretar nome comercial livre.
- Salvar versão e cópia da regra na previsão. Mudanças no catálogo não recalculam registros existentes. Correções na fonte invalidam a previsão e exigem revisão.
- Registro manual mantém justificativa e responsável. Itens sem correspondência, com divergência ou regra não comprovada ficam não calculados.
- Aviso interno a partir de próxima_data menos 2 dias, com foco explícito no D-2; demanda de compras lê as mesmas previsões armazenadas.
- Primeira versão operacional válida para dispensações a partir de 2026-09-27 (adoção no RBK, não data de criação da norma). Registros anteriores sem evidência temporal ficam para revisão manual.
- Dapagliflozina: cadastro com proposta de 30 dias inativa, não inferir periodicidade da presença no elenco.
- Base original contém alterações não commitadas de diversas entregas. Cópia isolada preserva todas; incorporar apenas o delta desta tarefa após testar.

## Plano de execução
1. Conferir manual PFPB item 8, Portaria 12.091/2026 art. 30, serviço Dignidade Menstrual e catálogo EAN junho/2026. Registrar fontes e limitações.
2. Integrar módulo previamente homologado à cópia da base atual. Escrever testes reais PostgreSQL para 10/25/30/56/80/90 dias, desconhecido, ambíguo, vigência, versionamento, histórico, D-2 e isolamento.
3. Implementar tabelas, resolvedor e snapshots sem fallback; cadastrar catálogo e regras verificadas. Criar testes da carga contra as fontes.
4. Exibir origem/regra/alerta na tela, usar previsões no planejamento e acrescentar SVG de três pessoas em Equipe.
5. Executar suíte, compilação, revisão independente, verificação visual e testes remotos com dados temporários. Aplicar migrações aditivas e publicar via Vercel com promoção após validação.

## Riscos a testar
EAN conflitante, ausência de apresentação contraceptiva, vigência passada, alteração de regra já utilizada, chamadas com farmacia_id de outro CNPJ e permissão insuficiente.
