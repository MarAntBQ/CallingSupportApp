import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { MAX_OTP_TRIES, RESET_WINDOW_MINUTES, type RegisterInput } from '@/lib/validation/registration';
import type { Database } from '@/server/db';
import { appConfig, roles, sessions, users } from '@/server/db/schema';
import { sendMail, type MailMessage } from '@/server/mail/service';
import { passwordChangedEmail, resetCodeEmail, verificationEmail } from './auth-emails';
import { hashPassword } from './crypto';
import { generateOtpCode, generateResetToken, hashOtp, hashResetToken, otpMatches, resetTokenMatches } from './otp';

export type Mailer = (source: string, message: MailMessage) => Promise<unknown>;

type Options = { mailer?: Mailer; now?: Date };

const defaultMailer: Mailer = (source, message) => sendMail(source, message);

export type RegisterResult = { ok: true } | { ok: false; reason: 'registration_closed' | 'email_taken' };

export async function register(db: Database, input: RegisterInput, options: Options = {}): Promise<RegisterResult> {
  const mailer = options.mailer ?? defaultMailer;
  const [config] = await db.select({ allow: appConfig.allowRegistration, policyVersion: appConfig.policyVersion }).from(appConfig).limit(1);
  if (!config?.allow) return { ok: false, reason: 'registration_closed' };

  const passwordHash = await hashPassword(input.password);
  const code = generateOtpCode();
  const created = await db.transaction(async (tx) => {
    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, 'member')).limit(1);
    if (!role) throw new Error('Falta el rol member: corre las migraciones.');
    const [user] = await tx
      .insert(users)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        roleId: role.id,
        status: 'pending',
        locale: input.locale,
        consentAt: options.now ?? new Date(),
        consentPolicyVersion: config.policyVersion,
        consentLocale: input.locale,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!user) return null;
    await tx.update(users).set({ otpHash: hashOtp(user.id, code), otpTries: 0 }).where(eq(users.id, user.id));
    return user;
  });
  if (!created) return { ok: false, reason: 'email_taken' };
  await mailer('auth-register', verificationEmail(input.email, code, input.locale));
  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_active' | 'code_renewed' }
  | { ok: false; reason: 'wrong_code'; remaining: number };

export async function verifyOtp(db: Database, input: { email: string; code: string }, options: Options = {}): Promise<VerifyOtpResult> {
  const mailer = options.mailer ?? defaultMailer;
  let renewedCode: string | null = null;
  let locale: string | null = null;
  const result = await db.transaction(async (tx): Promise<VerifyOtpResult> => {
    const [user] = await tx
      .select({ id: users.id, status: users.status, otpHash: users.otpHash, otpTries: users.otpTries, locale: users.locale })
      .from(users)
      .where(eq(users.email, input.email))
      .for('update')
      .limit(1);
    if (!user) return { ok: false, reason: 'not_found' };
    if (user.status !== 'pending') return { ok: false, reason: 'already_active' };
    if (!user.otpHash || user.otpTries >= MAX_OTP_TRIES) {
      renewedCode = generateOtpCode();
      locale = user.locale;
      await tx.update(users).set({ otpHash: hashOtp(user.id, renewedCode), otpTries: 0 }).where(eq(users.id, user.id));
      return { ok: false, reason: 'code_renewed' };
    }
    if (!otpMatches(user.id, input.code, user.otpHash)) {
      const tries = user.otpTries + 1;
      if (tries >= MAX_OTP_TRIES) {
        renewedCode = generateOtpCode();
        locale = user.locale;
        await tx.update(users).set({ otpHash: hashOtp(user.id, renewedCode), otpTries: 0 }).where(eq(users.id, user.id));
        return { ok: false, reason: 'code_renewed' };
      }
      await tx.update(users).set({ otpTries: tries }).where(eq(users.id, user.id));
      return { ok: false, reason: 'wrong_code', remaining: MAX_OTP_TRIES - tries };
    }
    await tx.update(users).set({ status: 'active', otpHash: null, otpTries: 0 }).where(eq(users.id, user.id));
    return { ok: true };
  });
  if (renewedCode) await mailer('auth-verify-otp', verificationEmail(input.email, renewedCode, locale));
  return result;
}

