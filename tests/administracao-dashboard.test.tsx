import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import Dashboard from '../src/app/dashboard/page';
vi.mock('next/navigation',()=>({useRouter:()=>({push:()=>{}})}));
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>({})}));
Object.assign(globalThis,{React});
for(const [nome,Page] of [['gestor',Dashboard]] as const){
 it(`${nome} entra nos módulos pelo único acesso Administração`,()=>{
  const html=renderToStaticMarkup(<Page/>);
  expect(html.match(/href="\/administracao"/g)).toHaveLength(1);
  for(const path of ['vendas','compras','relatorios'])expect(html).not.toContain(`href="/${path}"`);
  expect(html).toContain('href="/autorizacoes"');
 });
}
