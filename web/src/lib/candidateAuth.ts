import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

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
        const { accessToken } = get();
        try {
          if (accessToken) {
            await axios.post(`${API}/api/candidate-auth/logout`, {}, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          }
        } catch {}
        set({ candidate: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshProfile: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        const { data } = await axios.get(`${API}/api/candidate-auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
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

/* Axios instance pre-configured with candidate auth */
export function candidateApi(accessToken: string) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
