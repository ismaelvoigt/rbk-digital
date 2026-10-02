import {extractPdf} from './extract-pdf.mjs';import {readFile,writeFile} from 'node:fs/promises';
const result=await extractPdf(await readFile(process.argv[2]),{ocr:false});await writeFile('../marlym-qr.json',JSON.stringify(result));
