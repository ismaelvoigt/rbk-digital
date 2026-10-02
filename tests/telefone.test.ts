import { describe, expect, it } from 'vitest';
import { formatTelefone, normalizeTelefone } from '../src/lib/cadastro/telefone';

describe('telefone com DDD', () => {
  it.each([
    ['1133334444', '(11) 3333-4444'],
    ['11999998888', '(11) 99999-8888'],
    ['1199999888812345', '(11) 99999-8888'],
    ['1', '(1'], ['11', '(11'], ['113', '(11) 3'], ['', ''],
  ])('formata e limita %s', (input, expected) => {
    expect(formatTelefone(input)).toBe(expected);
  });
  it.each(['1133334444', '(11) 3333-4444', '11999998888', '(11) 99999-8888'])('aceita %s', input => {
    expect(normalizeTelefone(input)).toBe(formatTelefone(input));
  });
  it.each(['119999988881', '123', 'telefone12345678901', '00000000000', '+5511999998888'])('recusa %s sem truncar', input => {
    expect(normalizeTelefone(input)).toBeNull();
  });
  it('mantém telefone opcional', () => expect(normalizeTelefone('  ')).toBe(''));
});
