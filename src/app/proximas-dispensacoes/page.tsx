import ProximasModulo from '../../components/proximas/ProximasModulo';
export default async function Page({searchParams}:{searchParams:Promise<{periodo?:string}>}){
 const p=await searchParams;const modes=['hoje','2dias','7dias','30dias','personalizado','nao_calculado','atrasados','historico','alertas'] as const;const modo=modes.find(m=>m===p.periodo)||'hoje';
 return <ProximasModulo modoInicial={modo}/>;
}
