export const DEBUG_QUERY_PARAM = 'debugmode';
export const DEFAULT_DEBUG_QUERY_TOKEN = 'godmode';
export const DEBUG_QUERY_TOKEN =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEBUG_QUERY_TOKEN ??
    DEFAULT_DEBUG_QUERY_TOKEN).trim() || DEFAULT_DEBUG_QUERY_TOKEN;

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isNetlifyNonProductionHost(hostname: string): boolean {
  return hostname.endsWith('.netlify.app') && hostname.includes('--');
}

export function canUseGodModeDebugForHost(hostname: string, search: string, token: string = DEBUG_QUERY_TOKEN): boolean {
  if (isLoopbackHost(hostname)) return true;
  if (!isNetlifyNonProductionHost(hostname)) return false;
  const params = new URLSearchParams(search);
  return params.get(DEBUG_QUERY_PARAM) === token;
}

export function canUseGodModeDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return canUseGodModeDebugForHost(window.location.hostname, window.location.search);
}

