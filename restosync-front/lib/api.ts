const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '');

const aiServiceBaseUrl = (
  process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '');

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function aiServiceUrl(path: string) {
  return `${aiServiceBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function authHeaders(
  token: string,
  localId?: number | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (localId != null) {
    headers['X-Local-Id'] = String(localId);
  }
  return headers;
}
