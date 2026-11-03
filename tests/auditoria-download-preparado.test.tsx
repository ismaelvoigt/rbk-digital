// @vitest-environment happy-dom
import React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import DownloadLotes from '../src/app/processos/auditorias/download-lotes';
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('development waits for validation before offering a native download',async()=>{
 vi.stubEnv('NEXT_PUBLIC_RBK_ENV','development');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({id:'job',state:'preparing',preparedFiles:2,totalFiles:5,verifiedParts:0,totalParts:2,filename:'Farmacia.zip'})));
 const el=document.createElement('div'),root=createRoot(el);await act(async()=>root.render(<DownloadLotes auditId="audit"/>));expect(el.querySelector('a')).toBeNull();
 await act(async()=>el.querySelector('button')!.click());expect(el.textContent).toContain('2 de 5');expect(el.querySelector('a')).toBeNull();await act(async()=>root.unmount());
});
it('production keeps the existing download route',async()=>{
 vi.stubEnv('NEXT_PUBLIC_RBK_ENV','production');const el=document.createElement('div'),root=createRoot(el);await act(async()=>root.render(<DownloadLotes auditId="audit"/>));expect(el.querySelector('a')?.getAttribute('href')).toContain('/api/auditorias/arquivo-zip?');await act(async()=>root.unmount());
});
