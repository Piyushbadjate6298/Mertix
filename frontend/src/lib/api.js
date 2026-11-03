function getBaseCandidates() {
  const envUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const candidates = [];

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const proto = window.location.protocol || 'http:';

    // Support relative proxy route if served through Vite or reverse proxy
    candidates.push('');

    // If accessing via LAN IP or non-localhost host, prioritize host:5000 before localhost
    if (host !== 'localhost' && host !== '127.0.0.1') {
      candidates.push(`${proto}//${host}:5000`);
    }
  }

  if (envUrl) candidates.push(envUrl);

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const proto = window.location.protocol || 'http:';
    candidates.push(`${proto}//${host}:5000`);
    if (host !== '127.0.0.1') candidates.push(`${proto}//127.0.0.1:5000`);
    if (host !== 'localhost') candidates.push(`${proto}//localhost:5000`);
  } else {
    candidates.push('http://localhost:5000');
    candidates.push('http://127.0.0.1:5000');
  }

  return Array.from(new Set(candidates.filter((c) => typeof c === 'string')));
}

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

    const bases = getBaseCandidates();
    let response;
    let lastNetworkError = null;

    for (const base of bases) {
      try {
        const url = base ? `${base}/api${path}` : `/api${path}`;
        const res = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : form ? body : JSON.stringify(body),
          // Allow up to 45s for free-tier backend cold starts (Render/Neon sleep mode)
          signal: AbortSignal.timeout(form ? 90_000 : 45_000),
        });
        if (!base && (res.status === 404 || res.status >= 500)) {
          continue;
        }
        response = res;
        break;
      } catch (err) {
        lastNetworkError = err;
        if (err.name === 'TimeoutError') break;
      }
    }

    if (!response) {
      if (lastNetworkError?.name === 'TimeoutError') {
        throw new Error('The server took too long to respond. The cloud service may be waking up, please try again.');
      }
      throw new Error('Unable to reach the MERITX server. Check your connection and try again.');
    }

    if (cacheKey) inFlightGets.delete(cacheKey);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || payload.message || 'The request could not be completed.');
    return payload;
  })();

  if (cacheKey) inFlightGets.set(cacheKey, requestPromise);
  return requestPromise;
}

export const money = (number) => `₹${Number(number || 0).toLocaleString('en-IN')}`;
export const friendlyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
