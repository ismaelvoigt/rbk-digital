export const statusLabels={a_avisar:'A avisar',avisado:'Avisado',retirado:'Retirado',nao_retirado:'Não retirado'} as const;
export type Status=keyof typeof statusLabels;
export type Modo='hoje'|'2dias'|'7dias'|'30dias'|'personalizado'|'nao_calculado'|'atrasados'|'historico'|'alertas';
export type Filtro={inicio:string|null;fim:string|null;filtro:'periodo'|'nao_calculado'|'atrasados'|'historico'|'alertas'};
export type Farmacia={id:string;nome:string;cnpj:string};
export type Contexto={gestor:boolean;pode_editar:boolean;farmacias:Farmacia[]};
export type RegraSnapshot={versao:number;periodicidade_dias:number;fonte:string;data_vigencia:string;principio_ativo?:string;concentracao?:string;apresentacao?:string};
export type Previsao={alerta_data?:string|null;regra_id?:string|null;regra_snapshot?:RegraSnapshot|null;id:string;produto:string;ean:string|null;unidade:string|null;ultima_data:string|null;proxima_data:string|null;origem:string;intervalo_dias:number|null;referencia:string|null;motivo:string;status:Status;ativa:boolean;versao:number;avisado_em:string|null;avisado_por_nome:string|null;nome:string|null;telefone:string|null;contato_versao:number;cpf_mascarado:string};
export type Resumo={alertas?:number;hoje:number;dias2:number;dias7:number;dias30:number;nao_calculado:number;atrasados:number};
export type Resultado={linhas:Previsao[];total:number;pagina:number;resumo:Resumo;hoje:string};
export type Evento={acao:string;canal:string;usuario_id:string|null;usuario_nome:string|null;criado_em:string;detalhes:Record<string,unknown>};
export type Demanda={produtos:{chave:string;produto:string;ean:string|null;unidade:string|null;retiradas:number;clientes:number;quantidade_estimada:number|null}[];nao_calculadas:number};
export type Edicao={acao:'previsao';nome:string;telefone:string;contato_versao:number;modo:'data'|'intervalo'|'nao_calculado'|'manter';data?:string;intervalo_dias?:number;referencia:string}|{acao:'status';status:Status;contato_versao?:number};
export const dataBr=(d:string|null)=>d?d.split('-').reverse().join('/'):'Não calculado';
export const horarioBr=(d:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(d));
export function hojeLocal(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function validarData(d:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw new Error('Informe uma data válida.');}
export function adicionarDias(d:string,n:number){validarData(d);const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);}
export function periodo(m:Modo,hoje=hojeLocal(),inicio='',fim=''):Filtro{
 validarData(hoje);
 if(m==='nao_calculado'||m==='atrasados'||m==='historico'||m==='alertas')return {inicio:null,fim:null,filtro:m};
 if(m==='personalizado'){validarData(inicio);validarData(fim);if(fim<inicio)throw new Error('A data final deve ser igual ou posterior à inicial.');return {inicio,fim,filtro:'periodo'};}
 if(m==='hoje')return {inicio:hoje,fim:hoje,filtro:'periodo'};
 const dias={'2dias':2,'7dias':7,'30dias':30}[m];
 return {inicio:adicionarDias(hoje,1),fim:adicionarDias(hoje,dias),filtro:'periodo'};
}
export function mensagemPadrao(nome:string,data:string,farmacia:string){return `Olá, ${nome.trim()}. Tudo bem? Sua próxima retirada de medicamentos pelo Programa Farmácia Popular está prevista para ${dataBr(data)}. Esta é uma mensagem da ${farmacia}.`;}
export function whatsappUrl(telefone:string,mensagem:string){
 if(!/^[\d ()-]+$/.test(telefone))throw new Error('Informe um telefone nacional com DDD.');
 const t=telefone.replace(/\D/g,'');
 if(!/^[1-9]\d{9,10}$/.test(t))throw new Error('Informe um telefone nacional com DDD.');
 if(!mensagem.trim()||mensagem.length>2000)throw new Error('A mensagem deve ter de 1 a 2.000 caracteres.');
 return `https://wa.me/55${t}?text=${encodeURIComponent(mensagem.trim())}`;
}
export const origemLabel:Record<string,string>={regra_pfpb:'Regra oficial PFPB',nao_calculado:'Não calculado',manual:'Data definida manualmente',intervalo_confirmado:'Calculado por intervalo confirmado',fonte_confirmada:'Data confirmada na fonte',intervalo_fonte:'Calculado a partir da fonte'};
