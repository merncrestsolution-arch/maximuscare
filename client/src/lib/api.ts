// API base: empty for same-origin (uses /api), or full URL for cross-origin (e.g. https://your-app.railway.app)
const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, "")}/api`
  : "/api";

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

  const response = await fetch(apiUrl(endpoint), {
    ...options,
    credentials: "include",
    headers,
  });

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
    const error = (await response.json().catch(() => ({ message: "Request failed" }))) as {
      message?: string;
      code?: string;
      errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    };
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
  nextId: (registeredDate?: string) => {
    const q = new URLSearchParams();
    if (registeredDate) q.set("date", registeredDate);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<{ patientCode: string }>(`/patients/next-id${qs}`);
  },
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
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest<any[]>(`/inpatients${query}`);
  },
  getOne: (id: string) => apiRequest<any>(`/inpatients/${id}`),
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

  // Sessions
  getSessions: (admissionId: string) => 
    apiRequest<any[]>(`/inpatients/${admissionId}/sessions`),
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

  /** Admin/MD — all IP sessions in range (incentive reports) */
  getAllSessionsInDateRange: (params: { startDate: string; endDate: string }) => {
    const q = new URLSearchParams(params);
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

// Staff fines (Admin/MD manage; staff see own via GET without staffId)
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

export const patientsApiExtended = {
  export: () => apiRequest<any>("/patients/export").then(unwrapApiData),
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
  archive: (id: string) =>
    apiRequest<any>(`/notifications/${id}/archive`, { method: "PATCH" }).then(unwrapApiData),
  delete: (id: string) =>
    apiRequest<any>(`/notifications/${id}`, { method: "DELETE" }).then(unwrapApiData),
  create: (data: any) =>
    apiRequest<any>("/notifications", { method: "POST", body: JSON.stringify(data) }).then(unwrapApiData),
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
