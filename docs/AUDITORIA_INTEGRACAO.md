# Instalação restrita a homologação

Este pacote é uma alteração sobre a base local RBK Digital que já contém o RBAC e Processos/Credenciamento. Não é um aplicativo independente e não altera produção.

1. Revisar o relatório entregue e os arquivos modificados. Preservar alterações posteriores da base.
2. Criar Supabase staging separado após confirmação do custo. Não importar documentos reais.
3. Homologar primeiro `20260918152400_rbac_auditoria_base.sql` e demais dependências do RBK previstas no projeto, após revisar cada migration; não rodar toda a pasta cegamente. O portal depende especificamente de `rbk_private.actor_role()`, `rbk_private.can_access_farm(uuid)` e vínculos de Gestor.
4. Aplicar **somente** a migration nova `20260918231916_secure_audit_portal.sql`. `auditoria-schema.sql` é uma cópia de referência, não uma segunda migration.
5. Copiar nomes de variáveis de `.env.auditoria.example` para o gerenciador de segredos do staging. Exigir URL exata do novo projeto e flag explícita de habilitação; nunca incluir service_role em NEXT_PUBLIC.
6. Conferir Storage global e bucket privado com 100 MiB por arquivo; configurar gateway para limitar abuso. Manter IA desativada.
7. Implantar o worker de `tools/auditoria-scan.mjs` em ambiente isolado com ClamAV e assinaturas atualizadas. Executar inicialmente manualmente; sem worker, downloads ficam em quarentena. Usar um único worker nesta versão. Não agendar IA.
8. Executar a matriz de staging do relatório. Só promover após validação e revisão dos limites de upload assinado/consumo.

## Verificação local

Instalar dependências com `npm ci`. Executar:

```
node node_modules/vitest/vitest.mjs run tests/auditoria-sql.test.ts tests/auditoria-domain.test.ts tests/auditoria-upload.test.ts tests/accessPolicy.test.ts tests/auth-routing.test.ts tests/rbac.test.ts tests/pfpb-sql.test.ts
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Os testes SQL usam PostgreSQL via PGlite e fixtures sintéticas. Os testes TUS usam um servidor HTTP local temporário. Nenhuma credencial real é necessária para eles. O build pode exigir as variáveis públicas que o aplicativo existente usa; usar valores sintéticos/localmente e não habilitar o portal sem staging.

A demonstração em `work/ui-preview` não está neste pacote e não deve ser implantada. Ela substitui as APIs por fixtures e deixa claro que não possui autenticação ou armazenamento real.
