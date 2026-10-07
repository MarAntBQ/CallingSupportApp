export type RawResult = { status: number; body: Record<string, unknown> | null };

export async function postRaw(url: string, payload: unknown): Promise<RawResult> {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}

export function issueCode(body: Record<string, unknown> | null) {
  const issues = Array.isArray(body?.issues) ? (body.issues as { code?: unknown }[]) : [];
  return typeof issues[0]?.code === 'string' ? issues[0].code : undefined;
}
