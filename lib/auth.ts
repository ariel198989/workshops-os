'use client';
import { sb } from './db';
import { ADMINS } from './config';
import { createStore } from './store';

export interface AuthState {
  user: { id: string; email?: string } | null;
  admin: boolean;
  viewer: boolean;
  loaded: boolean;
}

export const authStore = createStore<AuthState>({ user: null, admin: false, viewer: false, loaded: false });

export async function initAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user || null;
    const admin = !!(user && ADMINS.includes((user.email || '').toLowerCase()));
    authStore.set({ user, admin, loaded: true });
  } catch {
    authStore.set({ loaded: true });
  }
}

export async function login(email: string, pass: string) {
  const r = await sb.auth.signInWithPassword({ email, password: pass });
  if (r.error) throw r.error;
  await initAuth();
}

export async function logout() {
  await sb.auth.signOut();
  location.reload();
}
