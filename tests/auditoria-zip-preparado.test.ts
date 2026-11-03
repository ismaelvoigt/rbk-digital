import {expect,it} from 'vitest';
import {ZipReader,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';
import {crc32,localRecord,centralDirectory,planGroups,MAX_EXPORT_BYTES} from '../src/lib/auditoria/export-zip64';
it('creates a real ZIP64 with accents, folders and CRC that independently extracts',async()=>{
 const bytes=Buffer.from('Documento fictício sem validade');
 const entry={name:'Lote 001/receita ação.pdf',size:bytes.length,crc:crc32(bytes),offset:0};
 const local=localRecord(entry,bytes),tail=centralDirectory([entry],local.length);
 const reader=new ZipReader(new Uint8ArrayReader(Buffer.concat([local,tail])));
 const entries=await reader.getEntries();expect(entries.map(e=>e.filename)).toEqual([entry.name]);
 if(entries[0].directory)throw Error('directory');expect(await entries[0].getData!(new Uint8ArrayWriter(),{checkSignature:true})).toEqual(new Uint8Array(bytes));await reader.close();
});
it('uses real ZIP64 offsets and bounded multipart groups',()=>{
 const size=5*1024**3;const tail=centralDirectory([{name:'grande.pdf',size:10,crc:0,offset:size}],size+100);
 expect(tail.readBigUInt64LE(46+Buffer.byteLength('grande.pdf')+20)).toBe(BigInt(size));
 const files=Array.from({length:9},(_,i)=>({name:String(i),size:3*1024**2,path:String(i)}));
 expect(planGroups(files).map(g=>g.length)).toEqual([3,3,3]);
 expect(()=>planGroups([{name:'x',size:MAX_EXPORT_BYTES+1,path:'x'}])).toThrow();
});
it('rejects mismatched source size before creating a ZIP record',()=>{
 expect(()=>localRecord({name:'x',size:4,crc:0,offset:0},Buffer.from('abc'))).toThrow();
 expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
});
