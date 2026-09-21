import fields from '../processos/fields.json';
export function missingFichaFields(ficha:Record<string,string>,partners:number):string[]{
 if(!Number.isInteger(partners)||partners<1||partners>4)throw new Error('Confira a quantidade de sócios.');
 return fields.filter(f=>!f.group.startsWith('Sócio ')||Number(f.group.slice(-1))<=partners).filter(f=>{
  const value=(ficha[f.cell]||'').trim();
  if(f.cell==='B28')return false;
  if(['B33','B34'].includes(f.cell))return !((ficha.B33||'').trim()||(ficha.B34||'').trim());
  if(!value)return true;
  if(['B19','B20'].includes(f.cell))return !/^\d{14}$/.test(value.replace(/\D/g,''));
  if(/MAIL|ELETRÔNICO/.test(f.label))return !/^[^\s@]+@[^\s@]+$/.test(value);
  if(f.type==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return true;const d=new Date(value+'T00:00:00Z');return !Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value;}
  return false;
 }).map(f=>f.label.replace(/^\*\s*/,'').replace(/:\s*$/,''));
}
