import {csv,xlsx} from '../vendas/exportar';
import type {Intervalo} from '../vendas/domain';
import type {ProdutoCompra} from './domain';
import type {BaseEstoque} from './consulta';
export async function gerarExportacao(produtos:ProdutoCompra[],p:Intervalo,horizonte:30|60|90,base:BaseEstoque|null,formato:'csv'|'xlsx'){
 const headers=['EAN/GTIN','Produto','Princípio ativo','Unidade','Estoque atual','Consumo no período','Média diária','Média mensal (30d)','Cobertura em dias','Projeção 30d','Projeção 60d','Projeção 90d',`Sugestão de compra ${horizonte}d`,'Correspondência','Alerta','Base parcial','Início','Fim','Data posição estoque','Critério'];
 const rows=produtos.map(r=>[r.ean,r.produto,r.principio,r.unidade,r.estoque,r.consumo,r.diaria,r.mensal,r.cobertura,r.projecao30,r.projecao60,r.projecao90,r.sugestao,r.correspondencia,r.alerta,r.parcial?'Sim':'Não',p.inicio,p.fim,base?.data_posicao??null,'Consumo confirmado visível / dias corridos; sem conversão de unidades; projeções lineares PFPB']);
 const criterios=[['Critério','Valor'],['Período',`${p.inicio} a ${p.fim}`],['Horizonte de reposição',horizonte],['Origem do estoque',base?.arquivo||'Não importado'],['Posição de estoque',base?.data_posicao||'Não informada'],['Média diária','Consumo confirmado no período / dias corridos inclusivos'],['Média mensal','Média diária × 30'],['Projeção','Média diária × 30 / 60 / 90'],['Reposição','Teto do máximo entre zero e projeção menos estoque, na mesma unidade'],['Limite da base','Somente dispensações confirmadas cadastradas pelo usuário; outras vendas da farmácia não estão incluídas'],['Campos vazios','Indisponíveis; não representam zero'],['Estoque','Posição importada, sem abater automaticamente dispensações'],['Qualidade','Grupos com quantidades ausentes ou itens pendentes não geram projeção nem reposição']];
 if(formato==='csv')return {texto:csv([headers,...rows]),bytes:null};
 return {texto:null,bytes:await xlsx([{nome:'Planejamento',linhas:[headers,...rows]},{nome:'Critérios',linhas:criterios}])};
}
export async function baixarCompras(produtos:ProdutoCompra[],p:Intervalo,h:30|60|90,base:BaseEstoque|null,formato:'csv'|'xlsx'){
 const r=await gerarExportacao(produtos,p,h,base,formato);const blob=new Blob([r.texto??new Uint8Array(r.bytes!)],{type:formato==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`planejamento-compras-${p.inicio}-${p.fim}.${formato}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
