# Integração em staging — não aplicar em produção

O ZIP contém um overlay `arquivos/` de novos arquivos e `integracao.patch` para os cinco arquivos existentes. A implementação completa está na cópia local desta tarefa em `work/rbk-digital`. O projeto original não foi editado.

1. Faça uma cópia/branch da versão atual do RBK Digital. Confira `base-sha256.json`; se um arquivo-base mudou, reconcilie o patch manualmente.
2. Inspecione `git apply --check integracao.patch`; aplique o patch nessa cópia e copie o conteúdo de `arquivos/` para a raiz. Nunca sobrescreva o diretório inteiro do app original.
3. Instale as dependências com o lockfile. O OCR usa Node, PDF.js, canvas nativo, Tesseract e dados locais de idioma; o processo precisa conservar os scripts `tools/extract-*.mjs` e suas dependências em disco.
4. Execute os testes específicos `node node_modules/vitest/vitest.mjs run tests/processos.test.ts tests/pfpb-*.test.ts`. O teste documental real é ignorado sem `PFPB_REAL_LOCAL_TEST=true`; os dados privados necessários não são distribuídos.
5. Em Supabase staging com as tabelas legadas de Auth/perfis, revise e aplique `supabase/pfpb-schema.sql` via uma migration gerada pela CLI. Esse arquivo ainda não é migration registrada. O schema não modifica os perfis da aplicação existente; a preparação do Gestor deve ser revisada separadamente.
6. Preencha variáveis de `.env.pfpb.example` exclusivamente com staging. `PFPB_TEMPLATE_PATH` aponta para `private/ficha-template.xlsx`, que não pode ir para `public/`.
7. `PFPB_ENABLED=true` habilita apenas staging. Há bloqueio explícito do projeto de produção inspecionado e de `VERCEL_ENV=production`. Não remover esses bloqueios sem homologação e revisão de segurança.
8. Rodar build e testes integrados Auth/Storage antes de disponibilizar um preview autenticado. O OCR síncrono atual é apropriado para teste controlado local; para Vercel verificar empacotamento dos workers/dependências nativas, limite total e considerar worker dedicado.

A demonstração de interface em localhost:3108 é separada, sintética e não faz parte deste pacote. Não constitui homologação.
