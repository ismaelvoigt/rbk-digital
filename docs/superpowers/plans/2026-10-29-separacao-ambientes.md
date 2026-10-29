# Separação de ambientes RBK Digital

Objetivo aprovado: um repositório, develop para desenvolvimento remoto e main para produção; projetos Vercel e Supabase distintos. Não alterar credenciais, dados ou publicação de produção.

- [x] Criar banco de desenvolvimento vazio, copiar estrutura e configurar permissões com RLS, sem acesso anônimo.
- [x] Criar projeto Vercel rbk-digital-testes e conectar ao repositório existente.
- [ ] Fixar develop como branch do projeto de testes e configurar somente credenciais do Supabase ympeqcycjadvvumanmwm.
- [ ] Escrever testes de isolamento e de destinos de convite. Comprovar falha antes da implementação.
- [ ] Centralizar origem pública dos convites; rejeitar configuração de desenvolvimento apontando para produção; exibir identificação de desenvolvimento.
- [ ] Documentar configuração local, arquivo privado ausente, pendências de autenticação/SMTP e operação por branches.
- [ ] Executar testes, tipos e build. Publicar alterações somente em branch de preparação; não integrar main.
- [ ] Validar implantação remota após configuração segura da chave administrativa de desenvolvimento.

A referência de banco de produção é sqamrlckyuesfmibxizy; ela nunca deve ser utilizada no projeto de testes. Credenciais administrativas não são versionadas. Dados de farmácias e usuários não são copiados. O arquivo private/ficha-template.xlsx não está no Git: três testes de planilha falham no baseline por sua ausência (542 testes passaram, 4 ignorados).
