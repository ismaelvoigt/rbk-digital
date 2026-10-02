'use client';
import {GestaoShell} from '../../components/gestao/Shared';
import CRM from '../../components/gestao/CRM';
export default function Page(){return <GestaoShell title="CRM" description="Organize leads, clientes e oportunidades da RBK.">{ctx=><CRM ctx={ctx}/>}</GestaoShell>;}
