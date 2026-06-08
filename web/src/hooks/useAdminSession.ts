import { useCallback, useEffect, useState } from "react";
import {
  adminLogin,
  adminSession,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../api";

const STORAGE_KEY = "pad_admin_token";

export function useAdminSession() {
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

  return {
    adminEnabled,
    token,
    username,
    isSuperadmin: Boolean(username),
    checking,
    login,
    logout,
  };
}
