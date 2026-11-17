import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import type { SignupInput, User } from "../types";

interface AuthValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => api.getSession());

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const u = await api.signup(input);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  // Re-reads the account (for example after an admin approves a seller).
  const refreshUser = useCallback(async () => {
    setUser(await api.refreshSession());
  }, []);

  const value = useMemo(
    () => ({ user, login, signup, logout, refreshUser }),
    [user, login, signup, logout, refreshUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const homeFor = (user: User): string =>
  user.role === "admin" ? "/admin" : user.role === "seller" ? "/seller" : "/";
