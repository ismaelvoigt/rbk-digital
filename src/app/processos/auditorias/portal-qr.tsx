"use client";
import { useEffect, useState } from "react";
import { portalInvite } from "../../../lib/auditoria/portal-qr";

export default function PortalQr({ link, pharmacy }: { link: string; pharmacy: string }) {
  const [image, setImage] = useState("");
  const [notice, setNotice] = useState("");
  const message = `Olá, ${pharmacy}! A RBK Assessoria disponibilizou seu acesso para envio dos documentos da auditoria do Farmácia Popular.\n\nEscaneie o QR Code da imagem ou acesse o link abaixo:\n${link}\n\nNão é necessário criar conta. Você pode enviar aos poucos e voltar ao mesmo link. Compartilhe este acesso somente com o responsável da farmácia.`;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    portalInvite(link, pharmacy).then(value => { if (active) setImage(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [link, pharmacy]);
  return <div className="aud-qr">
    <div>
      <strong>Convite para envio de documentos</strong>
      <p>Aponte a câmera do celular para acessar o mesmo link.</p>
      <small>Baixe a imagem e envie com esta mensagem. O link permanece clicável no texto.</small>
      <label style={{ display: "block", marginTop: 16 }}>Mensagem com link<textarea rows={7} readOnly value={message} /></label>
      <button onClick={async () => { try { await navigator.clipboard.writeText(message); setNotice("Mensagem copiada. Envie junto com a imagem."); } catch { setNotice("Selecione e copie a mensagem acima."); } }}>Copiar mensagem com link</button>
      {notice && <p role="status">{notice}</p>}
    </div>
    {image ? <div>
      {/* Generated locally: the access token is never sent to a QR service. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} width={270} height={400} alt="Convite RBK Digital com QR Code do portal desta auditoria" />
      <a className="aud-qr-download" href={image} download="RBK-convite-envio-documentos.png">Baixar convite com QR Code</a>
    </div> : <p role="status">{failed ? "Não foi possível gerar o QR Code. Use o link acima." : "Gerando QR Code…"}</p>}
  </div>;
}
