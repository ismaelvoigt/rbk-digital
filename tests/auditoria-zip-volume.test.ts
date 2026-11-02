import {expect,it} from 'vitest';
import {zipStream} from '../src/lib/auditoria/zip';
it.runIf(process.env.RBK_ZIP_STRESS==='1')('streams 3 GB without retaining the ZIP in memory',async()=>{
 const size=100*1024*1024, files=Array.from({length:30},(_,i)=>({name:`Lote ${i+1}/teste.bin`,path:`${i}`,size}));
 const start=performance.now(),initial=process.memoryUsage().rss;let peak=initial,written=0;
 const chunk=new Uint8Array(65536).fill(65);
 await zipStream(files,async()=>{let sent=0;return new ReadableStream({pull(controller){if(sent===size)controller.close();else{sent+=chunk.length;controller.enqueue(chunk)}}})}).pipeTo(new WritableStream({write(data){written+=data.byteLength;peak=Math.max(peak,process.memoryUsage().rss)}}));
 expect(written).toBeGreaterThan(size*30);
 expect(peak-initial).toBeLessThan(512*1024*1024);
 console.log(JSON.stringify({inputBytes:size*30,outputBytes:written,seconds:Math.round((performance.now()-start)/100)/10,peakAdditionalMB:Math.round((peak-initial)/1024/1024)}));
},120000);
