import type {ZipFile} from './zip';
export const MAX_EXPORT_BYTES=50*1024**3;
export const MAX_EXPORT_FILES=10000;
export const PART_TARGET=8*1024**2;
export type Entry={name:string;size:number;crc:number;offset:number};
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function localLength(name:string,size:number){return 50+Buffer.byteLength(name)+size;}
function validEntry(e:Entry){if(!Number.isSafeInteger(e.size)||e.size<1||!Number.isSafeInteger(e.offset)||e.offset<0||Buffer.byteLength(e.name)>65535)throw Error('Entrada ZIP inválida.');}
export function localRecord(e:Entry,data:Buffer){
 validEntry(e);if(data.length!==e.size||crc32(data)!==e.crc)throw Error('Conteúdo divergente do ZIP.');
 const name=Buffer.from(e.name);const h=Buffer.alloc(50+name.length);
 h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(45,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(33,12);
 h.writeUInt32LE(e.crc,14);h.writeUInt32LE(0xffffffff,18);h.writeUInt32LE(0xffffffff,22);
 h.writeUInt16LE(name.length,26);h.writeUInt16LE(20,28);name.copy(h,30);
 const x=30+name.length;h.writeUInt16LE(1,x);h.writeUInt16LE(16,x+2);h.writeBigUInt64LE(BigInt(e.size),x+4);h.writeBigUInt64LE(BigInt(e.size),x+12);
 return Buffer.concat([h,data]);
}
export function centralDirectory(entries:Entry[],offset:number){
 const records=entries.map(e=>{
  validEntry(e);const n=Buffer.from(e.name),h=Buffer.alloc(74+n.length);
  h.writeUInt32LE(0x02014b50,0);h.writeUInt16LE(45,4);h.writeUInt16LE(45,6);h.writeUInt16LE(0x800,8);h.writeUInt16LE(33,14);
  h.writeUInt32LE(e.crc,16);h.writeUInt32LE(0xffffffff,20);h.writeUInt32LE(0xffffffff,24);h.writeUInt16LE(n.length,28);h.writeUInt16LE(28,30);h.writeUInt32LE(0xffffffff,42);n.copy(h,46);
  const x=46+n.length;h.writeUInt16LE(1,x);h.writeUInt16LE(24,x+2);h.writeBigUInt64LE(BigInt(e.size),x+4);h.writeBigUInt64LE(BigInt(e.size),x+12);h.writeBigUInt64LE(BigInt(e.offset),x+20);return h;
 });
 const cd=Buffer.concat(records),end=Buffer.alloc(98);
 end.writeUInt32LE(0x06064b50,0);end.writeBigUInt64LE(BigInt(44),4);end.writeUInt16LE(45,12);end.writeUInt16LE(45,14);
 end.writeBigUInt64LE(BigInt(entries.length),24);end.writeBigUInt64LE(BigInt(entries.length),32);end.writeBigUInt64LE(BigInt(cd.length),40);end.writeBigUInt64LE(BigInt(offset),48);
 end.writeUInt32LE(0x07064b50,56);end.writeBigUInt64LE(BigInt(offset+cd.length),64);end.writeUInt32LE(1,72);
 end.writeUInt32LE(0x06054b50,76);end.writeUInt16LE(0xffff,84);end.writeUInt16LE(0xffff,86);end.writeUInt32LE(0xffffffff,88);end.writeUInt32LE(0xffffffff,92);
 return Buffer.concat([cd,end]);
}
export function planGroups<T extends ZipFile>(files:T[]):T[][]{
 if(!files.length||files.length>MAX_EXPORT_FILES||files.reduce((n,f)=>n+localLength(f.name,f.size)+74+Buffer.byteLength(f.name),98)>MAX_EXPORT_BYTES)throw Error('Exportação acima de 50 GiB ou 10 mil documentos. Baixe por lote.');
 const groups:T[][]=[];let group:T[]=[],bytes=0;
 for(const f of files){if(!Number.isSafeInteger(f.size)||f.size<1||f.size>100*1024**2)throw Error('Documento acima de 100 MiB.');group.push(f);bytes+=localLength(f.name,f.size);if(bytes>=PART_TARGET){groups.push(group);group=[];bytes=0;}}
 if(group.length)groups.push(group);return groups;
}
export function exportName(pharmacy:string,batch?:number){const name=pharmacy.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,140)||'farmacia';return `${name}-${batch?`lote-${batch}`:'todos-lotes'}.zip`;}
