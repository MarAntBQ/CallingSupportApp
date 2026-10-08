import 'server-only';
import { createTranslator } from 'next-intl';
import enMessages from '../../../messages/en.json';
import esMessages from '../../../messages/es.json';
import ptMessages from '../../../messages/pt.json';
import type { Locale } from '@/i18n/config';
import type { MailMessage } from '@/server/mail/service';
import { escapeHtml } from '@/server/mail/template';
import type { ModuleNotice } from '@/server/notifications/service';

const MESSAGES: Record<Locale, typeof esMessages> = { es: esMessages, pt: ptMessages, en: enMessages };

// Al padre, madre o tutor: un correo por joven con su enlace personal. Puede nombrar a su propio
// hijo (#30, ajuste 38.8.21.2), pero no lleva datos de otros participantes ni el contacto de
// emergencia. El token solo aparece dentro del enlace.
export function accessLinkEmail(to: string, locale: Locale, campName: string, fullName: string, url: string): MailMessage {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'camps.email' });
  const intro = t('intro', { name: fullName, camp: campName });
  return {
    to,
    subject: t('subject', { camp: campName }),
    preheader: t('preheader', { name: fullName }),
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(t('open'))}</a></p><p>${escapeHtml(t('medicalForm'))}</p><p>${escapeHtml(t('keep'))}</p>`,
    text: `${intro}\n\n${t('open')}: ${url}\n\n${t('medicalForm')}\n\n${t('keep')}`,
    locale,
  };
}

// Aviso a organizadores SIN datos de los jóvenes (Manual General 38.8.21.2): solo el conteo, el
// campamento y el enlace al panel.
export function campRegistrationNotice(locale: Locale, campName: string, count: number, panelUrl: string): ModuleNotice {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'camps.notice' });
  return {
    subject: t('subject', { camp: campName }),
    html: `<p>${escapeHtml(t('body', { n: count, camp: campName }))} <a href="${escapeHtml(panelUrl)}">${escapeHtml(t('openPanel'))}</a></p>`,
    telegramText: t('telegram', { n: count, camp: campName }),
  };
}
