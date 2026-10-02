import { expect, test } from 'vitest';
import { formatCnpj } from '../src/lib/processos/cnpj';
test('formats typing, pasted CNPJ and existing stored digits', () => {
 expect(formatCnpj('12345678000190')).toBe('12.345.678/0001-90');
 expect(formatCnpj('12.345.678/0001-90')).toBe('12.345.678/0001-90');
 expect(formatCnpj('123456')).toBe('12.345.6');
 expect(formatCnpj('')).toBe('');
 expect(formatCnpj('1234567800019099')).toBe('12.345.678/0001-90');
});
