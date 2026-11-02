# Auditoria sem quarentena

Solicitação explícita: retirar espera pela quarentena e ação Download seguro da auditoria. Disponibilizar Baixar para arquivos com recebimento confirmado, independentemente do estado do scanner. Preservar arquivos, metadados, autenticação e autorização por auditoria. A verificação em segundo plano não bloqueará o acesso do gestor. Escopo: auditorias, incluindo ofícios; credenciamento permanece independente.

- [x] Testes de interface e SQL observados falhando antes da correção.
- [x] Retirar bloqueio visual e condição de scan no banco, sem alterar histórico ou arquivos.
- [x] Testes, TypeScript, build e revisão independente.
- [ ] Disponibilizar no desenvolvimento para teste.

Validação: 661 testes aprovados, 3 falhas preexistentes por modelo privado de planilha ausente, 4 ignorados. TypeScript, lint e build webpack aprovados. Revisão independente: 17 testes focados aprovados, sem bloqueios. Migration aplicada no desenvolvimento sem alterar arquivos ou estados do scanner.
