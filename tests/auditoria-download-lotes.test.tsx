// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import DownloadLotes from '../src/app/processos/auditorias/download-lotes';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
it('navigates to a native ZIP download for the chosen batch or all batches without buffering a browser Blob',async()=>{
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 try{
 await act(async()=>root.render(<><DownloadLotes auditId="audit" batchId="batch" number={2}/><DownloadLotes auditId="audit"/><DownloadLotes auditId="audit" batchId="open" number={3} disabled/></>));
 const links=[...host.querySelectorAll('a')];expect(links).toHaveLength(2);
 expect(links[0].getAttribute('href')).toBe('/api/auditorias/arquivo-zip?auditoria=audit&lote=batch');expect(links[0].textContent).toBe('Baixar lote');expect(links[0].getAttribute('aria-label')).toContain('2');
 expect(links[1].getAttribute('href')).toBe('/api/auditorias/arquivo-zip?auditoria=audit');expect(links[1].textContent).toBe('Baixar todos os lotes');
 expect(host.querySelector('button')?.disabled).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});
