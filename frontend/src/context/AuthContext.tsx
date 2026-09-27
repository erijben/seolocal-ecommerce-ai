import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loginApi, logoutApi, meApi } from "../api/authApi";
import type { User } from "../types/auth";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(
    () => localStorage.getItem("token") !== null,
  );

  async function login(email: string, password: string) {
    const response = await loginApi(email, password);

    localStorage.setItem("token", response.data.token);
    setUser(response.data.user);
  }

  async function logout() {
    try {
      await logoutApi();
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadUser() {
      try {
        const response = await meApi();
        if (!cancelled) {
          setUser(response.data);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("token");
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
