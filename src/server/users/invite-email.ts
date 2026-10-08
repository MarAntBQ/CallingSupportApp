import 'server-only';
import { emailTranslator, type MailMessage } from '@/server/mail/service';
import { escapeHtml } from '@/server/mail/template';

// Correo "Establece tu contraseña" al crear un usuario (#16). No lleva contraseña: lleva un enlace
// al flujo de recuperación (#11) para que la persona fije la suya. Va en el idioma de la unidad.
export function inviteEmail(to: string, link: string, locale: string | null): MailMessage {
  const t = emailTranslator(locale ?? undefined);
  const button = `<p style="margin:20px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(t('auth.inviteCta'))}</a></p>`;
  return {
    to,
    subject: t('auth.inviteSubject'),
    preheader: t('auth.invitePreheader'),
    html: `<p>${escapeHtml(t('auth.inviteIntro'))}</p>${button}<p>${escapeHtml(t('auth.inviteOutro'))}</p>`,
    text: `${t('auth.inviteIntro')}\n\n${link}\n\n${t('auth.inviteOutro')}`,
    locale: locale ?? undefined,
  };
}
