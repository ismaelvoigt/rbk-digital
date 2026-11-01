# Conferência de cupons por perfil

Pedido: painel Itens dos cupons • Vendas e Indicadores somente para gerente e gestor da farmácia, oculto para atendente/balconista.

Implementação: reutilizar usePerfilAtual na página documental; não montar ConferenciaCupons enquanto perfil é desconhecido ou operador. Perfil já resolvido é repassado ao cabeçalho, evitando uma nova resolução redundante. Demais perfis reconhecidos conservam a interface anterior. Sem alteração em upload, leitura automática, acesso aos documentos, confirmação de armazenamento, APIs ou RLS.

Teste RED/GREEN no componente real da página e painel: operador não exibe nem consulta cupom_extracoes; gerente_farmacia, administrador_farmacia e legado farmacia mantêm painel e consultas. Documentos e Confirmar continuam visíveis. Teste de nova tentativa contabiliza a consulta de sessão da resolução de perfil sem confundir com a repetição da consulta documental.
