# Teste do fluxo do balcão — Gabriel

Esta alteração é destinada exclusivamente a **develop** e ao projeto **rbk-digital-testes**. Não integrar em main nem testar uploads em produção.

## Como executar

Usar a branch `fix/documentos-confirmacao-retomada` ou o PR correspondente. Seguir `docs/DESENVOLVIMENTO.md`, Node.js 24, banco `ympeqcycjadvvumanmwm` e usuário de teste com farmácia ativa. Usar somente fotos e PDFs fictícios, sem documentos de clientes. A configuração local recusa o banco de produção quando NEXT_PUBLIC_RBK_ENV=development.

## Casos para conferir

1. **Abrir os cards:** limitar a velocidade da rede no navegador e abrir o início. Cadastro e consulta devem aparecer antes dos indicadores, que ficam como carregando. Erro de consulta deve mostrar aviso, sem apresentar zero como resultado.
2. **Selecionar fotos:** escolher os quatro documentos obrigatórios. Cada card deve dizer “Selecionado — ainda não salvo”, sem verde de confirmação. A prévia não dispara upload no cadastro novo.
3. **Salvar:** pressionar Salvar autorização. Os campos ficam bloqueados para manter o envio consistente, dois arquivos são enviados por vez e cada card muda para “Salvo e confirmado” somente após confirmação de tamanho no armazenamento e registro retornado. A tela final aparece somente quando todos estiverem confirmados.
4. **Interromper a rede:** durante o envio, desconectar e depois reconectar. Clicar Tentar novamente. Deve existir uma só autorização; documentos confirmados não são reenviados. O arquivo enviado cuja resposta se perdeu é reconhecido pelo caminho estável. Não fechar nem recarregar a página durante este teste.
5. **Número já existente:** tentar cadastrar outro registro com um número já usado. Deve informar duplicidade e permitir corrigir o número. Uma resposta perdida da própria tentativa não deve ser tratada como um novo cadastro duplicado.
6. **Leitura de cupons:** atrasar a resposta de `/api/cupons/processar`. O armazenamento confirmado deve permitir a conclusão sem esperar essa leitura. Na autorização, acompanhar ou repetir a leitura se necessário.
7. **Acesso direto ao sucesso:** abrir `/autorizacoes/ID/documentos/sucesso` com uma autorização fictícia sem documentos. Não deve mostrar “Documento enviado com sucesso”. Conferir também uma autorização com registro cujo objeto não existe.
8. **Substituir:** selecionar outro arquivo e confirmar. O anterior só é removido depois de confirmar a atualização para o novo. Simular falha e repetir; não deve trocar o arquivo ativo quando a atualização não retornar/confirmar a linha correta. Clique repetido não deve iniciar duas substituições.
9. **Abrir anexo:** a listagem deve carregar sem esperar URLs assinadas. Ao pressionar Visualizar, deve abrir o anexo; uma falha deve mostrar aviso em vez de uma janela vazia.
10. **Sair/recarregar:** com fotos selecionadas ou envio incompleto, recarregar ou usar Início deve avisar sobre pendências. Arquivos pendentes não são persistidos no navegador e a retomada desta etapa vale para a mesma tela aberta.

## Medição no navegador

Com o mesmo aparelho, arquivos e perfil de rede, repetir cada cenário cinco vezes. Registrar mediana e maior duração para clique → tela utilizável, escolha de foto → prévia, Salvar → primeiro confirmado e Salvar → todos confirmados. Na aba Rede, distinguir Storage, registros no banco e fila de cupons. Não anexar dados de clientes, tokens ou cabeçalhos de autenticação aos resultados.

## Verificação automatizada

- `npx vitest run --maxWorkers=2` (testes live desligados por padrão).
- `npx tsc --noEmit --incremental false`.
- `npx next build --webpack`.

Baseline conhecido: três falhas em `tests/pfpb-workbook.test.ts` porque `private/ficha-template.xlsx` não faz parte do repositório. Não utilizar planilha com dados reais para suprir esse arquivo.

## Limites desta etapa

Sem migração de banco e sem persistência local de imagens. A fila de leitura não condiciona a confirmação do armazenamento. Se a aba for encerrada, os arquivos pendentes precisam ser selecionados novamente; esta alteração não implementa uma fila offline persistente. Agregação dos indicadores no servidor permanece como melhoria futura; o painel agora consulta páginas e libera a navegação antes delas.

## Atualização de desempenho

O envio mantém no máximo dois uploads simultâneos, permitindo a confirmação de arquivos anteriores enquanto os próximos são enviados (até quatro documentos em processamento total). A tela documental consulta autorização e anexos em paralelo após validar a sessão. Em falha, oferece Tentar novamente; durante a espera, mantém um link de retorno. O teclado numérico também foi habilitado no número da autorização do cadastro novo.

## Cadastro compacto sem CRM

O cadastro de nova autorização usa CPF e número da autorização, sem pedir CRM/UF. Ao selecionar foto ou PDF, o card recolhe e mostra o nome do arquivo; Conferir abre a prévia, Substituir abre a galeria e Recolher mantém a seleção. Em Outros Documentos, conferir abre a lista e permite remover; Adicionar arquivos mantém os anteriores. O resumo acompanha quatro categorias obrigatórias; opcionais aparecem separados. Antes de salvar, o progresso significa selecionado, não armazenado. No envio, passa a indicar somente os arquivos confirmados.

## Interface por perfil

Atendente/operador: no início aparecem os acessos de cadastro e consulta; Próximas Dispensações e Pendências não aparecem nem fazem a consulta do card de próximas. A busca de páginas e Ctrl+K ficam desativados em todo cabeçalho. No cadastro, retiradas as orientações introdutórias indicadas pelo responsável; progresso e estados de confirmação/erro continuam visíveis.

Gerente e administrador da farmácia (incluindo perfil legado farmacia): próximos, pendências, pesquisa e orientações continuam disponíveis. A precedência de rbk_admins na busca é preservada. Esta etapa não revoga acesso a rotas nem altera permissões de dados.

Na tela de documentos, o painel “Itens dos cupons • Vendas e Indicadores” só é montado após validar um perfil diferente de operador. Atendente não vê o painel, seus botões ou o link de Vendas, e não inicia as consultas/polling desse componente. Gerente, administrador da farmácia e perfil legado farmacia conservam a conferência. A leitura automática após envio permanece independente e não foi alterada; documentos e botão Confirmar continuam no fluxo do atendente.
