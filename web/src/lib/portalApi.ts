import axios, { type AxiosInstance } from 'axios';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface PortalTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface PortalClientOptions {
  /** Refresh endpoint path, e.g. '/api/candidate-auth/refresh' (body `{ refreshToken }`). */
  refreshPath: string;
  getTokens: () => PortalTokens;
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Called when the session can't be renewed (clear local state here). */
  clearSession: () => void;
  /** Where to send the user once the session has ended. */
  loginPath: string;
}

/**
 * Axios instance for the candidate / company portals (baseURL is the site root, so
 * request paths start with `/api/...`). It always sends the latest access token and,
 * on a 401, refreshes it once (single-flight — refresh tokens are rotated server-side)
 * and retries. If refreshing fails, the session is cleared and the user is sent to
 * `loginPath`.
 */
export function createPortalClient(opts: PortalClientOptions): AxiosInstance {
  const client = axios.create({ baseURL: API_BASE });
  let refreshing: Promise<string> | null = null;

  const refresh = () => {
    if (!refreshing) {
      refreshing = (async () => {
        const { refreshToken } = opts.getTokens();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE}${opts.refreshPath}`, { refreshToken });
        opts.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  };

  client.interceptors.request.use((config) => {
    const { accessToken } = opts.getTokens();
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config;
      const isAuthCall = /\/(login|refresh|register)(\?|$)/.test(original?.url || '');
      if (err.response?.status === 401 && original && !original._retry && !isAuthCall) {
        original._retry = true;
        try {
          const accessToken = await refresh();
          original.headers.Authorization = `Bearer ${accessToken}`;
          return client(original);
        } catch {
          opts.clearSession();
          if (typeof window !== 'undefined' && window.location.pathname !== opts.loginPath) {
            window.location.replace(opts.loginPath);
          }
        }
      }
      return Promise.reject(err);
    },
  );

  return client;
}
