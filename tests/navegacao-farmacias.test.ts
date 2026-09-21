import { describe, expect, it } from 'vitest';
import { filtroFarmacias, queryFarmacias, retornoFarmacias } from '../src/lib/usuarios/navegacao';

describe('Navegação de farmácias', () => {
  it('entrada direta permanece sem consulta automática', () => {
    expect(filtroFarmacias('')).toEqual({cnpj: '', todas: false});
    expect(retornoFarmacias('')).toBe('/usuarios');
  });
  it('preserva a pesquisa por CNPJ', () => {
    const query = queryFarmacias('12.345.678/0001-90', false);
    expect(retornoFarmacias(query)).toBe('/usuarios?cnpj=12345678000190');
    expect(filtroFarmacias(query)).toEqual({cnpj:'12345678000190', todas:false});
  });
  it('preserva ver todas', () => {
    expect(retornoFarmacias(queryFarmacias('', true))).toBe('/usuarios?todas=1');
    expect(filtroFarmacias('?todas=1')).toEqual({cnpj:'',todas:true});
  });
  it('CNPJ tem prioridade sobre todas', () => {
    expect(filtroFarmacias('?cnpj=123&todas=1')).toEqual({cnpj:'123',todas:false});
  });
  it('retorno não aceita destino externo', () => {
    expect(retornoFarmacias('?returnTo=https://example.com')).toBe('/usuarios');
  });
  it('limita CNPJ e ignora parâmetros desconhecidos', () => {
    expect(retornoFarmacias('?cnpj=12345678901234567890&foo=bar')).toBe('/usuarios?cnpj=12345678901234');
  });
});
