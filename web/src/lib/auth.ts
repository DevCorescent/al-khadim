import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from './api';
import { hasPermission, type Permissions } from './permissions';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  /** Name of the user's custom role, if any. */
  customRole?: string | null;
  /** Effective permissions `{ module: action[] }` as computed by the server. */
  permissions?: Permissions;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  /** Revokes the session server-side (best effort), then clears local tokens. */
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** Re-reads the user (role, custom role, permissions) from GET /auth/me. */
  refreshMe: () => Promise<void>;
  /** Whether the current user may perform `action` on `module` (SUPER_ADMIN → always). */
  can: (module: string, action?: string) => boolean;
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({ user: data.user, isAuthenticated: true });
      },
      logout: async () => {
        try {
          if (localStorage.getItem('accessToken')) {
            await api.post('/auth/logout', {}, { timeout: 5000, forbiddenToast: false });
          }
        } catch { /* best effort — the local session is cleared regardless */ }
        clearTokens();
        set({ user: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user, isAuthenticated: true }),
      refreshMe: async () => {
        const { data } = await api.get('/auth/me', { forbiddenToast: false });
        const current = get().user;
        set({
          user: {
            ...(current || {}),
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            avatar: data.avatar ?? undefined,
            customRole: data.customRole ?? null,
            permissions: data.permissions || {},
          },
          isAuthenticated: true,
        });
      },
      can: (module, action = 'view') => hasPermission(get().user, module, action),
    }),
    {
      name: 'alkhadim-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Hook form of `can` that re-renders when the user's permissions change. */
export function useCan() {
  const user = useAuth((s) => s.user);
  return (module: string, action = 'view') => hasPermission(user, module, action);
}
