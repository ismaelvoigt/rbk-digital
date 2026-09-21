# Processos — Credenciamento PFPB

Escopo autorizado pelo pedido de 18/09/2026. Subsistema interno; sem área do cliente.

Arquitetura: integrar ao Next.js atual, preservar login e RBAC; APIs autenticadas com token e consulta de perfil ativo. Dados separados em tabelas pfpb_*, arquivos em bucket privado exclusivo, acesso por responsável Gestor/criador ou Superadmin confirmado em rbk_admins. RLS e funções transacionais protegem decisões e histórico. Sem alteração de tabelas operacionais antigas.

1. Testar regras antes de implementá-las: ausência, extração insuficiente, divergência, validade, nenhuma substituição automática, revisão obsoleta após novo upload, acesso.
2. Mapear 45 campos reais; conservar B37 como ambiguidade explicitamente revisada. Original privado nunca vai ao bundle. Gerador substitui todos os valores de entrada, remove strings antigas e hyperlinks pessoais e mantém outras partes OOXML. Não adicionar sócios além dos quatro blocos.
3. Migration aditiva separada: processos, versões de documentos, análises, decisões e eventos. Funções verificam auth.uid/perfil ativo e criador. Aprovação e formação transacionais; análise não pode aprovar. Revogar escrita direta no audit log. Testar em PostgreSQL local embutido com papéis sintéticos.
4. APIs e UI: lista e cinco abas. Novo processo a partir de CNPJ/razão social da ficha. Upload privado, sem sobrescrita, limite 20MB; histórico imutável. Download por proxy autenticado sem URL pública. Formar pacote somente após revisão humana de todas as versões atuais.
5. Extração: texto de PDF e OCR local opcional em macOS via Vision. Não consultar QR/códigos/selos. Evidências com página; não registrar texto integral em logs. Falha/ausência de OCR exige conferência. IA externa desativada.
6. Validar regressões, tipos, build, políticas SQL e documentos reais localmente; registrar falsos positivos/negativos e limites. Preview autenticado depende de staging isolado; nunca ligar novo módulo à produção para testar.

Pendências identificadas: banco remoto ainda sem novos perfis; migrations locais de monitoramento não aplicadas. Não aplicar essas migrations como efeito colateral. Fonte XLSX tem preenchimento prévio e ambiguidades B37/B38/B39; exigir revisão explícita para exportação. PDFs reais são digitalizações sem texto.
