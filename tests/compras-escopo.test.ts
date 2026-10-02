import {it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {carregarVendas} from '../src/lib/vendas/consulta';
it('compras exige uma farmácia antes de consultar a base de vendas',async()=>{
 const db={} as SupabaseClient;
 await expect(carregarVendas(db,{inicio:'2026-09-01',fim:'2026-09-26'})).rejects.toThrow(/Selecione uma farmácia/);
});
