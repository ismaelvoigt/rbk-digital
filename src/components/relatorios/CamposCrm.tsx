import { UFS } from '../../lib/relatorios/filtros';
export default function CamposCrm({crm,uf,onChange,prefixo='crm',filtro=false}:{crm:string;uf:string;onChange:(crm:string,uf:string)=>void;prefixo?:string;filtro?:boolean}) {
  return <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
    <div><label htmlFor={`${prefixo}-numero`} className="mb-2 block text-sm font-semibold text-gray-700">CRM{filtro?'':' (opcional)'}</label>
      <input id={`${prefixo}-numero`} value={crm} onChange={e=>onChange(e.target.value,uf)} inputMode="numeric" maxLength={10} placeholder="Número do CRM" className="rbk-input" /></div>
    <div><label htmlFor={`${prefixo}-uf`} className="mb-2 block text-sm font-semibold text-gray-700">UF do CRM</label>
      <select id={`${prefixo}-uf`} value={uf} onChange={e=>onChange(crm,e.target.value)} className="rbk-input"><option value="">{filtro?'Todas':'UF'}</option>{UFS.map(estado=><option key={estado}>{estado}</option>)}</select></div>
  </div>;
}
