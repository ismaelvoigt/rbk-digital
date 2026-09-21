import { expect, test } from 'vitest';
import { TYPES, summarize } from '../src/lib/processos/domain';
test('RTA is required even when the original ten categories are approved', () => {
 expect(TYPES.some(([kind]) => kind === 'rta')).toBe(true);
 const versions = TYPES.filter(([kind]) => kind !== 'rta').map(([kind]) => ({id:kind,kind}));
 expect(summarize(versions,versions.map(v=>({version_id:v.id,decision:'Aprovado'}))).pending).toBe(1);
});
