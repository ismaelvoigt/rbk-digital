# Autorizações: pesquisa, seleção e PDF

Desenho aprovado pelo usuário em 02/11/2026: 20 autorizações por página; filtros dia/período/mês; seleção acumulada através de pesquisas e páginas; PDF da pesquisa inteira ou da seleção contendo listagem e documentos. Dividir em partes numeradas quando houver muitos documentos. Desenvolver para aprovação antes de produção.

Reutilizar o renderizador de documentos existente; compartilhar pesquisa/resultados entre farmácia e gestor. Preservar acesso por farm_id e RLS, inclusive no plano Armazenamento. Seleção identificada por UUID, sem duplicatas, em memória durante a consulta; limpar seleção é uma ação independente de limpar filtros. A seleção não atravessa troca de farmácia ou sessão. Não armazenar CPFs ou documentos no navegador.

Relatório em partes: cada parte começa com listagem e total das autorizações nela incluídas, seguida das cópias visuais dos documentos. Até 20 autorizações por parte, com divisão adicional pelos limites de memória/páginas existentes. Autorizações sem documentos continuam na listagem, identificadas. Erros de acesso ou download interrompem a geração; nunca omitir falhas silenciosamente. Partes já geradas ficam disponíveis para baixar individualmente, inclusive após uma falha posterior. Download só após sucesso da parte.

Alternativas rejeitadas: acumular todos os resultados automaticamente dificultaria escolher os CPFs desejados; limitar relatório à página visível perderia resultados; um PDF ilimitado pode exceder memória. Adotar seleção explícita, relatório completo paginado no banco e PDFs em partes.
