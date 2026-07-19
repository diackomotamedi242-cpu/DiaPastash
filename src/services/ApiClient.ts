/**
 * ApiClient — the ONLY REST transport to the secure backend.
 * ---------------------------------------------------------------------------
 * • Every request uses `credentials: "include"` so the browser sends the
 *   HttpOnly session cookie set by the backend. The cookie is NEVER read or
 *   managed here (it can't be — it's HttpOnly).
 * • No credentials, tokens, broker addresses or MQTT topics exist in this file.
 * • Emits raw traces to a sink so the Packet Tracer panel can show HTTP I/O.
 */
import { API_BASE_URL } from "../config";
import type { TraceDir, TraceEntry } from "../types";

export type TraceSink = (dir: TraceDir, kind: string, data?: Partial<TraceEntry>) => void;

let sink: TraceSink | null = null;
export function setApiTraceSink(s: TraceSink | null): void {
  sink = s;
}
function trace(dir: TraceDir, kind: string, data?: Partial<TraceEntry>): void {
  sink?.(dir, kind, data);
}

/** Typed error carrying the HTTP status (0 = network failure). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Core fetch wrapper: JSON in/out, credentials always included, traced. */
async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method as string) || "GET";
  const url = `${API_BASE_URL}${path}`;
  trace("tx", method, { detail: path });

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      ...init,
      method,
    });
  } catch {
    trace("sys", "ERROR", { detail: `network ${method} ${path}` });
    throw new ApiError(0, "network");
  }

  const raw = await res.text();
  let body: ApiEnvelope<T> | T | string | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  trace("rx", res.ok ? "OK" : String(res.status), {
    detail: path,
    payload: raw ? raw.slice(0, 400) : "",
  });

  if (!res.ok) {
    const env = body as ApiEnvelope<T> | null;
    const msg = env && typeof env === "object" && env.error ? env.error : `${res.status}`;
    throw new ApiError(res.status, msg);
  }

  // Unwrap `{ success, data }` envelopes; pass through everything else.
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

export const api = {
  /** POST /auth/login → backend sets the HttpOnly cookie. */
  login: (username: string, password: string) =>
    request<{ username?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  /** POST /auth/logout → backend clears the cookie. */
  logout: () => request("/auth/logout", { method: "POST" }),

  /** GET /auth/me → probe the existing session. 401 means logged out. */
  me: () => request<{ username?: string }>("/auth/me"),

  /** GET /system/state → { securityState, deviceOnline, ... }. */
  getSystemState: () => request<Record<string, unknown>>("/system/state"),

  /** POST /system/commands → { command: "arm" | "disarm" | "silence" }. */
  sendCommand: (command: "arm" | "disarm" | "silence") =>
    request<Record<string, unknown>>("/system/commands", {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
};
