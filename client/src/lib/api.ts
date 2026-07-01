// API base: empty for same-origin (uses /api), or full URL for cross-origin (e.g. https://your-app.railway.app)
const RAW_API_URL = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).trim().replace(/\/$/, "")
  : "";
const API_BASE = RAW_API_URL ? `${RAW_API_URL}/api` : "/api";

// Production sanity check: a Vercel (static SPA) deployment has NO same-origin backend.
// If VITE_API_URL is unset in production, every /api call hits the static host and returns
// HTML (index.html / 404), which surfaces to the user as the generic "Request failed".
if (import.meta.env.PROD && !RAW_API_URL) {
  console.error(
    "[api] VITE_API_URL is not set in this production build. " +
      "API calls will be sent to the same origin as the frontend. " +
      "If the backend is hosted separately (e.g. Render/Railway while the SPA is on Vercel), " +
      "set VITE_API_URL=https://<your-backend-host> in the deployment environment and redeploy."
  );
}

// Guard against the classic misconfiguration of pointing the frontend at localhost in production.
if (import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(RAW_API_URL)) {
  console.error(
    `[api] VITE_API_URL points to a local address (${RAW_API_URL}) in a production build. ` +
      "Browsers cannot reach your machine's localhost. Set VITE_API_URL to the public backend URL."
  );
}

export const apiUrl = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

/** Legacy fallback — HttpOnly cookies are primary; localStorage kept for transition. */
function getAccessToken(): string | null {
  return localStorage.getItem("session_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setTokens(accessToken: string, refreshToken?: string) {
  if (accessToken) localStorage.setItem("session_token", accessToken);
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
}

function clearTokens() {
  localStorage.removeItem("session_token");
  localStorage.removeItem("refresh_token");
}

let refreshPromise: Promise<boolean> | null = null;

export const AUTH_EVENTS = {
  tokensRefreshed: "maximus:auth-tokens-refreshed",
  branchRequired: "maximus:branch-required",
} as const;

function notifyAuthEvent(event: (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS]) {
  window.dispatchEvent(new CustomEvent(event));
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        setTokens(data.accessToken, data.refreshToken);
        notifyAuthEvent(AUTH_EVENTS.tokensRefreshed);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fullUrl = apiUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (networkError) {
    // fetch() rejects ONLY on network-level failures: DNS failure, server
    // unreachable, request blocked by CORS, or mixed-content (https page → http API).
    console.error("[api] Network/CORS failure calling", fullUrl, networkError);
    const hint = !RAW_API_URL
      ? "The backend may not be reachable at this origin. Verify VITE_API_URL is set to your deployed backend."
      : "The backend may be down, the URL may be wrong, or CORS is blocking the request. " +
        "Ensure the backend is deployed and its CLIENT_ORIGIN includes this site's URL.";
    throw new Error(`Cannot reach the server. ${hint}`);
  }

  // Detect responses that are not JSON (e.g. the static host returned index.html or a
  // 404 page because there is no backend at this origin). This is the #1 cause of the
  // generic "Request failed" message on Vercel-only deployments.
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    if (response.status === 401 && !retried && !endpoint.includes("/auth/login")) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return apiRequest<T>(endpoint, options, true);
      }
      clearTokens();
      const error = await response.json().catch(() => ({ message: "Login expired. Please re-login." }));
      if (window.location.pathname !== "/auth/login") {
        window.location.href = "/auth/login";
      }
      throw new Error(error.message || "Login expired. Please re-login.");
    }

    if (!isJson) {
      // Non-JSON error body → almost certainly hitting the static frontend host, a
      // proxy/CDN error page, or a crashed backend. Log the raw response for debugging.
      const rawText = await response.text().catch(() => "");
      console.error("[api] Non-JSON error response", {
        url: fullUrl,
        status: response.status,
        contentType,
        bodyPreview: rawText.slice(0, 300),
      });
      if (response.status === 404) {
        throw new Error(
          `API endpoint not found (404) at ${fullUrl}. The backend route is missing or the request reached the static frontend instead of the API. Check VITE_API_URL.`
        );
      }
      if (response.status >= 500) {
        throw new Error(`Server error (${response.status}). The backend failed to handle the request.`);
      }
      throw new Error(`Unexpected non-JSON response (HTTP ${response.status}) from ${fullUrl}.`);
    }

    const error = (await response.json().catch(() => ({ message: "Request failed" }))) as {
      message?: string;
      code?: string;
      errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    };
    console.error("[api] Request failed", { url: fullUrl, status: response.status, body: error });
    if (response.status === 403 && error.code === "BRANCH_REQUIRED") {
      notifyAuthEvent(AUTH_EVENTS.branchRequired);
    }
    let msg = error.message || `HTTP ${response.status}`;
    const fe = error.errors?.fieldErrors;
    if (fe && typeof fe === "object") {
      const parts = Object.entries(fe)
        .filter(([, v]) => Array.isArray(v) && v.length)
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
      if (parts.length) msg = `${msg} — ${parts.join("; ")}`;
    }
    throw new Error(msg);
  }

  // Successful status but non-JSON body (e.g. SPA index.html returned with 200 because
  // the request hit the static host). Surface a clear, actionable error.
  if (!isJson) {
    const rawText = await response.text().catch(() => "");
    console.error("[api] Expected JSON but received non-JSON success response", {
      url: fullUrl,
      status: response.status,
      contentType,
      bodyPreview: rawText.slice(0, 300),
    });
    throw new Error(
      `The API returned a non-JSON response from ${fullUrl}. ` +
        "The request likely reached the static frontend instead of the backend API. " +
        "Set VITE_API_URL to your deployed backend URL and redeploy."
    );
  }

  return response.json();
}

