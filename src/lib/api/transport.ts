import type { ProjectRequestContext } from "./types";

export function projectHeaders(context: ProjectRequestContext): Record<string, string> {
  return {
    "X-Project-ID": context.id,
    "X-Project-Revision": String(context.revision),
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `Request failed (${response.status})`);
  return json as T;
}

export function getJson<T>(path: string): Promise<T> { return requestJson(path); }

export function postJson<T>(path: string, body: unknown, context?: ProjectRequestContext): Promise<T> {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(context ? projectHeaders(context) : {}) },
    body: JSON.stringify(body),
  });
}
