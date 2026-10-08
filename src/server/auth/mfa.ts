import 'server-only';
import { createHash, randomInt } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { appEnv } from '@/lib/app-env';
import { GLOBAL_ADMIN_LEVEL } from '@/lib/modules';
import { RECOVERY_CODE_ALPHABET, RECOVERY_CODE_COUNT, normalizeRecoveryCode } from '@/lib/validation/mfa';
import { decrypt, encrypt } from '@/server/crypto/aes';
import type { Database } from '@/server/db';
import { appConfig, mfaChallenges, userRecoveryCodes, users } from '@/server/db/schema';
import { allowedModules } from '@/server/permissions/service';
import { mfaNoticeEmail } from './auth-emails';
import { verifyPassword } from './crypto';
import { AuthError } from './errors';
import type { Mailer } from './registration';
import { revokeAllUserSessions, revokeOtherSessions, type Session } from './sessions';

// TOTP estándar (RFC 6238): SHA-1, 6 dígitos, pasos de 30 segundos, tolerancia de ±1 paso.
const PERIOD_SECONDS = 30;
const WINDOW_STEPS = 1;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const CHALLENGE_MAX_ATTEMPTS = 5;
const ISSUER = 'CallingSupportApp';

type Options = { mailer?: Mailer; now?: Date };

const isDemo = () => appEnv() === 'demo';

function totp(secretBase32: string, label = '') {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  });
}

// Devuelve el paso de tiempo del código si es válido y posterior al último aceptado; si no, null.
export function acceptedStep(secretBase32: string, code: string, now: Date, lastStep: number | null) {
  const delta = totp(secretBase32).validate({ token: code, timestamp: now.getTime(), window: WINDOW_STEPS });
  if (delta === null) return null;
  const step = Math.floor(now.getTime() / 1000 / PERIOD_SECONDS) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

export function hashRecoveryCode(code: string) {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

function generateRecoveryCode() {
  const pick = () => RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join('');
  return `${part()}-${part()}`;
}

async function replaceRecoveryCodes(db: Pick<Database, 'insert' | 'delete'>, userId: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
  await db.insert(userRecoveryCodes).values(codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })));
  return codes;
}

export type MfaStatus = { enabled: boolean; required: boolean; recommended: boolean; demo: boolean };

// Quién debe tenerla: el SuperAdmin siempre; quien tiene algún módulo, recomendada, u obligatoria si
// la instalación lo exige. En la demo pública (cuentas compartidas) no se exige ni se activa.
export async function mfaStatus(db: Database, session: Session): Promise<MfaStatus> {
  const [row] = await db.select({ enabled: users.mfaEnabled }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const enabled = row?.enabled ?? false;
  if (isDemo()) return { enabled, required: false, recommended: false, demo: true };
  if (session.user.role.level >= GLOBAL_ADMIN_LEVEL) return { enabled, required: true, recommended: false, demo: false };
  const modules = await allowedModules(db, session.user);
  if (modules.length === 0) return { enabled, required: false, recommended: false, demo: false };
  const [config] = await db.select({ require: appConfig.requireMfaForLeaders }).from(appConfig).where(eq(appConfig.id, 1)).limit(1);
  const required = config?.require ?? false;
  return { enabled, required, recommended: !required, demo: false };
}

// Candado del panel: sin la verificación activa, quien la tiene obligatoria no usa ningún endpoint.
export async function assertMfaSatisfied(db: Database, session: Session) {
  if (session.mfaEnabled) return;
  const status = await mfaStatus(db, session);
  if (status.required && !status.enabled) throw new AuthError(403, 'mfa_required');
}

export async function startMfaSetup(db: Database, session: Session, unitName: string) {
  if (isDemo()) throw new AuthError(403, 'mfa_disabled_in_demo');
  const [row] = await db.select({ enabled: users.mfaEnabled }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (row?.enabled) throw new AuthError(409, 'mfa_already_enabled');
  const secret = new Secret({ size: 20 }).base32;
  await db.update(users).set({ mfaSecretEnc: encrypt(secret), mfaLastStep: null }).where(eq(users.id, session.user.id));
  const issuer = unitName.trim() ? `${ISSUER} (${unitName.trim()})` : ISSUER;
  const uri = new TOTP({
    issuer,
    label: session.user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secret),
  }).toString();
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { qrSvg, secret };
}

export async function enableMfa(db: Database, session: Session, code: string, options: Options = {}) {
  if (isDemo()) throw new AuthError(403, 'mfa_disabled_in_demo');
  const now = options.now ?? new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ enabled: users.mfaEnabled, secretEnc: users.mfaSecretEnc, lastStep: users.mfaLastStep })
      .from(users)
      .where(eq(users.id, session.user.id))
      .for('update')
      .limit(1);
    if (!row) return { ok: false as const, error: 'not_found' as const };
    if (row.enabled) return { ok: false as const, error: 'mfa_already_enabled' as const };
    if (!row.secretEnc) return { ok: false as const, error: 'mfa_not_started' as const };
    const step = acceptedStep(decrypt(row.secretEnc), code, now, row.lastStep);
    if (step === null) return { ok: false as const, error: 'invalid_code' as const };
    await tx
      .update(users)
      .set({ mfaEnabled: true, mfaLastStep: step, mfaEnabledAt: now })
      .where(eq(users.id, session.user.id));
    const codes = await replaceRecoveryCodes(tx, session.user.id);
    await revokeOtherSessions(tx as unknown as Database, session.user.id, session.id, now);
    return { ok: true as const, codes };
  });
  if (result.ok && options.mailer) {
    await options.mailer('auth-mfa-enabled', mfaNoticeEmail('enabled', session.user.email, session.user.locale));
  }
  return result;
}

