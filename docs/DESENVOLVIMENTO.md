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
2. Clonar o repositório e escolher a branch de preparação enquanto este trabalho não for integrado em develop:

```sh
git clone https://github.com/ismaelvoigt/rbk-digital.git
cd rbk-digital
git switch chore/separacao-ambientes
npm ci
cp .env.development.example .env.local
```

3. Preencher NEXT_PUBLIC_SUPABASE_ANON_KEY com a chave publishable do projeto de desenvolvimento. Para funções de servidor, configurar SUPABASE_SERVICE_ROLE_KEY do mesmo projeto por canal privado. Nenhuma chave de produção é necessária para desenvolver.
4. Manter RBK_PUBLIC_ORIGIN=http://localhost:3000 na máquina e usar o endereço de testes na Vercel. Não expor service_role em variáveis NEXT_PUBLIC_.
5. Executar `npm run dev`; a faixa amarela identifica o desenvolvimento. Atualizar a URL para banco de produção deve impedir a inicialização.
6. Criar uma branch própria para cada tarefa e abrir PR para develop. Não integrar main nem modificar credenciais de produção durante o desenvolvimento.

## Banco e migrações

O banco foi inicializado com uma cópia SOMENTE estrutural, sem usuários, farmácias, documentos, catálogos ou arquivos reais. As tabelas têm RLS e não permitem operações anônimas. SMTP, contas de teste e catálogos de periodicidades ainda precisam de preparação própria.

O histórico legado em supabase/migrations não recria sozinho o estado atual. Os arquivos desenvolvimento-estrutura-restrita.sql e desenvolvimento-permissoes-rls.sql registram o baseline aplicado no projeto NOVO e não devem ser executados novamente nele nem em produção. Não fazer db push/reset no banco remoto como atalho.

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
- A chave administrativa de desenvolvimento precisa ser adicionada diretamente à Vercel como Secret.
- Convites por email dependem de SMTP dedicado; não reutilizar SMTP de produção sem decisão explícita.
- O portal externo de credenciamento possui integração legada separada e permanece fora desta liberação.
- Os previews do projeto original rbk-digital ainda precisam ser desativados/restringidos antes de liberar o fluxo automático de novas branches: as definições antigas de preview abrangem o banco de produção.
- Esta preparação não publica nem migra produção. O deploy de testes só deve ocorrer após conferir branch, referência do banco e segredo de desenvolvimento.

## Verificação desta preparação (29/10/2026)

- 551 testes passaram; 4 testes live ignorados.
- 3 falhas conhecidas em tests/pfpb-workbook.test.ts por falta de private/ficha-template.xlsx.
- TypeScript sem erros.
- Build com Webpack aprovado. O build padrão com Turbopack foi impedido pelo sandbox local ao abrir porta interna; não foi classificado como aprovado.
- Nenhum deploy do aplicativo realizado nesta preparação.
