import { create } from 'zustand';

interface User {
  id: number;
  username?: string | null;
  email: string;
  full_name: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  last_seen?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('messenger_token'),
  user: localStorage.getItem('messenger_user') ? JSON.parse(localStorage.getItem('messenger_user')!) : null,
  
  login: (token, user) => {
    localStorage.setItem('messenger_token', token);
    localStorage.setItem('messenger_user', JSON.stringify(user));
    set({ token, user });
  },

  updateUser: (user) => {
    localStorage.setItem('messenger_user', JSON.stringify(user));
    set({ user });
  },
  
  logout: () => {
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    set({ token: null, user: null });
  },
}));
