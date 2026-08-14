export class ApiError extends Error {}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(url: string) => req<T>(url),
  post: <T>(url: string, body?: unknown) => req<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) => req<T>(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  postForm: <T>(url: string, form: FormData) => req<T>(url, { method: 'POST', body: form }),
};
