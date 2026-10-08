import 'server-only';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { AuthError } from './errors';
import { assertMfaSatisfied } from './mfa';
import { getSession } from './session';
import type { Session } from './sessions';

export const MFA_SETUP_PATH = '/admin/profile/security';

// Sesión para las páginas del panel. Sin sesión → /login. Si la verificación en dos pasos es
// obligatoria y no está activa (#36) → a activarla. Se llama en CADA página, no en el layout: en el
// App Router el layout no se vuelve a ejecutar al navegar entre páginas.
export async function getPanelSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  try {
    await assertMfaSatisfied(getDb(), session);
  } catch (error) {
    if (error instanceof AuthError && error.code === 'mfa_required') redirect(MFA_SETUP_PATH);
    throw error;
  }
  return session;
}
