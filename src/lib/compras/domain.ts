import {confirmados,deslocar,periodo,type AutorizacaoVenda,type ItemVenda,type Intervalo} from '../vendas/domain';
export type EstoqueItem={ean:string|null;produto:string;unidade:string;quantidade:number};
export type ProdutoCompra={chave:string;ean:string|null;produto:string;principio:string;unidade:string;estoque:number|null;consumo:number|null;diaria:number|null;mensal:number|null;cobertura:number|null;projecao30:number|null;projecao60:number|null;projecao90:number|null;sugestao:number|null;parcial:boolean;correspondencia:string;alerta:'ruptura'|'baixo'|'adequado'|'indisponivel'};
export function normalizarEAN(v:string|null):string|null {const s=(v||'').trim().replace(/^'/,'');return /^(\d{8}|\d{12,14})$/.test(s)?s.padStart(14,'0'):null;}
export function unidade(v:string|null){return (v||'').trim().toUpperCase();}
export function chaveProduto(ean:string|null,u:string,nome:string){return JSON.stringify([normalizarEAN(ean)||`sem-ean:${nome.trim().toUpperCase()}`,unidade(u)]);}
export function planejar(autorizacoes:AutorizacaoVenda[],itens:ItemVenda[],estoque:EstoqueItem[]|null,p:Intervalo,horizonte:30|60|90=30,risco=7,baixo=15){
 periodo('personalizado',new Date(),p.inicio,p.fim);
 if(![30,60,90].includes(horizonte)||risco<0||baixo<risco||!Number.isFinite(baixo))throw new Error('Critérios de planejamento inválidos.');
 const dias=Math.round((Date.parse(p.fim)-Date.parse(p.inicio))/86400000)+1;
 const autos=new Map(autorizacoes.filter(a=>a.data_autorizacao>=p.inicio&&a.data_autorizacao<=p.fim).map(a=>[a.id,a]));
 const rows=confirmados(itens).filter(i=>autos.has(i.autorizacao_id));
 const pendentes=itens.filter(i=>i.status==='pendente'&&autos.has(i.autorizacao_id));
 const grupos=new Map<string,{items:ItemVenda[];s:EstoqueItem|null}>();
 for(const i of rows){const k=chaveProduto(i.ean,i.unidade||'',i.produto||i.id);const g=grupos.get(k)||{items:[],s:null};g.items.push(i);grupos.set(k,g);}
 const vistos=new Set<string>();
 for(const [index,s] of (estoque||[]).entries()){
 const k=normalizarEAN(s.ean)?chaveProduto(s.ean,s.unidade,s.produto):`estoque-sem-ean:${index}`;
 if(vistos.has(k))throw new Error('Estoque com EAN e unidade duplicados. Revise a importação.');vistos.add(k);
 if(!Number.isFinite(s.quantidade)||s.quantidade<0)throw new Error('Estoque inválido.');
 const g=grupos.get(k)||{items:[],s:null};g.s=s;grupos.set(k,g);
 }
 const pendKeys=new Set(pendentes.map(i=>chaveProduto(i.ean,i.unidade||'',i.produto||i.id)));
 const produtos:ProdutoCompra[]=[...grupos].map<ProdutoCompra>(([chave,g])=>{
 const first=g.items[0],ean=normalizarEAN(first?.ean||g.s?.ean||null),u=unidade(first?.unidade||g.s?.unidade||'');
 const vals=g.items.filter(i=>i.quantidade!==null&&Number.isFinite(i.quantidade)&&i.quantidade!>=0);
 const consumo=vals.length?vals.reduce((s,i)=>s+Math.round(i.quantidade!*1000),0)/1000:null;
 const parcial=vals.length<g.items.length||pendKeys.has(chave);
 const diaria=consumo!==null&&!parcial?consumo/dias:null;
 const saldo=g.s?.quantidade??null;
 const cobertura=saldo!==null&&diaria!==null&&diaria>0&&u?saldo/diaria:null;
 const proj=(d:number)=>diaria===null?null:Math.round(diaria*d*1000)/1000;
 const sugestao=saldo!==null&&diaria!==null&&u&&ean?Math.ceil(Math.max(0,Math.round((diaria*horizonte-saldo)*1000)/1000)):null;
 const correspondencia=!ean?'Sem EAN/GTIN válido':!u?'Unidade não informada':estoque===null?'Estoque não importado':!g.s?'Sem correspondência no estoque':!g.items.length?'Sem consumo confirmado no período':'EAN e unidade correspondentes';
 return {chave,ean,produto:first?.produto||g.s?.produto||'Produto não informado',principio:[...new Set(g.items.map(i=>i.principio_ativo).filter(Boolean))].join(' / ')||'Não informado',unidade:u,estoque:saldo,consumo,diaria,mensal:proj(30),cobertura,projecao30:proj(30),projecao60:proj(60),projecao90:proj(90),sugestao,parcial,correspondencia,alerta:cobertura===null?'indisponivel':cobertura<=risco?'ruptura':cobertura<=baixo?'baixo':'adequado'};
 }).sort((a,b)=>(b.consumo??-1)-(a.consumo??-1)||a.produto.localeCompare(b.produto));
 const comItens=new Set(rows.map(i=>i.autorizacao_id));
 const semItens=[...autos.keys()].filter(id=>!comItens.has(id)).length;
 return {produtos,dias,pendentes:pendentes.length,semItens};
}
export function evolucaoConsumo(autorizacoes:AutorizacaoVenda[],itens:ItemVenda[],p:Intervalo,u:string){
 const datas=new Map(autorizacoes.map(a=>[a.id,a.data_autorizacao]));const grupos=new Map<string,{valor:number|null;parcial:boolean}>();
 const mensal=(Date.parse(p.fim)-Date.parse(p.inicio))/86400000>62;
 for(let d=p.inicio;d<=p.fim;d=deslocar(d,1))grupos.set(d.slice(0,mensal?7:10),{valor:null,parcial:false});
 for(const i of confirmados(itens)){
 if(unidade(i.unidade)!==u)continue;const dia=datas.get(i.autorizacao_id);if(!dia||dia<p.inicio||dia>p.fim)continue;
 const g=grupos.get(dia.slice(0,mensal?7:10))!;
 if(i.quantidade===null)g.parcial=true;else g.valor=(g.valor??0)+i.quantidade;
 }
 return [...grupos].map(([data,g])=>({data,...g}));
}
