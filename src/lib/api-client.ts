export const ERROR_CODES = [
  'invalid_credentials',
  'account_pending',
  'account_suspended',
  'invalid_input',
  'unauthenticated',
  'forbidden',
  'not_found',
  'rate_limited',
  'bad_origin',
  'internal_error',
  'network',
  'unknown',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ErrorCode; fields: string[]; issues: { field: string; code: string }[] };

function toErrorCode(value: unknown): ErrorCode {
  return (ERROR_CODES as readonly unknown[]).includes(value) ? (value as ErrorCode) : 'unknown';
}

export function postJson<T>(url: string, body: unknown) {
  return sendJson<T>('POST', url, body);
}

export function patchJson<T>(url: string, body: unknown) {
  return sendJson<T>('PATCH', url, body);
}

async function sendJson<T>(method: 'POST' | 'PATCH', url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: 'network', fields: [], issues: [] };
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: data as T };
  return {
    ok: false,
    status: response.status,
    error: toErrorCode(data?.error),
    fields: Array.isArray(data?.fields) ? data.fields.map(String) : [],
    issues: Array.isArray(data?.issues)
      ? data.issues.map((issue: { field?: unknown; code?: unknown }) => ({ field: String(issue.field), code: String(issue.code) }))
      : [],
  };
}
