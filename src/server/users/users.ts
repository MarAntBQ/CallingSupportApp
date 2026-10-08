import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { LEADER_LEVEL } from '@/lib/modules';
import type { CreateUserInput, UpdateUserInput } from '@/lib/validation/users';
import { hashPassword } from '@/server/auth/crypto';
import { revokeAllUserSessions } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import { appConfig, callings, organizations, roles, userCallings, users } from '@/server/db/schema';
import { sendMail, type MailMessage } from '@/server/mail/service';
import { inviteEmail } from './invite-email';
import { generateTempPassword } from './password';

// Un llamamiento solo lo llevan los roles de líder (LEADER_LEVEL, 50). Miembro (10) y Amigo (5) no.

type Mailer = (source: string, message: MailMessage) => Promise<unknown>;
const defaultMailer: Mailer = (source, message) => sendMail(source, message);

export type CallingRef = { id: string; name: string; organization: { id: string; name: string } };
export type UserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'active' | 'suspended';
  locale: string | null;
  callingLabel: string | null;
  role: { id: string; key: string; name: string; level: number };
  telegramLinked: boolean;
  callings: CallingRef[];
  organizations: { id: string; name: string }[];
};

// Lista sin campos sensibles (sin hash de contraseña, OTP ni tokens de reset). telegramLinked es
// false hasta que #17 agregue el vínculo de Telegram.
export async function listUsers(db: Database): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      status: users.status,
      locale: users.locale,
      callingLabel: users.callingLabel,
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
      roleLevel: roles.level,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(asc(users.lastName), asc(users.firstName));

  const links = await db
    .select({ userId: userCallings.userId, callingId: callings.id, callingName: callings.name, orgId: organizations.id, orgName: organizations.name })
    .from(userCallings)
    .innerJoin(callings, eq(userCallings.callingId, callings.id))
    .innerJoin(organizations, eq(callings.organizationId, organizations.id));

  const byUser = new Map<string, CallingRef[]>();
  for (const link of links) {
    const list = byUser.get(link.userId) ?? [];
    list.push({ id: link.callingId, name: link.callingName, organization: { id: link.orgId, name: link.orgName } });
    byUser.set(link.userId, list);
  }

  return rows.map((row) => {
    const userCallingList = (byUser.get(row.id) ?? []).sort((a, b) => a.organization.name.localeCompare(b.organization.name) || a.name.localeCompare(b.name));
    const orgs = new Map<string, { id: string; name: string }>();
    for (const calling of userCallingList) orgs.set(calling.organization.id, calling.organization);
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      locale: row.locale,
      callingLabel: row.callingLabel,
      role: { id: row.roleId, key: row.roleKey, name: row.roleName, level: row.roleLevel },
      telegramLinked: false,
      callings: userCallingList,
      organizations: [...orgs.values()],
    };
  });
}

// Valida que los llamamientos existan y estén activos (defensa en el servidor: el cliente solo
// muestra los activos, pero una petición directa podría enviar otros).
async function validActiveCallings(db: Database, callingIds: string[]): Promise<boolean> {
  const unique = [...new Set(callingIds)];
  if (unique.length === 0) return true;
  const found = await db.select({ id: callings.id }).from(callings).where(and(inArray(callings.id, unique), eq(callings.active, true)));
  return found.length === unique.length;
}

export type CreateUserResult = { ok: true; id: string } | { ok: false; status: 400; code: 'email_taken' | 'role_not_found' | 'invalid_calling' };

export async function createUser(db: Database, input: CreateUserInput, options: { baseUrl: string; mailer?: Mailer }): Promise<CreateUserResult> {
  const mailer = options.mailer ?? defaultMailer;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) return { ok: false, status: 400, code: 'email_taken' };
  const [role] = await db.select({ level: roles.level }).from(roles).where(eq(roles.id, input.roleId)).limit(1);
  if (!role) return { ok: false, status: 400, code: 'role_not_found' };

  const desired = role.level >= LEADER_LEVEL ? [...new Set(input.callingIds ?? [])] : [];
  if (!(await validActiveCallings(db, desired))) return { ok: false, status: 400, code: 'invalid_calling' };

  const passwordHash = await hashPassword(generateTempPassword());
  const [config] = await db.select({ defaultLocale: appConfig.defaultLocale }).from(appConfig).where(eq(appConfig.id, 1)).limit(1);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        roleId: input.roleId,
        callingLabel: input.callingLabel ?? null,
        status: 'active',
        locale: input.locale ?? null,
        passwordHash,
      })
      .returning({ id: users.id });
    if (desired.length > 0) await tx.insert(userCallings).values(desired.map((callingId) => ({ userId: created!.id, callingId })));
    return created!.id;
  });

  const link = `${options.baseUrl}/forgot-password?email=${encodeURIComponent(input.email)}`;
  await mailer('users-invite', inviteEmail(input.email, link, config?.defaultLocale ?? 'es'));
  return { ok: true, id };
}

