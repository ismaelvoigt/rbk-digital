import {notFound} from 'next/navigation';
import ExportView from './export-view';
export default function ExportacaoAuditoria(){
 if(process.env.NEXT_PUBLIC_RBK_ENV!=='development')notFound();
 return <ExportView/>;
}
