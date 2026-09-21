// Entrada privada explícita. Converte somente strings para eliminar valores antigos do anexo.
import JSZip from 'jszip';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const input=await readFile(process.argv[2]);const zip=await JSZip.loadAsync(input);
const fields=JSON.parse(await readFile('src/lib/processos/fields.json','utf8'));
const cells=new Set([...fields.map(f=>f.cell),'B37']);
let sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
const strings=(await zip.file('xl/sharedStrings.xml').async('string')).match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g)||[];
sheet=sheet.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(all,attrs,body='')=>{const ref=attrs.match(/\br="([^"]+)"/)?.[1];if(cells.has(ref))return `<c${attrs.replace(/\s+t="[^"]*"/g,'')} t="inlineStr"><is><t></t></is></c>`;if(/\bt="s"/.test(attrs)){const n=Number(body.match(/<v>(\d+)<\/v>/)?.[1]);if(!strings[n])throw Error('Índice de string inválido');return `<c${attrs.replace('t="s"','t="inlineStr"')}>${strings[n].replace(/^<si/,'<is').replace(/<\/si>$/,'</is>')}</c>`;}return all;});
sheet=sheet.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/g,'');zip.file('xl/worksheets/sheet1.xml',sheet);
zip.file('xl/sharedStrings.xml','<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>');
const rel=zip.file('xl/worksheets/_rels/sheet1.xml.rels');if(rel)zip.file(rel.name,(await rel.async('string')).replace(/<Relationship\b[^>]*Type="[^"]*hyperlink"[^>]*\/>/g,''));
const core=zip.file('docProps/core.xml');if(core)zip.file(core.name,(await core.async('string')).replace(/<(dc:creator|cp:lastModifiedBy)>[\s\S]*?<\/\1>/g,''));
await mkdir('private',{recursive:true});await writeFile('private/ficha-template.xlsx',await zip.generateAsync({type:'nodebuffer'}));
await writeFile('docs/template-provenance.json',JSON.stringify({sourceSha256:createHash('sha256').update(input).digest('hex'),blankedCells:[...cells],changes:['Todas as entradas removidas, incluindo B37 ambígua','Strings compartilhadas convertidas em inline; tabela esvaziada para não reter dados anteriores','Hyperlinks pessoais removidos','Autor e último editor removidos de metadados'],unchanged:['Estilos','Dimensões e mesclagens','Imagem','Validações','Configuração de impressão']},null,2));
