'use client';
import {GestaoShell} from '../../components/gestao/Shared';
import Financeiro from '../../components/gestao/Financeiro';
export default function Page(){return <GestaoShell title="Financeiro" description="Acompanhe os serviços contratados, as mensalidades e os recebimentos da RBK.">{()=> <Financeiro/>}</GestaoShell>;}
