import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarDadosPdf } from '../src/lib/autorizacoes/carregarPdf';

function mockClient({ signedIn = true, authError = false, denied = false, documentsError = false, count = 2 } = {}) {
  const ranges: number[][] = [];
  const authorization = { numero_autorizacao: '123456789012345' };
  const from = vi.fn((table: string) => {
    const q = {
      select: vi.fn(() => q), eq: vi.fn(() => q), order: vi.fn(() => q),
      single: vi.fn(async () => ({ data: denied ? null : authorization, error: denied ? {} : null })),
      range: vi.fn(async (start: number, end: number) => {
        ranges.push([start,end]);
        return { data: Array.from({length: Math.max(0, Math.min(end + 1, count) - start)}, (_, i) => ({ id: String(start + i) })), error: documentsError ? {} : null };
      }),
    };
    expect(['autorizacoes', 'documentos']).toContain(table);
    return q;
  });
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: signedIn ? {id: 'user'} : null }, error: authError ? {} : null })) }, from } as unknown as SupabaseClient;
  return { client, from, ranges };
}
describe('leitura para exportação', () => {
  it('impede exportação sem sessão', async () => {
    const mock = mockClient({signedIn:false});
    await expect(carregarDadosPdf(mock.client, 'id')).rejects.toThrow('Sessão expirada');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('não exporta autorização negada pelas políticas', async () => {
    const mock = mockClient({denied:true});
    await expect(carregarDadosPdf(mock.client, 'id')).rejects.toThrow('acessar esta autorização');
    expect(mock.from).toHaveBeenCalledTimes(1);
  });
  it('não produz resumo incompleto se a leitura de documentos falhar', async () => {
    await expect(carregarDadosPdf(mockClient({documentsError:true}).client, 'id')).rejects.toThrow('carregar os documentos');
  });
  it('inclui todos os registros além do limite padrão de consulta', async () => {
    const mock = mockClient({count:1101});
    const data = await carregarDadosPdf(mock.client, 'id');
    expect(data.documentos).toHaveLength(1101);
    expect(mock.ranges).toEqual([[0,499],[500,999],[1000,1499]]);
    expect(mock.from.mock.results[0].value.eq).toHaveBeenCalledWith('id','id');
    expect(mock.from.mock.results[1].value.eq).toHaveBeenCalledWith('autorizacao_id','id');
  });
});
