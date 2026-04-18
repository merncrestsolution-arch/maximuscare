// API base: empty for same-origin (uses /api), or full URL for cross-origin (e.g. https://your-app.railway.app)
const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, "")}/api`
  : "/api";

export const apiUrl = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

// Get session token from localStorage
function getSessionToken(): string | null {
  return localStorage.getItem('session_token');
}

// Set session token to localStorage
function setSessionToken(token: string) {
  localStorage.setItem('session_token', token);
}

// Remove session token from localStorage
function removeSessionToken() {
  localStorage.removeItem('session_token');
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeSessionToken();
      const error = await response.json().catch(() => ({ message: 'Login expired. Please re-login.' }));
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
      }
      throw new Error(error.message || 'Login expired. Please re-login.');
    }
    const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
      message?: string;
      errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    };
    let msg = error.message || `HTTP ${response.status}`;
    const fe = error.errors?.fieldErrors;
    if (fe && typeof fe === 'object') {
      const parts = Object.entries(fe)
        .filter(([, v]) => Array.isArray(v) && v.length)
        .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`);
      if (parts.length) msg = `${msg} — ${parts.join('; ')}`;
    }
    throw new Error(msg);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const data = await apiRequest<{ user: any; sessionId: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setSessionToken(data.sessionId);
    return data.user;
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      removeSessionToken();
    }
  },

  me: async () => {
    return apiRequest<any>('/auth/me');
  },
};

// Staff API
export const staffApi = {
  getAll: () => apiRequest<any[]>('/staff'),
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
};

// Patient API
export const patientApi = {
  getAll: (branch?: string) => {
    const params = branch ? `?branch=${branch}` : '';
    return apiRequest<any[]>(`/patients${params}`);
  },
  getOne: (id: string) => apiRequest<any>(`/patients/${id}`),
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

export { getSessionToken, setSessionToken, removeSessionToken };
