/** Prepare before the click: awaiting image generation would lose user activation. */
export function prepareInviteFile(image, purpose) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Imagem inválida');
  const bytes = Uint8Array.from(atob(image.split(',')[1]), char => char.charCodeAt(0));
  return new File([bytes], `Convite-${purpose}.png`, {type: 'image/png'});
}

/** Native sharing is a handoff, never proof of delivery to WhatsApp.
 * @param {File} file
 * @param {string} text
 * @param {Partial<Pick<Navigator, 'share' | 'canShare' | 'userAgent' | 'platform' | 'maxTouchPoints'>>} sharing
 */
export async function shareInvite(file, text, sharing = navigator, desktop = openDesktopInvite) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(sharing.userAgent || '') ||
    (sharing.platform === 'MacIntel' && (sharing.maxTouchPoints || 0) > 1);
  if (sharing.userAgent && !mobile) {
    try { return desktop(file, text); } catch { return 'desktop_failed'; }
  }
  try {
    if (!sharing.share || !sharing.canShare?.({files: [file]})) return 'unsupported';
    await sharing.share({files: [file], text});
    return 'shared';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/** Keep both actions synchronous inside the user's click. No third-party QR service. */
export function openDesktopInvite(file, text, browser = window, page = document, urls = URL) {
  const tab = browser.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  let url;
  try {
    url = urls.createObjectURL(file);
    const anchor = page.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    page.body.append(anchor);
    try { anchor.click(); } finally { anchor.remove(); }
    if (!tab) return 'popup_blocked';
    tab.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    return 'desktop_ready';
  } catch {
    tab?.close();
    return 'desktop_failed';
  } finally {
    if (url) browser.setTimeout(() => urls.revokeObjectURL(url), 60000);
  }
}

export const shareNotices = {
  desktop_ready: 'Download do QR Code iniciado. No WhatsApp, escolha o destinatário, anexe a imagem baixada e confirme que o link acompanha a mensagem antes de enviar.',
  popup_blocked: 'Download do QR Code iniciado, mas a janela do WhatsApp foi bloqueada. Permita pop-ups deste site e clique novamente em Compartilhar QR Code e link.',
  desktop_failed: 'Não foi possível preparar o compartilhamento. Confira a permissão de downloads e pop-ups deste site e tente novamente.',
  shared: 'Convite encaminhado ao aplicativo escolhido. Confira se a imagem e o link estão juntos antes de confirmar o envio.',
  cancelled: 'Compartilhamento cancelado. Você pode tentar novamente.',
  unsupported: 'Este navegador não permite compartilhar QR Code e link juntos. Abra o RBK Digital em um celular com suporte a compartilhamento de arquivos e tente novamente.',
  failed: 'Não foi possível compartilhar. Tente novamente ou abra o RBK Digital em um celular com suporte a compartilhamento de arquivos.',
};
