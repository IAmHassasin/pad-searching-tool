import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminLogin,
  adminSession,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../api";

const STORAGE_KEY = "pad_admin_token";

export type AdminSession = {
  adminEnabled: boolean | null;
  token: string | null;
  username: string | null;
  isSuperadmin: boolean;
  checking: boolean;
  login: (user: string, pass: string) => Promise<unknown>;
  logout: () => void;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    getAdminToken(STORAGE_KEY)
  );
  const [username, setUsername] = useState<string | null>(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null);

  const logout = useCallback(() => {
    clearAdminToken(STORAGE_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  const login = useCallback(async (user: string, pass: string) => {
    const res = await adminLogin(user, pass);
    setAdminToken(STORAGE_KEY, res.token);
    setToken(res.token);
    setUsername(user);
    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/admin/config")
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setAdminEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setAdminEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUsername(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    adminSession(token)
      .then((s) => {
        if (!cancelled) {
          setUsername(s.username);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
          setChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const value = useMemo<AdminSession>(
    () => ({
      adminEnabled,
      token,
      username,
      isSuperadmin: Boolean(username),
      checking,
      login,
      logout,
    }),
    [adminEnabled, token, username, checking, login, logout]
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSession {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return ctx;
}
