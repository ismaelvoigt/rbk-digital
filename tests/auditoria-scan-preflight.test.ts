import {it,expect} from 'vitest';
import {validateScannerVersion} from '../tools/auditoria-scan-preflight.mjs';
const now=Date.parse('2026-09-19T12:00:00Z');
it('aceita apenas engine com definições recentes',()=>{
 expect(validateScannerVersion('ClamAV 1.5.4/28000/Fri Sep 18 12:00:00 2026',now).databaseVersion).toBe('28000');
});
it('bloqueia definições ausentes, vencidas e data futura',()=>{
 for(const v of ['ClamAV 1.5.4','ClamAV 1.5.4/28000/Sep 10 2026','ClamAV 1.5.4/28000/Dec 20 2026','fake/28000/Sep 18 2026'])expect(()=>validateScannerVersion(v,now)).toThrow();
});
