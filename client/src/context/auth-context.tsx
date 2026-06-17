import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useLocation } from 'wouter';
import { authApi, staffApi } from '@/lib/api';
import { waitMinElapsed } from '@/lib/login-splash';

interface AuthContextType {
  user: User | null;
  staff: User[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateStaff: (updated: User) => void;
  refreshStaff: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const startedAt = Date.now();
      try {
        const currentUser = await authApi.me();
        setUser(currentUser);
      } catch (error) {
        // Not logged in or session expired
        console.error('Auth check failed:', error);
      } finally {
        await waitMinElapsed(startedAt);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Load staff list when user is authenticated and has permission
  useEffect(() => {
    const role = (user?.role || "").toLowerCase();
    if (user && (role === "admin" || role === "md")) {
      refreshStaff();
    }
  }, [user]);

  const refreshStaff = async () => {
    try {
      const staffList = await staffApi.getAll();
      setStaff(staffList);
    } catch (error) {
      console.error('Failed to load staff:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const startedAt = Date.now();
    try {
      const loggedInUser = await authApi.login(email, password);
      await waitMinElapsed(startedAt);
      setUser(loggedInUser);
      setLocation('/auth/branch-select');
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const updateStaff = (updated: User) => {
    setStaff(prev => {
      const index = prev.findIndex(s => s.id === updated.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = updated;
        return next;
      }
      return [...prev, updated];
    });

    if (user && user.id === updated.id) {
      setUser(updated);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      setStaff([]);
      setLocation('/auth/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, staff, login, logout, updateStaff, refreshStaff, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
