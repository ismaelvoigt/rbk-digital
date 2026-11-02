'use client';
export default function DownloadLotes({auditId,batchId,number,disabled=false}:{auditId:string;batchId?:string;number?:number;disabled?:boolean}){
 const label=batchId?'Baixar lote':'Exportar auditoria completa';
 const accessible=batchId?`Baixar lote ${number} em ZIP`:'Exportar auditoria completa em ZIP';
 if(disabled)return <button type="button" disabled aria-label={accessible}>{label}</button>;
 const query=new URLSearchParams({auditoria:auditId});if(batchId)query.set('lote',batchId);
 return <a className="aud-download-zip" href={`/api/auditorias/arquivo-zip?${query}`} download target="_blank" rel="noopener noreferrer" aria-label={accessible}>{label}</a>;
}
