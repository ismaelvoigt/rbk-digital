# Desenvolvimento compartilhado — RBK Digital

## Ambientes

| Recurso | Desenvolvimento | Produção |
|---|---|---|
| Repositório | ismaelvoigt/rbk-digital | mesmo repositório |
| Branch compartilhada | develop | main |
| Vercel | rbk-digital-testes (prj_RZi39iUZqcywEt1JGmmD7KvMrHlQ) | rbk-digital |
| Endereço reservado | https://rbk-digital-testes.vercel.app | https://rbk-digital.vercel.app |
| Supabase | ympeqcycjadvvumanmwm | sqamrlckyuesfmibxizy |

O projeto de testes usa o ambiente padrão chamado Production pela Vercel para servir seu endereço estável; ele continua sendo exclusivamente DESENVOLVIMENTO. Production na interface da Vercel não identifica o banco: confira sempre o nome do projeto e a referência Supabase.

## Começar no próprio computador

1. Usar Node.js 24 e acesso individual ao GitHub.
2. Clonar o repositório e escolher a branch compartilhada de desenvolvimento:

```sh
git clone https://github.com/ismaelvoigt/rbk-digital.git
cd rbk-digital
git switch develop
npm ci
cp .env.development.example .env.local
```

3. Preencher NEXT_PUBLIC_SUPABASE_ANON_KEY com a chave publishable do projeto de desenvolvimento. Para funções de servidor, configurar SUPABASE_SERVICE_ROLE_KEY do mesmo projeto por canal privado. Nenhuma chave de produção é necessária para desenvolver.
4. Manter RBK_PUBLIC_ORIGIN=http://localhost:3000 na máquina e usar o endereço de testes na Vercel. Não expor service_role em variáveis NEXT_PUBLIC_.
5. Executar `npm run dev`; a faixa amarela identifica o desenvolvimento. Atualizar a URL para banco de produção deve impedir a inicialização.
6. Criar uma branch própria para cada tarefa e abrir PR para develop. Não integrar main nem modificar credenciais de produção durante o desenvolvimento.

## Banco e migrações

O banco foi inicializado com uma cópia SOMENTE estrutural, sem usuários, farmácias, documentos, catálogos ou arquivos reais. As tabelas têm RLS e não permitem operações anônimas. SMTP, contas de teste e catálogos de periodicidades ainda precisam de preparação própria.

O histórico legado em supabase/migrations não recria sozinho o estado atual. Os arquivos desenvolvimento-estrutura-restrita.sql, desenvolvimento-permissoes-rls.sql e desenvolvimento-schema-usage.sql registram o baseline aplicado no projeto NOVO e não devem ser executados novamente nele nem em produção. Não fazer db push/reset no banco remoto como atalho.

Mudanças novas devem ser migrations revisadas e direcionadas explicitamente ao projeto de desenvolvimento. Testes live ficam desligados por padrão, pois criam/excluem usuários e registros. Não executar contra produção.

## Validação

```sh
npx vitest run
npx tsc --noEmit
npm run build
```

Baseline conhecido: tests/pfpb-workbook.test.ts depende de private/ficha-template.xlsx, que não está no Git; os três testes falham em uma cópia limpa. Não copiar um arquivo com dados reais para fazê-los passar. Preparar um template sanitizado é uma pendência separada.

## Limitações e publicação

- A conexão Supabase do conector não é compartilhada automaticamente com a Vercel.
- A chave administrativa de desenvolvimento já foi adicionada diretamente à Vercel como Secret nos três ambientes. O valor não foi exposto no chat nem incluído no código.
- Convites por email dependem de SMTP dedicado; não reutilizar SMTP de produção sem decisão explícita.
- O portal externo de credenciamento possui integração legada separada e permanece fora desta liberação.
- Por autorização do responsável, novas prévias do projeto original rbk-digital estão desativadas. As prévias antigas foram mantidas e podem continuar usando produção: não utilizá-las para testes com escrita. Novas prévias devem ser abertas somente no projeto rbk-digital-testes. A main do projeto original continua responsável pela publicação de produção.
- Esta preparação não publica nem migra produção. O deploy de testes só deve ocorrer após conferir branch, referência do banco e segredo de desenvolvimento.

## Verificação desta preparação (29/10/2026)

- 552 testes passaram; 4 testes live ignorados (execução com dois workers).
- 3 falhas conhecidas em tests/pfpb-workbook.test.ts por falta de private/ficha-template.xlsx.
- TypeScript sem erros.
- Build com Webpack aprovado. O build padrão com Turbopack foi impedido pelo sandbox local ao abrir porta interna; não foi classificado como aprovado.
- Publicação inicial READY: dpl_GeX4RhJeFkxg5i4hFiJ5MtKPjF3o, código f15616e, https://rbk-digital-testes.vercel.app.
- Página inicial HTTP 200 e faixa de desenvolvimento confirmadas. JavaScript carregado aponta somente para ympeqcycjadvvumanmwm.supabase.co.
- Login com conta fictícia inexistente foi recusado pelo Supabase. Não foram criadas contas nem copiados dados. Login válido e fluxos internos ainda dependem de contas de teste.
- A publicação inicial foi direta do computador. A preparação é integrada somente em develop, preservando as alterações recentes do Gabriel e sem alterar a main. A publicação automática do Git deve ser validada após a integração.
- USAGE nos schemas privados foi completado somente no banco de desenvolvimento; testes confirmam RPCs funcionais, validação de perfil e bloqueio de anon/tabelas privadas.
- Não configurar tokens, service_role ou arquivos .env no GitHub. Segredos individuais permanecem fora do controle de versão.
