# Confirmação documental e retomada em desenvolvimento

**Objetivo:** aplicar o plano de correção solicitado após o diagnóstico, somente em develop/rbk-digital-testes.
**Arquitetura:** manter os serviços existentes e RLS; confirmar resposta de armazenamento e vínculo por documento; identificadores estáveis permitem nova tentativa sem criar outra autorização. Upload com concorrência de dois arquivos e leitura de cupons após a confirmação. Nenhuma migração nesta etapa.
**Decisões:** retomada na mesma página preserva arquivos em memória; fechar/recarregar avisa sobre perda dos pendentes. Não persistir imagens/CPF em armazenamento local. Dados do cadastro ficam bloqueados após iniciar para evitar inconsistência ao retomar. Não remover arquivos quando uma resposta de gravação é ambígua.
**Escopo de desempenho:** liberar navegação do painel antes dos indicadores, paginar histórico sem truncar contagens e buscar URL de anexo apenas ao visualizar; manter validação de sessão e autorização.

- [x] Testes comportamentais de confirmação, resposta perdida, falha parcial, concorrência e sucesso acessado diretamente (RED).
- [x] Serviço de envio com identificadores estáveis, confirmação de tamanho no Storage, vínculo confirmado e retomada; integrar cadastro e estados por arquivo.
- [x] Corrigir sucesso independente e substituição; obter URLs de anexos sob demanda.
- [x] Liberar shell/cards do painel e tratar falhas sem indicadores falsos; paginar consultas.
- [x] Executar testes completos, TypeScript e build; revisar mudanças e registrar roteiro manual para Gabriel.
- [ ] Abrir PR para develop e disponibilizar somente no projeto de testes, verificando banco e ambiente.

## Registro
- Base: origin/develop c0ab641, incluindo alterações do Gabriel.
- Duplicatas não rastreadas preexistentes preservadas; nenhuma alteração em main.
- Baseline conhecido: 3 testes pfpb-workbook falham por private/ficha-template.xlsx ausente; testes live permanecem desligados.

## Validação e revisão
- 19 testes novos de comportamento aprovados; suíte completa: 589 aprovados, 4 live ignorados e as 3 falhas conhecidas do template ausente em tests/pfpb-workbook.test.ts.
- TypeScript sem erros; build Webpack aprovado com o ambiente isolado; lint dos arquivos de produção tocados sem erros (8 avisos legados).
- Revisão independente encontrou duas falhas corrigidas: preservação do ID quando o readback do próprio cadastro falha e bloqueio dos campos durante consulta da sessão. Revisão final sem achados importantes.
- Estados usados para render ficam no state; refs retêm somente tentativa e trava de reentrada.
- Leitor de QR Code passou a importação dinâmica. Manifesto do build confirma 375.240 bytes brutos de chunks fora dos scripts iniciais de nova-autorizacao. Isso não é medição de latência no balcão.
- Testes estruturais antigos que exigiam tela de carregamento integral/duplicavam busca literal da mensagem foram substituídos por teste de interação; teste de logo agora inspeciona ancestral JSX e evita falso positivo entre retornos diferentes.
- Sem migrações ou acesso de escrita a bancos remotos; arquivos duplicados preexistentes preservados.
- Publicação de testes bloqueada: conector não encontra prj_RZi39iUZqcywEt1JGmmD7KvMrHlQ na equipe conhecida; listagem mostra somente rbk-digital. CLI local falha ao renovar autenticação expirada. Não criar outro projeto nem publicar no original como alternativa.
