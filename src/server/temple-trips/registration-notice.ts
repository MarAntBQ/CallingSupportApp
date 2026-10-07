import 'server-only';
import { createTranslator } from 'next-intl';
import enMessages from '../../../messages/en.json';
import esMessages from '../../../messages/es.json';
import ptMessages from '../../../messages/pt.json';
import type { Locale } from '@/i18n/config';
import type { ModuleNotice } from '@/server/notifications/service';

const MESSAGES: Record<Locale, typeof esMessages> = { es: esMessages, pt: ptMessages, en: enMessages };

// Aviso de nueva inscripción SIN datos de personas (Manual General 38.8.21.2): solo el número
// de inscripciones nuevas y el enlace al panel. Por diseño solo recibe el conteo y la URL, así
// que nunca puede incluir nombres, cédulas, teléfonos ni correos.
export function registrationNotice(locale: Locale, count: number, panelUrl: string): ModuleNotice {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'templeTrips.notice' });
  return {
    subject: t('subject'),
    html: `<p>${t('body', { n: count })} <a href="${panelUrl}">${t('openPanel')}</a></p>`,
    telegramText: t('telegram', { n: count }),
  };
}
