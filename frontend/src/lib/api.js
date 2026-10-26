const configuredBase = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '').replace(/\/api$/, '');

const inFlightGets = new Map();

export async function api(path, { method = 'GET', body, token } = {}) {
  const isGet = method.toUpperCase() === 'GET' && body === undefined;
  // Deduplicate simultaneous identical GET requests
  const cacheKey = isGet ? `${path}::${token || ''}` : null;
  if (cacheKey && inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey);
  }

  const requestPromise = (async () => {
    const headers = { Accept: 'application/json' };
    const form = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${configuredBase}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : form ? body : JSON.stringify(body),
        // Allow up to 45s for free-tier backend cold starts (Render/Neon sleep mode)
        signal: AbortSignal.timeout(form ? 90_000 : 45_000),
      });
    } catch (error) {
      if (error.name === 'TimeoutError') throw new Error('The server took too long to respond. The cloud service may be waking up, please try again.');
      throw new Error('Unable to reach the MERITX server. Check your connection and try again.');
    } finally {
      if (cacheKey) inFlightGets.delete(cacheKey);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || payload.message || 'The request could not be completed.');
    return payload;
  })();

  if (cacheKey) inFlightGets.set(cacheKey, requestPromise);
  return requestPromise;
}

export const money = (number) => `₹${Number(number || 0).toLocaleString('en-IN')}`;
export const friendlyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
