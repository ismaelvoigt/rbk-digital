import {it,expect} from 'vitest';
import {planejar, normalizarEAN} from '../src/lib/compras/domain';
import type {ItemVenda,AutorizacaoVenda} from '../src/lib/vendas/domain';
const a={id:'a',data_autorizacao:'2026-09-01'} as AutorizacaoVenda;
const item=(o:Partial<ItemVenda>={}):ItemVenda=>({id:'i',autorizacao_id:'a',documento_id:'d',posicao:1,produto:'Produto A',ean:'7891234567895',unidade:'CX',quantidade:300,valor_unitario:null,valor_total:null,valor_pfpb:null,principio_ativo:'Ativo',indicacao:null,data_dispensacao:null,status:'confirmado',origens:{},...o});
const p={inicio:'2026-09-01',fim:'2026-09-30'};
const stock=[{ean:'7891234567895',produto:'Produto A',unidade:'CX',quantidade:80}];
it('calcula dias inclusivos, média, projeção e reposição arredondada',()=>{
const r=planejar([a],[item()],stock,p);expect(r.dias).toBe(30);expect(r.produtos[0]).toMatchObject({consumo:300,diaria:10,mensal:300,estoque:80,cobertura:8,projecao30:300,projecao60:600,projecao90:900,sugestao:220,alerta:'baixo'});
});
it('sem estoque não cria saldo, cobertura nem sugestão',()=>{expect(planejar([a],[item()],null,p).produtos[0]).toMatchObject({estoque:null,cobertura:null,sugestao:null,projecao30:300});});
it('estoque zero é real e sinaliza ruptura; consumo zero não gera infinito',()=>{expect(planejar([a],[item()],[{...stock[0],quantidade:0}],p).produtos[0].alerta).toBe('ruptura');const r=planejar([a],[item({quantidade:0})],stock,p).produtos[0];expect(r.cobertura).toBeNull();expect(r.sugestao).toBe(0);});
it('normaliza GTIN com zeros à esquerda e separa unidade incompatível',()=>{expect(normalizarEAN('7891234567895')).toBe('07891234567895');expect(planejar([a],[item()], [{...stock[0],ean:'07891234567895'}],p).produtos[0].estoque).toBe(80);expect(planejar([a],[item({unidade:'UN'})],stock,p).produtos.find(x=>x.unidade==='UN')?.estoque).toBeNull();});
it('nunca associa sem EAN pelo nome e preserva estoque sem consumo',()=>{const r=planejar([a],[item({ean:null})],stock,p);expect(r.produtos).toHaveLength(2);expect(r.produtos.find(x=>x.ean===null)?.estoque).toBeNull();expect(r.produtos.find(x=>x.estoque===80)?.diaria).toBeNull();});
it('ignora cancelados, deduplica IDs, restringe período e informa pendentes',()=>{const r=planejar([a],[item(),item(),item({id:'p',status:'pendente'}),item({id:'c',status:'cancelado'}),item({id:'z',autorizacao_id:'fora'})],stock,p);expect(r.produtos[0].consumo).toBe(300);expect(r.pendentes).toBe(1);});
it('quantidades ausentes tornam projeção do grupo indisponível',()=>{const r=planejar([a],[item(),item({id:'n',quantidade:null})],stock,p).produtos[0];expect(r.consumo).toBe(300);expect(r.parcial).toBe(true);expect(r.projecao30).toBeNull();expect(r.sugestao).toBeNull();});
it('um dia, horizonte 60 e arredondamento conservador',()=>{const r=planejar([a],[item({quantidade:0.11})],[{...stock[0],quantidade:1}],{inicio:'2026-09-01',fim:'2026-09-01'},60).produtos[0];expect(r.sugestao).toBe(6);});
it('pendência no mesmo produto bloqueia sugestão; período futuro é inválido',()=>{const r=planejar([a],[item(),item({id:'p',status:'pendente'})],stock,p);expect(r.produtos[0].sugestao).toBeNull();});
