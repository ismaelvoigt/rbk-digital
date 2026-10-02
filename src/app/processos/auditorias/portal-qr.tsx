"use client";
import { useEffect, useState } from "react";
import { prepareInviteFile, shareInvite, shareNotices } from "../../../../public/convite-share.mjs";
import { portalInvite } from "../../../lib/auditoria/portal-qr";

export default function PortalQr({ link, pharmacy }: { link: string; pharmacy: string }) {
  return <PreparedPortalQr key={`${link}:${pharmacy}`} link={link} pharmacy={pharmacy} />;
}
function PreparedPortalQr({link,pharmacy}: {link:string;pharmacy:string}) {
  const [prepared, setPrepared] = useState<{link:string; image:string; file:File} | null>(null);
  const current = prepared?.link === link ? prepared : null;
  const image = current?.image;
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const message = `Olá, ${pharmacy}! A RBK Assessoria disponibilizou seu acesso para envio dos documentos da auditoria do Farmácia Popular.\n\nEscaneie o QR Code da imagem ou acesse o link abaixo:\n${link}\n\nNão é necessário criar conta. Você pode enviar aos poucos e voltar ao mesmo link. Compartilhe este acesso somente com o responsável da farmácia.`;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    portalInvite(link, pharmacy).then(value => { if (active) setPrepared({link,image:value,file:prepareInviteFile(value,"Auditoria")}); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [link, pharmacy]);
  return <div className="aud-qr">
    <div>
      <strong>Convite para envio de documentos</strong>
      <p>Aponte a câmera do celular para acessar o mesmo link.</p>
      <small>Compartilhe a imagem e a mensagem. Escolha o WhatsApp e o destinatário; confira se o link acompanha a imagem.</small>
      <label style={{ display: "block", marginTop: 16 }}>Mensagem com link<textarea rows={7} readOnly value={message} /></label>
      <button disabled={!current || sharing} onClick={async () => {
        if (!current || sharing) return;
        setSharing(true);
        try { setNotice(shareNotices[await shareInvite(current.file, message)]); }
        finally { setSharing(false); }
      }}>{sharing ? "Compartilhando…" : "Compartilhar QR Code e link"}</button>
      {notice && <p role="status">{notice}</p>}
    </div>
    {image ? <div>
      {/* Generated locally: the access token is never sent to a QR service. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} width={270} height={400} alt="Convite RBK Digital com QR Code do portal desta auditoria" />
    </div> : <p role="status">{failed ? "Não foi possível gerar o QR Code. Use o link acima." : "Gerando QR Code…"}</p>}
  </div>;
}