/** Open a protected document (S3 redirect or streamed file) in a new tab. */
export async function openAuthenticatedFile(endpoint: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(endpoint), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Failed to open document");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download a protected document forcefully using a blob and hidden <a> tag. */
export async function downloadAuthenticatedFile(endpoint: string, fallbackFilename: string = "download.pdf"): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(endpoint), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  
  if (!response.ok) {
    let errorMsg = "Failed to download document";
    try {
      const errorData = await response.json();
      if (errorData.message) errorMsg = errorData.message;
    } catch {
      // Not JSON, ignore
    }
    throw new Error(errorMsg);
  }
  
  // Try to get filename from Content-Disposition header
  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition && disposition.indexOf("attachment") !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) { 
      filename = matches[1].replace(/['"]/g, "");
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/** POST + download blob (e.g. bulk ID card ZIP). */
export async function downloadAuthenticatedPost(
  endpoint: string,
  body: unknown,
  fallbackFilename: string = "download.zip",
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMsg = "Failed to download file";
    try {
      const errorData = await response.json();
      if (errorData.message) errorMsg = errorData.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition && disposition.indexOf("attachment") !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

export const adminApi = {
  dataHealth: () => apiRequest<any>("/admin/data-health"),
  runDataHealthBackfill: (data?: { batchSize?: number; limit?: number }) =>
    apiRequest<any>("/admin/data-health/backfill", { method: "POST", body: JSON.stringify(data ?? {}) }),
  regenerateAllPatientIds: () =>
    apiRequest<any>("/admin/data-health/regenerate-ids", {
      method: "POST",
      body: JSON.stringify({ confirm: "REGENERATE-ALL-IDS" }),
    }),
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const data = await apiRequest<{
      user: any;
      sessionId: string;
      accessToken: string;
      refreshToken: string;
      allowedBranches?: { id: string; name: string; branchName?: string }[];
      requiresBranchSelection?: boolean;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.accessToken || data.sessionId, data.refreshToken);
    return data.user;
  },

  logout: async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      clearTokens();
    }
  },

  me: async () => {
    return apiRequest<any>('/auth/me');
  },

  selectBranch: async (branchId: string) => {
    return apiRequest<{
      selectedBranchId: string;
      selectedBranchName: string | null;
      selectedContext: null;
      allowedBranches: { id: string; name: string; branchName?: string; code?: string }[];
      userRole: string;
    }>('/auth/select-branch', { method: 'POST', body: JSON.stringify({ branchId }) });
  },

  clearWorkspace: async () => {
    return apiRequest<{ requiresBranchSelection: boolean }>('/auth/clear-workspace', {
      method: 'POST',
    });
  },

  selectContext: async (context: 'maximus-overview' | 'nexus-overview') => {
    return apiRequest<{
      selectedBranchId: null;
      selectedBranchName: null;
      selectedContext: string;
      allowedBranches: { id: string; name: string; branchName?: string; code?: string }[];
      userRole: string;
    }>('/auth/select-context', { method: 'POST', body: JSON.stringify({ context }) });
  },

  getBranches: async () => {
    return apiRequest<any[]>('/auth/branches');
  },
};

// Staff API
export const staffApi = {
  getAll: (params?: { includeInactive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.includeInactive) query.append("includeInactive", "true");
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<any[]>(`/staff${queryString}`);
  },
  getOne: (id: string) => apiRequest<any>(`/staff/${id}`),
  treatingOptions: () => apiRequest<any[]>(`/staff/treating-options`),
  create: (data: any) => apiRequest<any>('/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  updatePassword: (id: string, data: { password: string; email?: string }) => 
    apiRequest<any>(`/staff/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => apiRequest<{ message: string }>(`/staff/${id}`, {
    method: 'DELETE',
  }),
  directory: (params?: Record<string, string | boolean>) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") q.append(k, String(v));
      });
    }
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/staff/directory${qs}`).then(unwrapApiData);
  },
  stats: (id: string, params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/staff/${id}/stats${qs}`).then(unwrapApiData);
  },
  leaderboard: (params: { metric: string; startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/staff/leaderboard?${q.toString()}`).then(unwrapApiData);
  },
  uploadPhoto: (id: string, photoUri: string) =>
    apiRequest<any>(`/staff/${id}/photo`, { method: "POST", body: JSON.stringify({ photoUri }) }).then(unwrapApiData),
  removePhoto: (id: string) =>
    apiRequest<any>(`/staff/${id}/photo`, { method: "DELETE" }).then(unwrapApiData),
  deactivate: (id: string) =>
    apiRequest<any>(`/staff/${id}/deactivate`, { method: "PATCH" }).then(unwrapApiData),
  activate: (id: string) =>
    apiRequest<any>(`/staff/${id}/activate`, { method: "PATCH" }).then(unwrapApiData),
};

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Patient API
export const patientApi = {
  getAll: (params?: {
    branch?: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.branch) q.append("branch", params.branch);
    if (params?.search) q.append("search", params.search);
    if (params?.status) q.append("status", params.status);
    if (params?.page) q.append("page", String(params.page));
    if (params?.limit) q.append("limit", String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any[] | PaginatedResponse<any>>(`/patients${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/patients/${id}`),
  nextId: (registeredDate?: string, branch?: string) => {
    const q = new URLSearchParams();
    if (registeredDate) q.set("date", registeredDate);
    if (branch) q.set("branch", branch);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<{ patientCode: string }>(`/patients/next-id${qs}`);
  },
  lookup: (params: { phone?: string; nic?: string }) => {
    const q = new URLSearchParams();
    if (params.phone) q.set("phone", params.phone);
    if (params.nic) q.set("nic", params.nic);
    return apiRequest<{ patient: any | null }>(`/patients/lookup?${q.toString()}`);
  },
  qrToken: (id: string) =>
    apiRequest<{ token: string; patientCode: string | null; organizationId: "maximus" | "nexus" }>(
      `/patients/${id}/qr-token`
    ),
  scan: (token: string) =>
    apiRequest<{
      patient: any;
      kind: "outpatient" | "inpatient";
      isAdmitted: boolean;
      activeAdmissionId: string | null;
    }>(`/patients/scan`, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  history: (id: string) =>
    apiRequest<{
      patientId: string;
      patientCode: string | null;
      organizationId: "maximus" | "nexus";
      items: Array<{
        type: "admission" | "visit";
        id: string;
        date: string;
        branch: string | null;
        title: string;
        status?: string | null;
        condition?: string | null;
        treatment?: string | null;
        packageType?: string | null;
        dischargeDate?: string | null;
        sessionNumber?: number | null;
        amount?: string | null;
        staffName?: string | null;
      }>;
    }>(`/patients/${id}/history`),
  nextSessionNumber: (patientId: string) =>
    apiRequest<{ nextSessionNumber: number }>(`/patients/${patientId}/next-session-number`),
  create: (data: any) => apiRequest<any>('/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<{ message: string }>(`/patients/${id}`, {
    method: 'DELETE',
  }),
};

// Visit API
export const visitApi = {
  getAll: (params?: { patientId?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<any[]>(`/visits${queryString}`);
  },
  getUnpaid: () => apiRequest<any[]>('/visits/unpaid'),
  getOne: (id: string) => apiRequest<any>(`/visits/${id}`),
  create: (data: any) => apiRequest<any>('/visits', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/visits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/visits/${id}`, {
    method: 'DELETE',
  }),
};

// Attendance API
export const attendanceApi = {
  getAll: (params?: { staffId?: string; startDate?: string; endDate?: string; month?: string }) => {
    const query = new URLSearchParams();
    if (params?.staffId) query.append('staffId', params.staffId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month) query.append('month', params.month);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<any[]>(`/attendance${queryString}`);
  },
  create: (data: any) => apiRequest<any>('/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<any>(`/attendance/${id}`, {
    method: 'DELETE',
  }),
  // Admin/MD only: get an unguessable short-link token for one record's location.
  locationToken: (id: string) =>
    apiRequest<{ token: string }>(`/attendance/${id}/location-token`),
  // Admin/MD only: resolve a location short-link token to a single record's location.
  location: (token: string) =>
    apiRequest<{
      staffName: string;
      role: string;
      date: string;
      checkInTime: string | null;
      latitude: string;
      longitude: string;
      locationLabel: string | null;
    }>(`/attendance/location/${encodeURIComponent(token)}`),
};

// Incentive Settings API
export const incentiveSettingsApi = {
  get: () => apiRequest<any>('/incentive-settings'),
  update: (data: any) => apiRequest<any>('/incentive-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Reports API
export const reportsApi = {
  getVisitStats: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const query = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.staffId) query.append('staffId', params.staffId);
    return apiRequest<any>(`/reports/visit-stats?${query.toString()}`);
  },
};

// In-Patient API
export const inPatientApi = {
  // Admissions
  getAll: (status?: string | string[]) => {
    const normalized = Array.isArray(status) ? status.join(",") : status;
    const query = normalized ? `?status=${normalized}` : '';
    return apiRequest<any[]>(`/inpatients${query}`);
  },
  getOne: (id: string) => apiRequest<any>(`/inpatients/${id}`),
  qrToken: (id: string) =>
    apiRequest<{ token: string; patientCode: string | null; organizationId: "maximus" | "nexus" }>(
      `/inpatients/${id}/qr-token`
    ),
  create: (data: any) => apiRequest<any>('/inpatients', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/inpatients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<{ message: string }>(`/inpatients/${id}`, {
    method: 'DELETE',
  }),
  readmit: (admissionId: string, admitDate?: string) => apiRequest<any>(`/inpatients/${admissionId}/readmit`, {
    method: 'POST',
    body: JSON.stringify(admitDate ? { admitDate } : {}),
  }),
  updateAdmitDate: (id: string, admitDate: string) => apiRequest<any>(`/inpatients/${id}/admit-date`, {
    method: 'PATCH',
    body: JSON.stringify({ admitDate }),
  }),
  setDeduction: (
    id: string,
    data: { deductionType: "fixed" | "percentage" | null; deductionValue: number; deductionReason?: string | null },
  ) => apiRequest<any>(`/inpatients/${id}/deduction`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  transfer: (id: string, data: { targetBranchId: string; transferDate?: string; transferNote?: string }) =>
    apiRequest<any>(`/inpatients/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTransfers: (id: string) => apiRequest<any[]>(`/inpatients/${id}/transfers`),

  // Sessions
  getSessions: (admissionId: string) => 
    apiRequest<any[]>(`/inpatients/${admissionId}/sessions`),
  getPreviousSessions: (admissionId: string) =>
    apiRequest<any[]>(`/inpatients/${admissionId}/sessions/previous`),
  getPriorEpisodes: (admissionId: string) =>
    apiRequest<any[]>(`/inpatients/${admissionId}/prior-episodes`),
  getNextSessionNumber: (admissionId: string, date: string) =>
    apiRequest<{ nextSessionNumber: number }>(`/inpatients/${admissionId}/sessions/next-number?date=${date}`),
  createSession: (admissionId: string, data: any) => 
    apiRequest<any>(`/inpatients/${admissionId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSession: (sessionId: string, data: any) => 
    apiRequest<any>(`/inpatients/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSession: (sessionId: string) => 
    apiRequest<{ message: string }>(`/inpatients/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  /** Staff-scoped sessions (optional staffId for Admin/MD) */
  getSessionsByDateRange: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
    if (params.staffId) q.append('staffId', params.staffId);
    return apiRequest<any[]>(`/inpatients/sessions?${q.toString()}`);
  },

  /** Admin/MD/Manager — all IP sessions in range (incentive reports / dashboard).
   *  Pass `branch` to scope to a single branch (used by branch dashboards). */
  getAllSessionsInDateRange: (params: { startDate: string; endDate: string; branch?: string }) => {
    const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
    if (params.branch) q.append('branch', params.branch);
    return apiRequest<any[]>(`/inpatients/sessions/all?${q.toString()}`);
  },

  // Discharge
  getDischarge: (admissionId: string) =>
    apiRequest<any>(`/inpatients/${admissionId}/discharge`),
  createDischarge: (admissionId: string, data: any) =>
    apiRequest<any>(`/inpatients/${admissionId}/discharge`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDischarge: (dischargeId: string, data: any) =>
    apiRequest<any>(`/inpatients/discharge/${dischargeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Payments
  getPayments: (admissionId: string) =>
    apiRequest<any[]>(`/inpatients/${admissionId}/payments`),
  getPaymentTotal: (admissionId: string) =>
    apiRequest<{ total: number }>(`/inpatients/${admissionId}/payments/total`),
  createPayment: (admissionId: string, data: any) =>
    apiRequest<any>(`/inpatients/${admissionId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePayment: (paymentId: string, data: any) =>
    apiRequest<any>(`/inpatients/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Extra Expenses
  getExtraExpenses: (admissionId: string) =>
    apiRequest<any[]>(`/inpatients/${admissionId}/extra-expenses`),
  getExtraExpenseTotal: (admissionId: string) =>
    apiRequest<{ total: number }>(`/inpatients/${admissionId}/extra-expenses/total`),
  createExtraExpense: (admissionId: string, data: any) =>
    apiRequest<any>(`/inpatients/${admissionId}/extra-expenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExtraExpense: (id: string, data: any) =>
    apiRequest<any>(`/inpatients/extra-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteExtraExpense: (id: string) =>
    apiRequest<{ message: string }>(`/inpatients/extra-expenses/${id}`, {
      method: 'DELETE',
    }),
};

// Expense API (MD/Admin only for full access, all staff can create)
export const expenseApi = {
  getAll: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<any[]>(`/expenses${queryString}`);
  },
  getMy: () => apiRequest<any[]>('/expenses/my'),
  getOne: (id: string) => apiRequest<any>(`/expenses/${id}`),
  create: (data: any) => apiRequest<any>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/expenses/${id}`, {
    method: 'DELETE',
  }),
};

// Revenue Summary API (MD/Admin only)
export const revenueApi = {
  getSummary: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ totalIncome: number; totalExpenses: number; netRevenue: number }>(`/revenue-summary${queryString}`);
  },
};

// Staff fines (Admin manage; staff see own via GET without staffId)
export const staffFinesApi = {
  getAll: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
    if (params.staffId) q.append('staffId', params.staffId);
    return apiRequest<any[]>(`/staff-fines?${q.toString()}`);
  },
  create: (data: any) =>
    apiRequest<any>('/staff-fines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/staff-fines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<{ message: string }>(`/staff-fines/${id}`, {
      method: 'DELETE',
    }),
};

// Appointment API
export const appointmentApi = {
  getAll: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return apiRequest<any[]>(`/appointments${query}`);
  },
  getOne: (id: string) => apiRequest<any>(`/appointments/${id}`),
  create: (data: any) => apiRequest<any>('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<{ message: string }>(`/appointments/${id}`, {
    method: 'DELETE',
  }),
};

// Standardized API envelope helper
function unwrapApiData<T>(res: T | { success?: boolean; data?: T }): T {
  if (res && typeof res === "object" && "success" in res && "data" in res) {
    return (res as { data: T }).data as T;
  }
  return res as T;
}

export const payrollApi = {
  getReport: async (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate });
    if (params.staffId) q.append("staffId", params.staffId);
    const res = await apiRequest<any>(`/payroll/report?${q.toString()}`);
    return unwrapApiData(res);
  },
  saveSnapshot: (data: { staffId: string; periodStart: string; periodEnd: string }) =>
    apiRequest<any>("/payroll/snapshots", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  getSnapshots: (staffId?: string) => {
    const q = staffId ? `?staffId=${staffId}` : "";
    return apiRequest<any>(`/payroll/snapshots${q}`).then(unwrapApiData);
  },
};

export const auditApi = {
  getAll: (params?: { entityType?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.append("entityType", params.entityType);
    q.append("limit", String(params?.limit ?? 300));
    return apiRequest<any[]>(`/audit-logs?${q.toString()}`).then(unwrapApiData);
  },
};

export const patientsApiExtended = {
  export: () => apiRequest<any>("/patients/export").then(unwrapApiData),
  bulkIdCardsZip: (patientIds: string[]) =>
    downloadAuthenticatedPost("/patients/id-cards/bulk-zip", { patientIds }, "patient-id-cards.zip"),
  dashboard: () => apiRequest<any>("/patients/dashboard").then(unwrapApiData),
  stats: (patientId: string) => apiRequest<any>(`/patients/${patientId}/stats`).then(unwrapApiData),
  documents: {
    list: (patientId: string) => apiRequest<any>(`/patients/${patientId}/documents`).then(unwrapApiData),
    create: (patientId: string, data: any) =>
      apiRequest<any>(`/patients/${patientId}/documents`, { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
    upload: (patientId: string, data: { fileName: string; documentType: string; contentBase64: string }) =>
      apiRequest<any>(`/patients/${patientId}/documents/upload`, { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
    delete: (id: string) => apiRequest<any>(`/patients/documents/${id}`, { method: "DELETE" }).then(unwrapApiData),
    filePath: (documentId: string) => `/patients/documents/${documentId}/file`,
  },
  notes: {
    list: (patientId: string) => apiRequest<any>(`/patients/${patientId}/notes`).then(unwrapApiData),
    create: (patientId: string, data: any) =>
      apiRequest<any>(`/patients/${patientId}/notes`, { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
    delete: (id: string) => apiRequest<any>(`/patients/notes/${id}`, { method: "DELETE" }).then(unwrapApiData),
  },
};

export const visitPaymentsApi = {
  list: (visitId: string) => apiRequest<any>(`/visits/${visitId}/payments`).then(unwrapApiData),
  collect: (visitId: string, data: any) =>
    apiRequest<any>(`/visits/${visitId}/payments`, { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
};

export const homeVisitsApi = {
  list: (params?: { startDate?: string; endDate?: string; branch?: string; staffId?: string; visitType?: string }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.append("startDate", params.startDate);
    if (params?.endDate) q.append("endDate", params.endDate);
    if (params?.branch) q.append("branch", params.branch);
    if (params?.staffId) q.append("staffId", params.staffId);
    if (params?.visitType) q.append("visitType", params.visitType);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/home-visits${qs}`).then(unwrapApiData);
  },
  create: (data: any) =>
    apiRequest<any>("/home-visits", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  update: (id: string, data: any) =>
    apiRequest<any>(`/home-visits/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(unwrapApiData),
  delete: (id: string) =>
    apiRequest<any>(`/home-visits/${id}`, { method: "DELETE" }).then(unwrapApiData),
};

export const salaryApi = {
  preview: (params: { staffId: string; periodStart: string; periodEnd: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/salary/preview?${q.toString()}`).then(unwrapApiData);
  },
  // Bug 6: full salary breakdown for the Reports page (staff own / manager branch staff).
  detail: (staffId: string, params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/staff/${staffId}/salary/detail?${q.toString()}`).then(unwrapApiData);
  },
  // Bug K: full salary report (per-branch home visits, OT, manual adjustments, final salary).
  report: (staffId: string, params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/staff/${staffId}/salary/report?${q.toString()}`).then(unwrapApiData);
  },
  reportHistory: (staffId: string, months?: number) => {
    const qs = months ? `?months=${months}` : "";
    return apiRequest<any>(`/staff/${staffId}/salary/history${qs}`).then(unwrapApiData);
  },
  addAddition: (staffId: string, data: { date: string; reason: string; amount: number }) =>
    apiRequest<any>(`/staff/${staffId}/salary/additions`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then(unwrapApiData),
  addDecrement: (staffId: string, data: { date: string; reason: string; amount: number }) =>
    apiRequest<any>(`/staff/${staffId}/salary/decrements`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then(unwrapApiData),
  updateDecrement: (staffId: string, adjustmentId: string, data: { date?: string; reason?: string; amount?: number }) =>
    apiRequest<any>(`/staff/${staffId}/salary/decrements/${adjustmentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }).then(unwrapApiData),
  addFine: (staffId: string, data: { date: string; reason: string; amount: number }) =>
    apiRequest<any>(`/staff/${staffId}/salary/fines`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then(unwrapApiData),
  generate: (data: {
    staffId?: string;
    staffIds?: string[];
    all?: boolean;
    periodStart: string;
    periodEnd: string;
  }) =>
    apiRequest<any>("/salary/generate", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  getJob: (jobId: string) => apiRequest<any>(`/jobs/${jobId}`).then(unwrapApiData),
  history: (params?: {
    month?: string;
    year?: string;
    branch?: string;
    staffId?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.month) q.append("month", params.month);
    if (params?.year) q.append("year", params.year);
    if (params?.branch) q.append("branch", params.branch);
    if (params?.staffId) q.append("staffId", params.staffId);
    if (params?.status) q.append("status", params.status);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/salary/history${qs}`).then(unwrapApiData);
  },
  getOne: (id: string) => apiRequest<any>(`/salary/${id}`).then(unwrapApiData),
  approve: (id: string) =>
    apiRequest<any>(`/salary/${id}/approve`, { method: "POST" }).then(unwrapApiData),
  reject: (id: string, reason: string) =>
    apiRequest<any>(`/salary/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }).then(unwrapApiData),
  returnForReview: (id: string, reason?: string) =>
    apiRequest<any>(`/salary/${id}/return`, { method: "POST", body: JSON.stringify({ reason }) }).then(unwrapApiData),
  markPaid: (id: string, data: { paymentMethod: string; paymentReference?: string; paymentRemarks?: string }) =>
    apiRequest<any>(`/salary/${id}/pay`, { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  dashboard: () => apiRequest<any>("/salary/dashboard").then(unwrapApiData),
  exportRows: (params?: { month?: string; year?: string; branch?: string; staffId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.month) q.append("month", params.month);
    if (params?.year) q.append("year", params.year);
    if (params?.branch) q.append("branch", params.branch);
    if (params?.staffId) q.append("staffId", params.staffId);
    if (params?.status) q.append("status", params.status);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/salary/export${qs}`).then(unwrapApiData);
  },
  deductions: {
    list: (params?: { staffId?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (params?.staffId) q.append("staffId", params.staffId);
      if (params?.startDate) q.append("startDate", params.startDate);
      if (params?.endDate) q.append("endDate", params.endDate);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return apiRequest<any>(`/salary/deductions${qs}`).then(unwrapApiData);
    },
    create: (data: any) =>
      apiRequest<any>("/salary/deductions", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
    update: (id: string, data: any) =>
      apiRequest<any>(`/salary/deductions/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(unwrapApiData),
    delete: (id: string) =>
      apiRequest<any>(`/salary/deductions/${id}`, { method: "DELETE" }).then(unwrapApiData),
  },
  ot: {
    list: (params?: { staffId?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (params?.staffId) q.append("staffId", params.staffId);
      if (params?.startDate) q.append("startDate", params.startDate);
      if (params?.endDate) q.append("endDate", params.endDate);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return apiRequest<any>(`/salary/ot${qs}`).then(unwrapApiData);
    },
    create: (data: any) =>
      apiRequest<any>("/salary/ot", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
    update: (id: string, data: any) =>
      apiRequest<any>(`/salary/ot/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(unwrapApiData),
    delete: (id: string) =>
      apiRequest<any>(`/salary/ot/${id}`, { method: "DELETE" }).then(unwrapApiData),
  },
  waiveFine: (id: string) =>
    apiRequest<any>(`/salary/fines/${id}/waive`, { method: "POST" }).then(unwrapApiData),
};

export const clinicSettingsApi = {
  get: () => apiRequest<any>("/clinic-settings").then(unwrapApiData),
  update: (data: any) =>
    apiRequest<any>("/clinic-settings", { method: "PUT", body: JSON.stringify(data) }).then(unwrapApiData),
};

export const branchesApi = {
  getAll: () => apiRequest<any>("/branches").then(unwrapApiData),
  create: (data: any) =>
    apiRequest<any>("/branches", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  update: (id: string, data: any) =>
    apiRequest<any>(`/branches/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(unwrapApiData),
  delete: (id: string) =>
    apiRequest<any>(`/branches/${id}`, { method: "DELETE" }).then(unwrapApiData),
};

export const notificationsApi = {
  getAll: (opts?: { unreadOnly?: boolean; archived?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.unreadOnly) q.append("unreadOnly", "true");
    if (opts?.archived === true) q.append("archived", "true");
    if (opts?.archived === false) q.append("archived", "false");
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/notifications${qs}`).then(unwrapApiData);
  },
  getUnreadCount: () => apiRequest<any>("/notifications/unread-count").then(unwrapApiData),
  markRead: (id: string) =>
    apiRequest<any>(`/notifications/${id}/read`, { method: "PATCH" }).then(unwrapApiData),
  markAllRead: () =>
    apiRequest<any>("/notifications/mark-all-read", { method: "POST" }).then(unwrapApiData),
  clearAll: () =>
    apiRequest<any>("/notifications/clear-all", { method: "POST" }).then(unwrapApiData),
  archive: (id: string) =>
    apiRequest<any>(`/notifications/${id}/archive`, { method: "PATCH" }).then(unwrapApiData),
  delete: (id: string) =>
    apiRequest<any>(`/notifications/${id}`, { method: "DELETE" }).then(unwrapApiData),
  create: (data: any) =>
    apiRequest<any>("/notifications", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  broadcast: (data: { title: string; message: string; type?: string; branch?: string }) =>
    apiRequest<any>("/notifications/broadcast", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  history: (params?: { staffId?: string; limit?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/notifications/history?${q.toString()}`).then(unwrapApiData);
  },
};

export const attendanceApiExtended = {
  dashboard: (date?: string) => {
    const q = date ? `?date=${date}` : "";
    return apiRequest<any>(`/attendance/dashboard${q}`).then(unwrapApiData);
  },
};

export const tasksApi = {
  dashboard: (all?: boolean) => {
    const q = all ? "?all=true" : "";
    return apiRequest<any>(`/tasks/dashboard${q}`).then(unwrapApiData);
  },
  getAll: (params?: { status?: string; all?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append("status", params.status);
    if (params?.all) q.append("all", "true");
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<any>(`/tasks${qs}`).then(unwrapApiData);
  },
  create: (data: any) =>
    apiRequest<any>("/tasks", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
  update: (id: string, data: any) =>
    apiRequest<any>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(unwrapApiData),
  delete: (id: string) =>
    apiRequest<any>(`/tasks/${id}`, { method: "DELETE" }).then(unwrapApiData),
};

export const reportsApiExtended = {
  dashboardKpis: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/dashboard-kpis?${q.toString()}`).then(unwrapApiData);
  },
  branchStats: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/branch-stats?${q.toString()}`).then(unwrapApiData);
  },
  maximusOverview: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/maximus-overview?${q.toString()}`).then(unwrapApiData);
  },
  nexusOverview: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/nexus-overview?${q.toString()}`).then(unwrapApiData);
  },
  therapistPatients: () =>
    apiRequest<any>("/reports/therapist-patients").then(unwrapApiData),
  revenue: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/revenue?${q.toString()}`).then(unwrapApiData);
  },
  incentive: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/reports/incentive?${q.toString()}`).then(unwrapApiData);
  },
  attendance: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/reports/attendance?${q.toString()}`).then(unwrapApiData);
  },
  expenses: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/expenses?${q.toString()}`).then(unwrapApiData);
  },
  unpaid: () => apiRequest<any>("/reports/unpaid").then(unwrapApiData),
  staffReport: (staffId: string, params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
    return apiRequest<any>(`/reports/staff/${staffId}?${q.toString()}`).then(unwrapApiData);
  },
  sessions: (params: { startDate: string; endDate: string; staffId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return apiRequest<any>(`/reports/sessions?${q.toString()}`).then(unwrapApiData);
  },
};

export function unwrapPaginatedList<T>(response: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  return response.data ?? [];
}

/** @deprecated Use HttpOnly cookies; kept for legacy callers */
export const getSessionToken = getAccessToken;
export const setSessionToken = (token: string) => setTokens(token);
export const removeSessionToken = clearTokens;

export function buildReportExportUrl(
  reportType: string,
  params: { startDate: string; endDate: string; format?: "csv" | "xlsx" | "pdf" }
): string {
  const q = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
    format: params.format ?? "csv",
  });
  return apiUrl(`/reports/export/${reportType}?${q.toString()}`);
}
