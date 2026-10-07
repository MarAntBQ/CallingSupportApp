import 'server-only';
import { waitUntil } from '@vercel/functions';
import { sendMail } from '@/server/mail/service';
import type { Mailer } from './registration';

export const backgroundMailer: Mailer = async (source, message) => {
  waitUntil(sendMail(source, message));
};
