// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import FarmaciaPage from '../src/app/farmacia/page';
const m=vi.hoisted(()=>({push:vi.fn(),signOut:vi.fn(async()=>({error:null}))}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:m.push})}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>({auth:{getUser:()=>new Promise(()=>{}),signOut:m.signOut}})}));
vi.mock('../src/components/proximas/ProximasCard',()=>({default:()=>null}));
vi.mock('../src/components/RbkBrand',()=>({RbkBrand:()=>null}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
it('permite abrir cadastro e consulta enquanto indicadores aguardam a rede',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 try{await act(async()=>root.render(<FarmaciaPage/>));
 expect(host.querySelector('a[href="/nova-autorizacao"]')).not.toBeNull();
 expect(host.querySelector('a[href="/autorizacoes"]')).not.toBeNull();
 expect(host.textContent).toContain('Carregando indicadores');
 await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Sair"]')!.click());
 expect(m.signOut).toHaveBeenCalledOnce();expect(m.push).toHaveBeenCalledWith('/');
 }finally{await act(async()=>root.unmount())}
});
