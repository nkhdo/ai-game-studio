import { getJson } from "./transport";

export function checkHealth(): Promise<{ ok: boolean; hasApiKey: boolean }> {
  return getJson("/api/health");
}
