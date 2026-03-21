import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  full_name: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
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
  
  logout: () => {
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    set({ token: null, user: null });
  },
}));
