export const MAIL_ERROR_CODES = ['smtp_not_configured', 'smtp_password_unreadable', 'smtp_host_not_allowed', 'invalid_message'] as const;

export type MailErrorCode = (typeof MAIL_ERROR_CODES)[number];

export function knownMailError(value: string | null | undefined): MailErrorCode | undefined {
  return MAIL_ERROR_CODES.find((code) => code === value);
}
