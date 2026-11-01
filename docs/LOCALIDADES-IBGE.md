# UF e cidade nos cadastros

Cadastro e edição da farmácia usam o mesmo seletor: UF primeiro, cidade abaixo. Trocar a UF limpa a cidade. Respostas atrasadas não substituem a lista da UF atual. Falhas permitem nova tentativa, preservando valores já cadastrados.

Fonte: API de Localidades do IBGE, https://servicodados.ibge.gov.br/api/docs/localidades.
Extração em 01/11/2026: 27 UFs e 5.571 municípios. Para cada UF foi consultado `/api/v1/localidades/estados/{UF}/municipios?orderBy=nome`, verificando prefixo do código IBGE e nomes não vazios.

As UFs estão em `src/lib/cadastro/ufs.ts`; as cidades, em `public/localidades/municipios-v1/{UF}.json`. O navegador baixa somente o pequeno arquivo da UF selecionada pelo próprio domínio do app, sem consulta externa ao IBGE durante o cadastro. Ao atualizar a base, use uma nova versão de diretório e atualize o caminho no componente para invalidar o cache anterior.

Valores antigos fora da lista continuam visíveis como cadastrados e não são apagados automaticamente. Novas escolhas usam apenas as opções oferecidas. Nenhuma migração de banco ou alteração de produção é necessária.
