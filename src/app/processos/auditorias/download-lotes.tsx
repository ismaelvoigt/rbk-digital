'use client';
import React,{useEffect,useRef,useState} from 'react';
type Props={auditId:string;batchId?:string;number?:number;disabled?:boolean};
type Progress={id:string;state:string;preparedFiles:number;totalFiles:number;verifiedParts:number;totalParts:number;expiresAt:string;filename:string};
function PreparedDownload({auditId,batchId,number,disabled=false}:Props){
 const [job,setJob]=useState<Progress|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),pending=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const running=job&&['queued','preparing','validating'].includes(job.state);
 useEffect(()=>{
  if(!job||!running)return;const controller=new AbortController();
  async function poll(){try{const r=await fetch(`/api/auditorias/exportacoes?id=${job!.id}`,{cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Falha ao consultar o ZIP.');if(!controller.signal.aborted)setJob(data);}catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Falha de conexão. Clique em retomar.');setJob(null);}}}
  const timer=setTimeout(poll,2500);return()=>{controller.abort();clearTimeout(timer);};
 },[job,running]);
 async function prepare(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{
  const r=await fetch('/api/auditorias/exportacoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({auditId,batchId}),cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível preparar o ZIP.');if(alive.current)setJob(data);
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Falha de conexão. Clique novamente para retomar.');}finally{pending.current=false;if(alive.current)setBusy(false);}}
 return <span className="aud-export-control">
  {job?.state==='ready'?<a className="aud-download-zip" href={`/api/auditorias/exportacoes?id=${job.id}&download=1`} target="_blank" rel="noopener noreferrer">{batchId?'Baixar lote':'Baixar todos os lotes'}</a>:<button type="button" className="aud-download-zip" disabled={disabled||busy||Boolean(running)} onClick={()=>void prepare()}>{busy?'Iniciando…':running?'Preparando ZIP…':job?.state==='failed'?'Tentar novamente':batchId?'Baixar lote':'Baixar todos os lotes'}</button>}
  {job&&<span role="status" style={{display:'block',marginTop:6,fontSize:13}}>{job.state==='ready'?'ZIP validado. Disponível por até 24 horas.':job.state==='validating'?`Validando: ${job.verifiedParts} de ${job.totalParts} partes.`:job.state==='failed'?'Não foi possível concluir. Tente novamente.':`Preparando: ${job.preparedFiles} de ${job.totalFiles} arquivos${number?` · lote ${number}`:''}. Você pode voltar depois e clicar novamente para retomar.`}</span>}
  {error&&<span role="alert" style={{display:'block',marginTop:6}}>{error}</span>}
 </span>;
}
export default function DownloadLotes(props:Props){
 if(process.env.NEXT_PUBLIC_RBK_ENV==='development')return <PreparedDownload key={`${props.auditId}:${props.batchId||'all'}`} {...props}/>;
 const {auditId,batchId,number,disabled=false}=props,label=batchId?'Baixar lote':'Baixar todos os lotes',accessible=batchId?`Baixar lote ${number} em ZIP`:'Baixar todos os lotes em ZIP';
 if(disabled)return <button type="button" disabled aria-label={accessible}>{label}</button>;
 const query=new URLSearchParams({auditoria:auditId});if(batchId)query.set('lote',batchId);
 return <a className="aud-download-zip" href={`/api/auditorias/arquivo-zip?${query}`} download target="_blank" rel="noopener noreferrer" aria-label={accessible}>{label}</a>;
}
