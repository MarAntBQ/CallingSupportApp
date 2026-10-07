import 'server-only';

// Verifica el token de reCAPTCHA en el servidor SOLO si RECAPTCHA_SECRET_KEY está configurada.
// Sin la clave, el formulario funciona sin reCAPTCHA (devuelve true). Con la clave, un token
// ausente o inválido devuelve false. La v1 recibía el token y lo ignoraba; aquí se verifica.
export async function verifyRecaptcha(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return data?.success === true;
  } catch {
    return false;
  }
}