// Valida un código TOTP o uno de recuperación de un usuario dentro de una transacción ya abierta.
// Marca el paso o el código usado; devuelve qué tipo sirvió, o null si ninguno.
async function consumeSecondFactor(
  tx: Database,
  userId: string,
  input: { code?: string; recoveryCode?: string },
  now: Date,
): Promise<'totp' | 'recovery' | null> {
  const [row] = await tx
    .select({ secretEnc: users.mfaSecretEnc, lastStep: users.mfaLastStep, enabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
    .limit(1);
  if (!row?.enabled || !row.secretEnc) return null;
  if (input.code) {
    const step = acceptedStep(decrypt(row.secretEnc), input.code, now, row.lastStep);
    if (step === null) return null;
    await tx.update(users).set({ mfaLastStep: step }).where(eq(users.id, userId));
    return 'totp';
  }
  if (input.recoveryCode) {
    const [used] = await tx
      .update(userRecoveryCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(userRecoveryCodes.userId, userId),
          eq(userRecoveryCodes.codeHash, hashRecoveryCode(input.recoveryCode)),
          isNull(userRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: userRecoveryCodes.id });
    return used ? 'recovery' : null;
  }
  return null;
}

const looksLikeTotp = (value: string) => /^\d{6}$/.test(value.trim());

export async function disableMfa(
  db: Database,
  session: Session,
  input: { password: string; code: string },
  options: Options = {},
) {
  const now = options.now ?? new Date();
  const status = await mfaStatus(db, session);
  if (status.required) throw new AuthError(403, 'mfa_required');
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!(await verifyPassword(input.password, user?.passwordHash))) return { ok: false as const, error: 'invalid_password' as const };
  const result = await db.transaction(async (tx) => {
    const factor = await consumeSecondFactor(
      tx as unknown as Database,
      session.user.id,
      looksLikeTotp(input.code) ? { code: input.code.trim() } : { recoveryCode: input.code },
      now,
    );
    if (!factor) return { ok: false as const, error: 'invalid_code' as const };
    await tx
      .update(users)
      .set({ mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null, mfaEnabledAt: null })
      .where(eq(users.id, session.user.id));
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, session.user.id));
    await revokeOtherSessions(tx as unknown as Database, session.user.id, session.id, now);
    return { ok: true as const };
  });
  if (result.ok && options.mailer) {
    await options.mailer('auth-mfa-disabled', mfaNoticeEmail('disabled', session.user.email, session.user.locale));
  }
  return result;
}

export async function regenerateRecoveryCodes(db: Database, session: Session, code: string, options: Options = {}) {
  const now = options.now ?? new Date();
  return db.transaction(async (tx) => {
    const factor = await consumeSecondFactor(tx as unknown as Database, session.user.id, { code }, now);
    if (factor !== 'totp') return { ok: false as const, error: 'invalid_code' as const };
    return { ok: true as const, codes: await replaceRecoveryCodes(tx, session.user.id) };
  });
}

