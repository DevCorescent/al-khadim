import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { type AxiosInstance } from 'axios';
import { API_BASE as API, createPortalClient } from './portalApi';

export interface CandidateProfile {
  id: string;
  cvId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  languages: string[];
  experience?: number;
  currentLocation?: string;
  nationality?: string;
  education?: string;
  linkedIn?: string;
  portfolio?: string;
  introVideoUrl?: string;
  cvPath?: string;
  currentSalary?: number;
  expectedSalary?: number;
  currency: string;
  isPublic: boolean;
  status: string;
  applications?: any[];
  interviews?: any[];
}

interface CandidateAuthState {
  candidate: CandidateProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setTokens: (access: string, refresh: string, candidate: CandidateProfile) => void;
}

export const useCandidateAuth = create<CandidateAuthState>()(
  persist(
    (set, get) => ({
      candidate: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setTokens: (access, refresh, candidate) => set({
        accessToken: access,
        refreshToken: refresh,
        candidate,
        isAuthenticated: true,
      }),

      login: async (email, password) => {
        const { data } = await axios.post(`${API}/api/candidate-auth/login`, { email, password });
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          candidate: data.candidate,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        const { accessToken, refreshToken } = get();
        try {
          // Revoke the refresh token server-side (best effort). Goes through the portal
          // client so an expired access token is refreshed first.
          if (accessToken) await portalClient().post('/api/candidate-auth/logout', { refreshToken }, { timeout: 5000 });
        } catch {}
        set({ candidate: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshProfile: async () => {
        if (!get().accessToken) return;
        const { data } = await portalClient().get('/api/candidate-auth/me');
        set(s => ({ candidate: { ...s.candidate, ...data } }));
      },
    }),
    {
      name: 'candidate-auth',
      partialize: (s) => ({
        candidate: s.candidate,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    }
  )
);

/* Shared axios instance for the candidate session: attaches the current access
   token and refreshes it on 401 (redirecting to /candidate/login if that fails). */
let _client: AxiosInstance | null = null;
function portalClient(): AxiosInstance {
  if (!_client) {
    _client = createPortalClient({
      refreshPath: '/api/candidate-auth/refresh',
      loginPath: '/candidate/login',
      getTokens: () => useCandidateAuth.getState(),
      setTokens: (accessToken, refreshToken) => useCandidateAuth.setState({ accessToken, refreshToken }),
      clearSession: () => useCandidateAuth.setState({ candidate: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    });
  }
  return _client;
}

/**
 * Axios instance with candidate auth. The argument is kept for existing call sites;
 * the instance always uses the latest token from the store.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function candidateApi(_accessToken?: string | null): AxiosInstance {
  return portalClient();
}
