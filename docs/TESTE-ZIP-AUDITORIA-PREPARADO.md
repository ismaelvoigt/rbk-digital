# ZIP de auditoria preparado — desenvolvimento

Disponível somente no banco e projeto de desenvolvimento. Nenhuma migração foi aplicada à produção.

## Teste com a conta do gestor RBK

Acesse `/processos/auditorias/exportacoes/a0285013-6073-4a11-87eb-7bd8da3fe601` no desenvolvimento.
Essa auditoria contém 40 PDFs fictícios (cerca de 16 MB), com indicação SEM VALIDADE, sem dados de pacientes. O gerador de fixture `supabase/functions/auditoria-zip-demo` exige JWT validado, conta ativa em rbk_admins e URL fixa do projeto de desenvolvimento.

1. Clique em Baixar todos os lotes. A tela deve mostrar preparação e depois validação.
2. O download não deve aparecer antes do estado pronto.
3. Feche a página durante a preparação e volte pelo mesmo link. Clique novamente: o trabalho já iniciado será reaproveitado.
4. Baixe o ZIP pronto, extraia e confira 40 PDFs na pasta Lote 001.
5. Uma conta de atendente não pode preparar/baixar esse arquivo de auditoria.
6. Sem sessão válida, o endpoint recusa; alterações de perfil/vínculo e exclusão da auditoria são reavaliadas durante o processamento e no download.

O módulo antigo de auditoria estava desabilitado no projeto de desenvolvimento; a página acima valida o novo fluxo sem alterar essa configuração nem habilitar envios de convites.

## Funcionamento

Cada etapa processa no máximo 16 arquivos e um orçamento curto de tempo; buffers ainda pequenos ficam no Storage privado até atingir o tamanho de uma parte S3. Progresso fica no Postgres. Workflow retoma sem depender da aba aberta. O ZIP64 não comprime novamente os PDFs. Tamanho e SHA256 de cada original são conferidos; cada parte armazenada é relida por Range e comparada ao SHA256 antes da liberação. O download nativo sai direto do Storage, fora da função de cinco minutos.

Arquivo temporário expira 24 horas após o pedido. Link assinado vale até 60 segundos; os bytes não passam pela função Vercel. A limpeza do workflow remove apenas o prefixo privado do job e limpa nomes/checksums temporários do banco. O bucket não é público e não há leitura direta por anon/authenticated. Consultas do worker rodam com a permissão atual do solicitante.

Limites iniciais: ZIP final até 50 GiB e 10 mil documentos (limite global do Storage também deve permitir esse tamanho). Até dois trabalhos em preparação simultânea por solicitante, sob trava no banco. Grupo multipart >=8 MiB, exceto último; cada checkpoint é limitado separadamente. A interface de produção conserva o fluxo atual até aprovação/publicação específica.

## Validação técnica

Testes de extração ZIP64 com acentos, CRC, offsets acima de 4 GiB; interrupção entre persistência de parte e checkpoint; repetição da liberação final; corrupção de origem e destino; expiração, autorização e bloqueio de download prematuro. Teste sintético opcional `RBK_EXPORT_STRESS=1` processou e validou 130 documentos de 32 MiB (>4 GiB), sem reter o ZIP completo em memória (RSS <1 GiB).

Os testes amplos ainda têm quatro falhas anteriores à alteração: três por ausência do arquivo privado `private/ficha-template.xlsx` e uma checagem antiga do cabeçalho de nova autorização alterado em desenvolvimento por outro trabalho.
