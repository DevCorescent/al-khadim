import { create } from 'zustand';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

export interface SiteTheme {
  primaryColor: string; primaryDark: string; primaryLight: string;
  accentColor: string; bgColor: string; textColor: string;
  navBg: string; footerBg: string; footerText: string;
  btnRadius: string; cardRadius: string; fontFamily: string;
}

export interface NavLink { label: string; href: string; }
export interface FooterLink { label: string; href: string; }
export interface FooterColumn { title: string; links: FooterLink[]; }

export interface SiteConfigState {
  theme:    any;
  navbar:   any;
  hero:     any;
  sections: any;
  footer:   any;
  loaded:   boolean;
  fetchConfig: () => Promise<void>;
  updateSection: (key: string, value: any, token: string) => Promise<void>;
  uploadImage: (file: File, token: string) => Promise<string>;
}

export const useSiteConfig = create<SiteConfigState>((set, get) => ({
  theme: null, navbar: null, hero: null, sections: null, footer: null, loaded: false,

  fetchConfig: async () => {
    try {
      const { data } = await axios.get(`${API}/api/site-config`);
      set({ ...data, loaded: true });
      applyTheme(data.theme);
    } catch (e) {
      set({ loaded: true });
    }
  },

  updateSection: async (key, value, token) => {
    const { data } = await axios.put(`${API}/api/site-config/${key}`, value, {
      headers: { Authorization: `Bearer ${token}` },
    });
    set({ [key]: data });
    if (key === 'theme') applyTheme(data);
  },

  uploadImage: async (file, token) => {
    const fd = new FormData();
    fd.append('image', file);
    const { data } = await axios.post(`${API}/api/site-config/upload/image`, fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  },
}));

export function applyTheme(theme: any) {
  if (!theme || typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme.primaryColor) {
    root.style.setProperty('--color-primary', theme.primaryColor);
    root.style.setProperty('--color-primary-dark', theme.primaryDark || theme.primaryColor);
    root.style.setProperty('--color-primary-light', theme.primaryLight || '#eff6ff');
  }
  if (theme.accentColor) root.style.setProperty('--color-accent', theme.accentColor);
  if (theme.bgColor)     root.style.setProperty('--color-bg', theme.bgColor);
  if (theme.textColor)   root.style.setProperty('--color-text', theme.textColor);
  if (theme.navBg)       root.style.setProperty('--color-nav-bg', theme.navBg);
  if (theme.footerBg)    root.style.setProperty('--color-footer-bg', theme.footerBg);
  if (theme.footerText)  root.style.setProperty('--color-footer-text', theme.footerText);
  if (theme.btnRadius)   root.style.setProperty('--radius-btn', theme.btnRadius);
  if (theme.cardRadius)  root.style.setProperty('--radius-card', theme.cardRadius);
}
