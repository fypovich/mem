"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  token: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token;

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(currentToken);
      } else {
        logout();
      }
    } catch (e) {
      console.error("Auth refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = useCallback((newToken: string, username: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", username);
    setToken(newToken);
    setIsLoading(true);
    refreshUser();
  }, [refreshUser]);

  // Initial mount: check localStorage and verify token
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth-change events (from other tabs/windows)
  useEffect(() => {
    const handleAuthChange = () => {
      const t = localStorage.getItem("token");
      if (t) {
        setToken(t);
        refreshUser();
      } else {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, user, token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