export async function createMfaChallenge(db: Database, userId: string, rememberMe: boolean, now = new Date()) {
  await db.delete(mfaChallenges).where(lt(mfaChallenges.expiresAt, now));
  const [row] = await db
    .insert(mfaChallenges)
    .values({ userId, rememberMe, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) })
    .returning({ id: mfaChallenges.id });
  return row!.id;
}

export type VerifyChallengeResult =
  | { ok: true; userId: string; rememberMe: boolean; factor: 'totp' | 'recovery'; email: string; locale: string | null }
  | { ok: false; error: 'challenge_expired' | 'invalid_code' }
  | { ok: false; error: 'too_many_attempts' };

export async function verifyMfaChallenge(
  db: Database,
  input: { challengeId: string; code?: string; recoveryCode?: string },
  options: Options = {},
): Promise<VerifyChallengeResult> {
  const now = options.now ?? new Date();
  const result = await db.transaction(async (tx): Promise<VerifyChallengeResult> => {
    const [challenge] = await tx
      .select({
        id: mfaChallenges.id,
        userId: mfaChallenges.userId,
        rememberMe: mfaChallenges.rememberMe,
        attempts: mfaChallenges.attempts,
        expiresAt: mfaChallenges.expiresAt,
      })
      .from(mfaChallenges)
      .where(eq(mfaChallenges.id, input.challengeId))
      .for('update')
      .limit(1);
    if (!challenge) return { ok: false, error: 'challenge_expired' };
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await tx.delete(mfaChallenges).where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, error: 'challenge_expired' };
    }
    if (challenge.attempts >= CHALLENGE_MAX_ATTEMPTS) {
      await tx.delete(mfaChallenges).where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, error: 'too_many_attempts' };
    }
    const [user] = await tx
      .select({ status: users.status, email: users.email, locale: users.locale })
      .from(users)
      .where(eq(users.id, challenge.userId))
      .limit(1);
    if (user?.status !== 'active') {
      await tx.delete(mfaChallenges).where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, error: 'challenge_expired' };
    }
    const factor = await consumeSecondFactor(tx as unknown as Database, challenge.userId, input, now);
    if (!factor) {
      await tx
        .update(mfaChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, error: 'invalid_code' };
    }
    await tx.delete(mfaChallenges).where(eq(mfaChallenges.id, challenge.id));
    return { ok: true, userId: challenge.userId, rememberMe: challenge.rememberMe, factor, email: user.email, locale: user.locale };
  });
  if (result.ok && result.factor === 'recovery' && options.mailer) {
    await options.mailer('auth-mfa-recovery-used', mfaNoticeEmail('recoveryUsed', result.email, result.locale));
  }
  return result;
}

// Restablecimiento por un SuperAdmin (quien perdió el teléfono y sus códigos). No vale para sí mismo.
export async function resetUserMfa(db: Database, admin: Session, targetUserId: string, options: Options = {}) {
  const now = options.now ?? new Date();
  if (targetUserId === admin.user.id) throw new AuthError(403, 'forbidden');
  const [self] = await db.select({ enabled: users.mfaEnabled }).from(users).where(eq(users.id, admin.user.id)).limit(1);
  if (!self?.enabled) throw new AuthError(403, 'mfa_required');
  const target = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({ mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null, mfaEnabledAt: null })
      .where(eq(users.id, targetUserId))
      .returning({ email: users.email, locale: users.locale });
    if (!row) return null;
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, targetUserId));
    await tx.delete(mfaChallenges).where(eq(mfaChallenges.userId, targetUserId));
    await revokeAllUserSessions(tx as unknown as Database, targetUserId, now);
    return row;
  });
  if (!target) throw new AuthError(404, 'not_found');
  if (options.mailer) await options.mailer('auth-mfa-reset', mfaNoticeEmail('reset', target.email, target.locale));
}

export async function getMfaPolicy(db: Database) {
  const [row] = await db.select({ require: appConfig.requireMfaForLeaders }).from(appConfig).where(eq(appConfig.id, 1)).limit(1);
  return { requireMfaForLeaders: row?.require ?? false };
}

export async function setMfaPolicy(db: Database, requireMfaForLeaders: boolean) {
  await db
    .insert(appConfig)
    .values({ id: 1, requireMfaForLeaders })
    .onConflictDoUpdate({ target: appConfig.id, set: { requireMfaForLeaders, updatedAt: new Date() } });
  return { requireMfaForLeaders };
}
