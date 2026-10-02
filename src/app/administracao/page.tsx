import Administracao from '../../components/modulos/Administracao';

export default async function Page({searchParams}: {
  searchParams: Promise<{modulo?: string | string[]}>;
}) {
  const {modulo} = await searchParams;
  return <Administracao moduloInicial={typeof modulo === 'string' ? modulo : undefined}/>;
}
