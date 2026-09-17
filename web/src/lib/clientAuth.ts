import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

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
        const { accessToken } = get();
        try {
          if (accessToken) {
            await axios.post(`${API}/api/client-auth/logout`, {}, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          }
        } catch {}
        set({ clientUser: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshProfile: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        const { data } = await axios.get(`${API}/api/client-auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
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

/* Axios instance pre-configured with client (company portal) auth */
export function clientApi(accessToken: string) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
