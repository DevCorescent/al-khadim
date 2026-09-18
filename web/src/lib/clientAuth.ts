import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { type AxiosInstance } from 'axios';
import { API_BASE as API, createPortalClient } from './portalApi';

export interface ClientUserProfile {
  id: string;
  name: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'COMPANY_MEMBER';
  client: { id: string; companyName: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' };
}

interface ClientAuthState {
  clientUser: ClientUserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setTokens: (access: string, refresh: string, clientUser: ClientUserProfile) => void;
}

export const useClientAuth = create<ClientAuthState>()(
  persist(
    (set, get) => ({
      clientUser: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setTokens: (access, refresh, clientUser) => set({
        accessToken: access,
        refreshToken: refresh,
        clientUser,
        isAuthenticated: true,
      }),

      login: async (email, password) => {
        const { data } = await axios.post(`${API}/api/client-auth/login`, { email, password });
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          clientUser: data.clientUser,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        const { accessToken, refreshToken } = get();
        try {
          // Revoke the refresh token server-side (best effort). Goes through the portal
          // client so an expired access token is refreshed first.
          if (accessToken) await portalClient().post('/api/client-auth/logout', { refreshToken }, { timeout: 5000 });
        } catch {}
        set({ clientUser: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshProfile: async () => {
        if (!get().accessToken) return;
        const { data } = await portalClient().get('/api/client-auth/me');
        set(s => ({ clientUser: { ...s.clientUser, ...data } }));
      },
    }),
    {
      name: 'client-auth',
      partialize: (s) => ({
        clientUser: s.clientUser,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    }
  )
);

/* Shared axios instance for the client (company portal) session: attaches the current access
   token and refreshes it on 401 (redirecting to /company/login if that fails). */
let _client: AxiosInstance | null = null;
function portalClient(): AxiosInstance {
  if (!_client) {
    _client = createPortalClient({
      refreshPath: '/api/client-auth/refresh',
      loginPath: '/company/login',
      getTokens: () => useClientAuth.getState(),
      setTokens: (accessToken, refreshToken) => useClientAuth.setState({ accessToken, refreshToken }),
      clearSession: () => useClientAuth.setState({ clientUser: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    });
  }
  return _client;
}

/**
 * Axios instance with client (company portal) auth. The argument is kept for existing call sites;
 * the instance always uses the latest token from the store.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function clientApi(_accessToken?: string | null): AxiosInstance {
  return portalClient();
}
