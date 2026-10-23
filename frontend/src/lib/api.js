const configuredBase = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '').replace(/\/api$/, '');

export async function api(path, { method = 'GET', body, token } = {}) {
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
      signal: AbortSignal.timeout(form ? 60_000 : 15_000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Unable to reach the MERITX server. Check your connection and try again.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || payload.message || 'The request could not be completed.');
  return payload;
}

export const money = (number) => `₹${Number(number || 0).toLocaleString('en-IN')}`;
export const friendlyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
