import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

// Load the fixed attachment and validate configuration before creating an account.
export async function preparePharmacyInvitation(context?: {tipo_convite: "funcionario"; nome: string; perfil: string}) {
  const env = process.env;
  const port = Number(env.INVITE_SMTP_PORT || '587');
  const from = env.INVITE_EMAIL_FROM || '';
  if (!env.INVITE_SMTP_HOST || !env.INVITE_SMTP_USER || !env.INVITE_SMTP_PASSWORD ||
      !/^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(from) || ![465, 587].includes(port)) {
    throw new Error('smtp_not_configured');
  }
  const config = {
    host: env.INVITE_SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: env.INVITE_SMTP_USER, pass: env.INVITE_SMTP_PASSWORD },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000, dnsTimeout: 5000,
    disableFileAccess: true, disableUrlAccess: true, logger: false as const, debug: false,
  };
  const pdf = await readFile(path.join(process.cwd(), 'public/guias/RBK_Digital_Guia_Tela_Inicial.pdf'));
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('invalid_invitation_guide');
  return async (email: string, pharmacy: string, link: string) => {
    const title = 'Tenha o RBK Digital na tela do seu celular';
    const greeting = context ? `${context.nome}, você foi convidado para integrar a equipe da farmácia ${pharmacy}, com o perfil ${context.perfil}.` : `A farmácia ${pharmacy} foi convidada para acessar a RBK Digital.`;
    const text = `Olá!\n\n${greeting}\n\nPara concluir seu cadastro e começar a usar a plataforma, clique no link abaixo:\n\nConcluir meu cadastro: ${link}\n\nEnviamos em anexo o guia “${title}”.\n\nNele, você encontra um passo a passo com imagens para adicionar o RBK Digital à tela inicial do Android ou iPhone. Assim, seus próximos acessos ficam mais fáceis: basta tocar no ícone no celular.\n\nSe precisar de ajuda, entre em contato com nossa equipe.\n\nSeja bem-vindo!\nEquipe RBK Digital`;
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#202326"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-top:4px solid #ff7411" cellspacing="0" cellpadding="0"><tr><td style="padding:28px"><img src="https://rbk-digital.vercel.app/rbk-digital-logo-original.png" width="220" alt="RBK Digital" style="display:block;max-width:100%;height:auto;margin-bottom:28px"><h1 style="font-size:24px">Bem-vindo à RBK Digital!</h1><p>Olá!</p><p>${escapeHtml(greeting)}</p><p>Para concluir seu cadastro e começar a usar a plataforma, clique no botão abaixo:</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#202326;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;display:inline-block;font-weight:bold">Concluir meu cadastro</a></p><div style="background:#fff5e9;border-left:4px solid #ff7411;padding:16px;line-height:1.6"><strong>Guia em PDF anexado a este email</strong><p>Enviamos em anexo o guia “${title}”.</p><p>Nele, você encontra um passo a passo com imagens para adicionar o RBK Digital à tela inicial do <strong>Android ou iPhone</strong>. Assim, seus próximos acessos ficam mais fáceis: basta tocar no ícone no celular.</p></div><p>Se precisar de ajuda, entre em contato com nossa equipe.</p><p>Seja bem-vindo!<br><strong>Equipe RBK Digital</strong></p><p style="font-size:12px;color:#62676b;word-break:break-all">Se o botão não abrir, copie e cole este link no navegador:<br><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p></td></tr></table></td></tr></table></body></html>`;
    const transport = nodemailer.createTransport(config);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        transport.sendMail({
          from: { name: 'RBK Digital', address: from }, to: { address: email, name: '' },
          envelope: { from, to: [email] },
          subject: context ? 'Convite para a equipe da farmácia — RBK Digital' : 'Bem-vindo à RBK Digital! Seu acesso está aqui', text, html,
          attachments: [{ filename: 'RBK_Digital_Guia_Tela_Inicial.pdf', content: pdf, contentType: 'application/pdf' }],
        }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          transport.close(); reject(new Error('smtp_timeout'));
        }, 15000); }),
      ]);
      if (!result.accepted?.length || result.rejected?.length) throw new Error('smtp_rejected');
    } catch {
      // Do not expose the private invitation link, recipient or SMTP response.
      throw new Error('invitation_delivery_failed');
    } finally {
      if (timer) clearTimeout(timer);
      transport.close();
    }
  };
}
