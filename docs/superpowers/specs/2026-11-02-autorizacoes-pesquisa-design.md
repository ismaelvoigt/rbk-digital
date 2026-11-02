# Autorizações: pesquisa, seleção e PDF

Desenho aprovado pelo usuário em 02/11/2026: 20 autorizações por página; filtros dia/período/mês; seleção acumulada através de pesquisas e páginas; PDF da pesquisa inteira ou da seleção contendo listagem e documentos. Dividir em partes numeradas quando houver muitos documentos. Desenvolver para aprovação antes de produção.

Reutilizar o renderizador de documentos existente; compartilhar pesquisa/resultados entre farmácia e gestor. Preservar acesso por farm_id e RLS, inclusive no plano Armazenamento. Seleção identificada por UUID, sem duplicatas, em memória durante a consulta; limpar seleção é uma ação independente de limpar filtros. A seleção não atravessa troca de farmácia ou sessão. Não armazenar CPFs ou documentos no navegador.

Relatório em partes: cada parte começa com listagem e total das autorizações nela incluídas, seguida das cópias visuais dos documentos. Até 20 autorizações por parte, com divisão adicional pelos limites de memória/páginas existentes. Autorizações sem documentos continuam na listagem, identificadas. Erros de acesso ou download interrompem a geração; nunca omitir falhas silenciosamente. Partes já geradas ficam disponíveis para baixar individualmente, inclusive após uma falha posterior. Download só após sucesso da parte.

Alternativas rejeitadas: acumular todos os resultados automaticamente dificultaria escolher os CPFs desejados; limitar relatório à página visível perderia resultados; um PDF ilimitado pode exceder memória. Adotar seleção explícita, relatório completo paginado no banco e PDFs em partes.

## Restrição de perfis confirmada pelo usuário

Seleção acumulada, filtros rápidos dia/mês e relatórios são exclusivos de gestor/superadmin RBK, gerente_farmacia e administrador_farmacia (incluindo legado farmacia). Atendente mantém consulta enxuta CPF/número/datas e conferência de documentos; a paginação continua em 20 para limitar o carregamento. O papel é validado novamente nos serviços de relatório, e uma mudança de papel exige atualizar o contexto. A conta fictícia de atendente não é promovida; os dados de teste da mesma farmácia podem ser consultados pelo gestor RBK.