export type UpdateUserResult = { ok: true } | { ok: false; status: 404 } | { ok: false; status: 400; code: 'role_not_found' | 'invalid_calling' };

export async function updateUser(db: Database, id: string, input: UpdateUserInput): Promise<UpdateUserResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: users.id, roleId: users.roleId }).from(users).where(eq(users.id, id)).limit(1);
    if (!current) return { ok: false, status: 404 } as const;
    const effectiveRoleId = input.roleId ?? current.roleId;
    const [role] = await tx.select({ level: roles.level }).from(roles).where(eq(roles.id, effectiveRoleId)).limit(1);
    if (!role) return { ok: false, status: 400, code: 'role_not_found' } as const;

    // Invariante: un rol por debajo de líder nunca conserva llamamientos.
    if (role.level < LEADER_LEVEL) {
      await tx.delete(userCallings).where(eq(userCallings.userId, id));
    } else if (input.callingIds !== undefined) {
      const desired = [...new Set(input.callingIds)];
      if (!(await validActiveCallings(tx, desired))) return { ok: false, status: 400, code: 'invalid_calling' } as const;
      await tx.delete(userCallings).where(eq(userCallings.userId, id));
      if (desired.length > 0) await tx.insert(userCallings).values(desired.map((callingId) => ({ userId: id, callingId })));
    }

    await tx
      .update(users)
      .set({
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.callingLabel !== undefined ? { callingLabel: input.callingLabel } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
      })
      .where(eq(users.id, id));

    if (input.status === 'suspended') await revokeAllUserSessions(tx, id);
    return { ok: true } as const;
  });
}

export type ResetPasswordResult = { ok: true; password: string } | { ok: false; status: 404 };

// Genera una contraseña temporal, la guarda, revoca las sesiones y la devuelve UNA vez (para
// entregarla en persona; no se envía por correo).
export async function resetPassword(db: Database, id: string): Promise<ResetPasswordResult> {
  const password = generateTempPassword();
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const updated = await tx.update(users).set({ passwordHash }).where(eq(users.id, id)).returning({ id: users.id });
    if (updated.length === 0) return { ok: false, status: 404 } as const;
    await revokeAllUserSessions(tx, id);
    return { ok: true, password } as const;
  });
}

export type WardCouncilGroup = { organization: { id: string; name: string }; leaders: { id: string; name: string; email: string; calling: string }[] };

// Consejo de barrio: una entrada por organización activa (aunque no tenga líderes), con sus
// líderes (personas asignadas a un llamamiento activo de esa organización).
export async function listWardCouncil(db: Database): Promise<WardCouncilGroup[]> {
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.active, true))
    .orderBy(asc(organizations.name));

  const rows = await db
    .select({ orgId: organizations.id, callingName: callings.name, userId: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(organizations)
    .innerJoin(callings, and(eq(callings.organizationId, organizations.id), eq(callings.active, true)))
    .innerJoin(userCallings, eq(userCallings.callingId, callings.id))
    .innerJoin(users, eq(userCallings.userId, users.id))
    .where(eq(organizations.active, true))
    .orderBy(asc(users.lastName), asc(users.firstName));

  const byOrg = new Map<string, WardCouncilGroup['leaders']>();
  for (const row of rows) {
    const list = byOrg.get(row.orgId) ?? [];
    list.push({ id: row.userId, name: `${row.firstName} ${row.lastName}`, email: row.email, calling: row.callingName });
    byOrg.set(row.orgId, list);
  }

  return orgs.map((org) => ({ organization: org, leaders: byOrg.get(org.id) ?? [] }));
}
