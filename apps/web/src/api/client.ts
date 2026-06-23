import type { ApiErrorBody } from '@acme/shared';
import { supabase } from '../lib/supabase';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Build the Authorization header from the current Supabase session, if
// any. Public endpoints (e.g. /health) work either way; protected
// endpoints (/api/*) get 401 without one.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ApiFetchInit = Omit<RequestInit, 'body'> & { body?: BodyInit | object };

export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData) && typeof init.body !== 'string'
      ? { 'content-type': 'application/json' }
      : {}),
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const body =
    init.body && typeof init.body === 'object' && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : (init.body as BodyInit | undefined);

  // Build the fetch init without including `body` when undefined, so we
  // don't trip exactOptionalPropertyTypes (which rejects body: undefined).
  const { body: _omit, ...rest } = init;
  const requestInit: RequestInit = { ...rest, headers };
  if (body !== undefined) requestInit.body = body;

  const res = await fetch(`${baseUrl}${path}`, requestInit);

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Body is not JSON; leave as string for the caller.
      parsed = text;
    }
  }

  if (!res.ok) {
    const body = (parsed as ApiErrorBody) ?? null;
    throw new ApiError(body?.message ?? `API ${res.status} on ${path}`, res.status, body);
  }

  return parsed as T;
}
