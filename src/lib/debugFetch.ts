/**
 * Relative-URL JSON fetch with console diagnostics for admin dashboards.
 * Never pass localhost:port — always `/api/...`.
 */
export async function fetchJsonLogged(
  url: string,
  label: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const started = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      console.error(`[${label}] Invalid JSON`, {
        url,
        status: res.status,
        statusText: res.statusText,
        ms: Date.now() - started,
        responseText: text.slice(0, 800),
      });
      throw new Error(`${label} returned non-JSON (HTTP ${res.status})`);
    }

    if (!res.ok) {
      console.error(`[${label}] HTTP error`, {
        url,
        status: res.status,
        statusText: res.statusText,
        ms: Date.now() - started,
        responseText: text.slice(0, 800),
        json,
      });
      const message = typeof json?.message === 'string' ? json.message : '';
      throw new Error(message || `${label} failed (HTTP ${res.status})`);
    }

    return json || {};
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      console.warn(`[${label}] request aborted`, { url });
      throw err;
    }
    console.error(`[${label}] Failed to fetch`, {
      url,
      name: err.name,
      message: err.message,
      error,
    });
    throw err;
  }
}
