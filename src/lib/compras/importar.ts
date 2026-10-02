import JSZip from 'jszip';
import {normalizarEAN,unidade,type EstoqueItem} from './domain';
export type MapaEstoque={ean:number;produto:number;quantidade:number;unidade:number};
export type AbaEstoque={nome:string;linhas:string[][]};
const MAX_LINHAS=20001;
export function lerCSV(texto:string):string[][]{
 texto=texto.replace(/^\ufeff/,'');
 const primeira=texto.split(/\r?\n/)[0];
 const sep=[';',',','\t'].sort((a,b)=>primeira.split(b).length-primeira.split(a).length)[0];
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<texto.length;i++){
 const c=texto[i];
 if(c==='"'){if(quoted&&texto[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw new Error('Aspas inválidas no CSV.');}
 else if(!quoted&&(c===sep||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==sep){if(c==='\r'&&texto[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}}
 else cell+=c;
 if(rows.length>MAX_LINHAS||row.length>100||cell.length>10000)throw new Error('Planilha excede os limites: 20 mil linhas, 100 colunas e 10 mil caracteres por célula.');
 }
 if(quoted)throw new Error('Aspas não fechadas no CSV.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length>MAX_LINHAS)throw new Error('Limite de 20 mil produtos.');return rows;
}
function quantidade(v:string,formato:'br'|'decimal'|'auto'){
 let s=v.trim();if(!s)throw new Error('quantidade vazia');
 if(formato==='br'||(formato==='auto'&&s.includes(','))){if(!/^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,3})?$/.test(s))throw new Error('quantidade inválida');s=s.replaceAll('.','').replace(',','.');}
 else if(!/^\d+(\.\d{1,3})?$/.test(s))throw new Error('quantidade inválida');
 const n=Number(s);if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('quantidade fora do limite');return n;
}
export function mapearEstoque(linhas:string[][],m:MapaEstoque,unidadeFixa='',formato:'br'|'decimal'|'auto'='auto'){
 const campos=[m.ean,m.produto,m.quantidade,...(m.unidade>=0?[m.unidade]:[])];
 if(campos.some(x=>!Number.isInteger(x)||x<0)||new Set(campos).size!==campos.length)throw new Error('Mapeie EAN, produto e quantidade em colunas diferentes.');
 if(linhas.length>20000)throw new Error('Limite de 20 mil produtos.');
 const itens:EstoqueItem[]=[],erros:string[]=[],vistos=new Set<string>();
 for(const [idx,r] of linhas.entries()){
 if(!r.some(x=>x.trim()))continue;
 try{
 const raw=(r[m.ean]||'').trim(),ean=normalizarEAN(raw),produto=(r[m.produto]||'').trim(),u=unidade(m.unidade>=0?r[m.unidade]:unidadeFixa);
 if(raw&&!ean)throw new Error('EAN/GTIN inválido; use 8, 12, 13 ou 14 dígitos como texto, sem notação científica');
 if(!produto||produto.length>250)throw new Error('produto obrigatório, até 250 caracteres');
 if(!u||u.length>30)throw new Error('unidade obrigatória, até 30 caracteres');
 const q=quantidade(r[m.quantidade]||'',formato);const k=JSON.stringify([ean,u]);
 if(ean&&vistos.has(k))throw new Error('EAN e unidade duplicados; consolide o saldo antes de importar');
 if(ean)vistos.add(k);itens.push({ean,produto,unidade:u,quantidade:q});
 }catch(e){erros.push(`Linha ${idx+2}: ${e instanceof Error?e.message:'inválida'}.`);}
 }
 return {itens,erros,semEAN:itens.filter(x=>!x.ean).length};
}
function xml(text:string){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML não permitido.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('XLSX inválido.');return doc;}
function els(node:Document|Element,tag:string){return Array.from(node.getElementsByTagNameNS('*',tag));}
export async function lerArquivo(arquivo:File):Promise<AbaEstoque[]>{
 if(arquivo.size>5*1024*1024)throw new Error('O arquivo deve ter até 5 MB.');
 if(/\.csv$/i.test(arquivo.name)){let txt=await arquivo.text();if(txt.includes('\ufffd'))txt=new TextDecoder('windows-1252').decode(await arquivo.arrayBuffer());return [{nome:'CSV',linhas:lerCSV(txt)}];}
 if(!/\.xlsx$/i.test(arquivo.name))throw new Error('Escolha um arquivo XLSX ou CSV.');
 const zip=await JSZip.loadAsync(await arquivo.arrayBuffer());
 const files=Object.values(zip.files);let total=0;
 for(const f of files){const info=f as unknown as {_data?:{uncompressedSize:number}};total+=info._data?.uncompressedSize||0;}
 if(files.length>500||total>30*1024*1024)throw new Error('XLSX descompactado muito grande (máximo 30 MB).');
 async function read(path:string){const f=zip.file(path);if(!f)throw new Error('Estrutura XLSX incompleta.');return xml(await f.async('string'));}
 const book=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels');
 const shared=zip.file('xl/sharedStrings.xml')?els(await read('xl/sharedStrings.xml'),'si').map(si=>els(si,'t').map(t=>t.textContent||'').join('')):[];
 const sheets=els(book,'sheet');if(sheets.length>20)throw new Error('Use um arquivo com até 20 abas.');
 const abas:AbaEstoque[]=[];
 for(const s of sheets){
 const id=s.getAttribute('r:id'),rel=els(rels,'Relationship').find(r=>r.getAttribute('Id')===id);const target=rel?.getAttribute('Target');
 if(!target||target.includes('..')||rel?.getAttribute('TargetMode')==='External')throw new Error('Referência XLSX inválida.');
 const doc=await read(target.startsWith('/')?target.slice(1):`xl/${target}`),linhas:string[][]=[];
 for(const row of els(doc,'row')){
 const values:string[]=[];
 for(const c of els(row,'c')){
 const ref=c.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0];if(!letters)throw new Error('Célula sem referência.');
 let col=0;for(const l of letters)col=col*26+l.charCodeAt(0)-64;if(col>100)throw new Error('Use até 100 colunas.');
 const type=c.getAttribute('t'),v=els(c,'v')[0]?.textContent||'';
 // Fórmulas não são executadas nem valores em cache são tratados como estoque confirmado.
 values[col-1]=els(c,'f').length?'[FÓRMULA — substitua por valor]':type==='s'?(shared[Number(v)]||''):type==='inlineStr'?els(c,'t').map(t=>t.textContent||'').join(''):v;
 }
 const normalized=Array.from({length:values.length},(_,i)=>values[i]||'');if(normalized.some(x=>x.trim()))linhas.push(normalized);
 if(linhas.length>MAX_LINHAS)throw new Error('Limite de 20 mil produtos por aba.');
 }
 abas.push({nome:s.getAttribute('name')||'Aba',linhas});
 }
 if(!abas.length)throw new Error('Planilha sem abas.');return abas;
}
