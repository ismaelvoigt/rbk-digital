import { expect, it } from 'vitest';
import {formatCnpj,normalizeCnpj} from '../src/lib/auditoria/cnpj';
it('formata digitação e colagem em 14 posições, sem ultrapassar a máscara',()=>{
 expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
 expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
 expect(formatCnpj('090909090909090909')).toBe('09.090.909/0909-09');
 expect(formatCnpj('112')).toBe('11.2');
 expect(formatCnpj('')).toBe('');
 expect(normalizeCnpj(formatCnpj('11222333000181'))).toBe('11222333000181');
 expect(formatCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
});
