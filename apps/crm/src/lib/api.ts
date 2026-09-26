// Replaces lib/supabase.ts. The backend is now a plain PHP + MySQL API
// (apps/crm-api/) on the same Hostinger host as this SPA — same origin,
// so a cookie session (credentials: "include") does the job Supabase's
// JS client + JWT used to do, no token plumbing needed on this side.
import type { Role } from "../auth/types";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A FormData body must NOT get a Content-Type header set manually — the
  // browser needs to add its own multipart boundary, which is why
  // uploads (documents.php) skip the default JSON header entirely.
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: isFormData ? options.headers : { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError((body as { error?: string } | null)?.error ?? res.statusText, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // FormData uploads (documents.php) — no Content-Type header here so the
  // browser sets the multipart boundary itself; JSON.stringify would
  // mangle a File, which is why this can't just be api.post().
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};

// ---- Auth — mirrors apps/crm-api/auth.php's action-routed endpoints ----
export interface ApiUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: Role;
  full_name: string | null;
}

export const authApi = {
  session: () => api.get<{ user: ApiUser | null }>("/auth.php?action=session"),
  login: (email: string, password: string) =>
    api.post<{ user: ApiUser }>("/auth.php?action=login", { email, password }),
  logout: () => api.post<{ ok: true }>("/auth.php?action=logout"),
  requestOtp: (phone: string) => api.post<{ ok: true; sms_sent: boolean }>("/auth.php?action=request_otp", { phone }),
  verifyOtp: (phone: string, code: string) =>
    api.post<{ user: ApiUser }>("/auth.php?action=verify_otp", { phone, code }),
};
