const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log("[apiFetch] ->", method, path, { hasToken: Boolean(token) });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  console.log("[apiFetch] <-", method, path, response.status);

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error ?? `Request failed with status ${response.status}`;
    console.error("[apiFetch] error", method, path, response.status, message);
    throw new Error(message);
  }

  return data;
}
