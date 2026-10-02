import {readFile,writeFile} from 'node:fs/promises';import {extractPdf} from './extract-pdf.mjs';
await writeFile(process.argv[3],JSON.stringify(await extractPdf(await readFile(process.argv[2]))),{mode:0o600});
