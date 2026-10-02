import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export function validateScannerVersion(output, now = Date.now()) {
 const parts = output.trim().split('/');
 const signatureDate = Date.parse(parts.slice(2).join('/'));
 if (!/^ClamAV \d+\.\d+\.\d+/.test(parts[0]) || !/^\d+$/.test(parts[1] || '') || !Number.isFinite(signatureDate)) throw Error('Antivírus ou definições indisponíveis. Nenhum arquivo liberado.');
 if (now - signatureDate > 72*60*60*1000 || signatureDate > now + 60*60*1000) throw Error('Definições do antivírus fora da validade. Atualize antes de verificar arquivos.');
 return { engine: parts[0], databaseVersion: parts[1], signatureDate: new Date(signatureDate).toISOString() };
}
export async function scannerPreflight(binary, database) {
 const args = ['--version', ...(database ? [`--database=${database}`] : [])];
 const { stdout } = await exec(binary, args, {timeout:15000,maxBuffer:8192});
 return validateScannerVersion(stdout);
}
