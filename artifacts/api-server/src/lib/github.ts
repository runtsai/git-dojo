import { ReplitConnectors } from "@replit/connectors-sdk";

/**
 * Thin wrapper over the Replit GitHub connector proxy. Never cache the
 * connectors client — tokens expire, so a fresh instance is created per call.
 * Paths are relative to https://api.github.com.
 */
export async function ghFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const connectors = new ReplitConnectors();
  const opts: { method: string; headers?: Record<string, string>; body?: string } = {
    method: init?.method ?? "GET",
  };
  if (init?.body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(init.body);
  }
  return connectors.proxy("github", path, opts);
}

export interface GhResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage: string | null;
}

/** Fetch + JSON parse with honest error reporting. Network/auth failures return ok=false. */
export async function ghJson<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<GhResult<T>> {
  try {
    const res = await ghFetch(path, init);
    let data: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : `GitHub API returned ${res.status}`;
      return { ok: false, status: res.status, data: null, errorMessage: msg };
    }
    return { ok: true, status: res.status, data: data as T, errorMessage: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "GitHub connection unavailable";
    return { ok: false, status: 0, data: null, errorMessage: msg };
  }
}

/** Returns the connected GitHub login, or null when no account is connected. */
export async function getConnectedLogin(): Promise<string | null> {
  const res = await ghJson<{ login: string }>("/user");
  return res.ok && res.data ? res.data.login : null;
}
