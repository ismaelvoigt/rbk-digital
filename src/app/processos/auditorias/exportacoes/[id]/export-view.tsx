'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {RbkHeader} from '../../../../../components/RbkHeader';
import '../../auditoria.css';
import {createClient} from '../../../../../lib/supabase/client';
import DownloadLotes from '../../download-lotes';
export default function ExportacaoAuditoria(){
 const {id}=useParams<{id:string}>();const [name,setName]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;void(async()=>{const client=createClient();const {data,error}=await client.rpc('aud_manager',{op:'detail',aid:id,payload:{}});if(!active)return;if(error||!data){setError('Auditoria indisponível para este acesso.');return;}setName(data.audit.pharmacy);})();return()=>{active=false;};},[id]);
 return <main className="rbk-shell min-h-screen aud-content"><RbkHeader/><div className="rbk-container py-8"><Link href="/dashboard">← Início</Link><section className="rbk-card mt-6 p-6"><h1 className="text-2xl font-bold">Preparar arquivo da auditoria</h1>{error?<p role="alert">{error}</p>:name?<><p className="my-4">{name}</p><p className="mb-4">O arquivo será preparado e validado antes do download. As pastas dos lotes serão preservadas.</p><DownloadLotes auditId={id}/></>:<p role="status">Carregando…</p>}</section></div></main>;
}
