// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('../src/lib/auditoria/office',()=>({uploadOffice:vi.fn()}));
import OfficeAttachment from '../src/app/processos/auditorias/office-attachment';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
it('lets the manager download current and previous received offices without waiting for scan',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const download=vi.fn();
 const file=(id:string,received_at:string|null,scan:string)=>({id,filename:id+'.pdf',size:10,created_at:'2026-11-01T12:00:00Z',received_at,scan});
 try{
 await act(async()=>root.render(<OfficeAttachment id="audit" files={[file('current','2026-11-01T12:00:00Z','pending'),file('old','2026-10-30T12:00:00Z','error'),file('incomplete',null,'pending')]} onRefresh={async()=>{}} onDownload={download}/>));
 const buttons=[...host.querySelectorAll('button')].filter(b=>b.textContent==='Baixar');expect(buttons).toHaveLength(2);
 await act(async()=>{buttons[0].click();buttons[1].click()});expect(download.mock.calls).toEqual([['current'],['old']]);
 }finally{await act(async()=>root.unmount());host.remove();}
});
