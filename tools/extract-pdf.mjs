import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,DOMMatrix,ImageData,Path2D}=require('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const {createWorker}=require('tesseract.js');const language=require('@tesseract.js-data/por');
const jsQR=require('jsqr');
export async function extractPdf(buffer,{ocr=true,maxPages=30}={}){
 const task=getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false});
 const pdf=await task.promise;let worker;const pages=[];let qr=false;let ocrPages=0;
 try{
  if(pdf.numPages>maxPages)throw new Error('PDF excede 30 páginas. Separe por tipo documental.');
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n);const content=await page.getTextContent();let text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
   const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2.5,2200/Math.max(base.width,base.height))});
   const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));const ctx=canvas.getContext('2d');
   await page.render({canvasContext:ctx,viewport,canvas}).promise;
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   // O conteúdo decodificado é descartado; nenhuma URL/código é consultado ou persistido.
   const pageQr=Boolean(jsQR(new Uint8ClampedArray(pixels.data),canvas.width,canvas.height,{inversionAttempts:'attemptBoth'})); qr=pageQr||qr;
   if(text.trim().length<80&&ocr){worker??=await createWorker('por',1,{langPath:language.langPath,gzip:true,cacheMethod:'none'});text=(await worker.recognize(canvas.toBuffer('image/png'))).data.text;ocrPages++;}
   pages.push({page:n,text,qr:pageQr});page.cleanup();
  }
  return {pages,qr,qrScanned:true,ocrPages};
 }finally{if(worker)await worker.terminate();await pdf.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const data=await extractPdf(await readFile(process.argv[2]));process.stdout.write(JSON.stringify(data));}