export async function forgotPassword(db: Database, input: { email: string }, options: Options = {}) {
  const mailer = options.mailer ?? defaultMailer;
  const code = generateOtpCode();
  const [user] = await db
    .update(users)
    .set({
      resetOtpHash: sql`encode(sha256(convert_to(${users.id}::text || ':' || ${code}, 'UTF8')), 'hex')`,
      resetOtpTries: 0,
      resetVerifiedAt: null,
      resetTokenHash: null,
    })
    .where(and(eq(users.email, input.email), eq(users.status, 'active')))
    .returning({ locale: users.locale });
  if (user) await mailer('auth-forgot-password', resetCodeEmail(input.email, code, user.locale));
}

export type VerifyResetResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no_pending_code' | 'too_many_tries' }
  | { ok: false; reason: 'wrong_code'; remaining: number };

export async function verifyResetOtp(
  db: Database,
  input: { email: string; code: string },
  options: Options = {},
): Promise<VerifyResetResult> {
  return db.transaction(async (tx): Promise<VerifyResetResult> => {
    const [user] = await tx
      .select({ id: users.id, resetOtpHash: users.resetOtpHash, resetOtpTries: users.resetOtpTries })
      .from(users)
      .where(and(eq(users.email, input.email), eq(users.status, 'active')))
      .for('update')
      .limit(1);
    if (!user?.resetOtpHash) return { ok: false, reason: 'no_pending_code' };
    if (user.resetOtpTries >= MAX_OTP_TRIES) {
      await tx.update(users).set({ resetOtpHash: null, resetOtpTries: 0 }).where(eq(users.id, user.id));
      return { ok: false, reason: 'too_many_tries' };
    }
    if (!otpMatches(user.id, input.code, user.resetOtpHash)) {
      const tries = user.resetOtpTries + 1;
      if (tries >= MAX_OTP_TRIES) {
        await tx.update(users).set({ resetOtpHash: null, resetOtpTries: 0 }).where(eq(users.id, user.id));
        return { ok: false, reason: 'too_many_tries' };
      }
      await tx.update(users).set({ resetOtpTries: tries }).where(eq(users.id, user.id));
      return { ok: false, reason: 'wrong_code', remaining: MAX_OTP_TRIES - tries };
    }
    const token = generateResetToken();
    await tx
      .update(users)
      .set({ resetOtpHash: null, resetOtpTries: 0, resetVerifiedAt: options.now ?? new Date(), resetTokenHash: hashResetToken(token) })
      .where(eq(users.id, user.id));
    return { ok: true, token };
  });
}

export async function resetPassword(
  db: Database,
  input: { email: string; token: string; newPassword: string },
  options: Options = {},
): Promise<{ ok: boolean }> {
  const mailer = options.mailer ?? defaultMailer;
  const now = options.now ?? new Date();
  const passwordHash = await hashPassword(input.newPassword);
  const changed = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, verifiedAt: users.resetVerifiedAt, tokenHash: users.resetTokenHash, locale: users.locale })
      .from(users)
      .where(and(eq(users.email, input.email), eq(users.status, 'active')))
      .for('update')
      .limit(1);
    const fresh = user?.verifiedAt && now.getTime() - user.verifiedAt.getTime() < RESET_WINDOW_MINUTES * 60 * 1000;
    if (!user || !fresh || !resetTokenMatches(input.token, user.tokenHash)) return null;
    await tx
      .update(users)
      .set({ passwordHash, resetVerifiedAt: null, resetTokenHash: null, resetOtpHash: null, resetOtpTries: 0 })
      .where(eq(users.id, user.id));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    return user;
  });
  if (!changed) return { ok: false };
  await mailer('auth-reset-password', passwordChangedEmail(input.email, changed.locale));
  return { ok: true };
}
