import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const FORBIDDEN_MESSAGE = "You don't have permission to do that";

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Internal: set once a request has been retried after a token refresh. */
    _retry?: boolean;
    /**
     * Controls the global "no permission" toast for a 403 response. By default it is
     * shown for GET requests only (queries rarely toast their own errors, while
     * mutations usually do in `onError`). Pass `true` to force it, `false` to suppress it.
     */
    forbiddenToast?: boolean;
  }
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Clears the staff session everywhere (tokens + persisted auth store) and goes to /login. */
function endSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('alkhadim-auth'); // persisted zustand store (src/lib/auth.ts)
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

// One refresh at a time: the server rotates refresh tokens, so parallel refreshes
// with the same token would invalidate each other and log the user out.
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken as string;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    // Don't attempt token refresh for auth endpoints themselves
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (status === 401 && original && !isAuthEndpoint && !original._retry) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        endSession();
      }
    }

    if (status === 403 && typeof window !== 'undefined') {
      const data = err.response?.data;
      // Give callers that toast `error.response.data.error` a friendly message.
      if (data && typeof data === 'object' && data.error === 'Insufficient permissions') {
        data.error = FORBIDDEN_MESSAGE;
      }
      const method = (original?.method || 'get').toLowerCase();
      const show = original?.forbiddenToast ?? method === 'get';
      // Fixed id: several failing requests collapse into a single toast.
      if (show) toast.error(FORBIDDEN_MESSAGE, { id: 'forbidden' });
    }

    return Promise.reject(err);
  }
);

export default api;
