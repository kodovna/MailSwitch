import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { setup } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    requiresAuth: false,
    setupCompleted: true, // assume true until we know otherwise
    token: null,
  });

  const checkAuth = useCallback(async () => {
    try {
      const [authData, setupData] = await Promise.all([
        fetch('/api/auth/status', { credentials: 'include' }).then((r) => r.json()),
        setup.getStatus(),
      ]);
      setState({
        loading: false,
        authenticated: authData.authenticated,
        requiresAuth: authData.requiresAuth,
        setupCompleted: setupData.setupCompleted,
        token: null,
      });
    } catch {
      setState({ loading: false, authenticated: false, requiresAuth: true, setupCompleted: true, token: null });
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setState((s) => ({ ...s, authenticated: true, token: data.token }));
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState((s) => ({ ...s, authenticated: false, token: null }));
  };

  const completeSetup = async (password) => {
    const data = await setup.complete(password);
    setState((s) => ({ ...s, authenticated: true, setupCompleted: true, requiresAuth: true, token: data.token }));
    return data;
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
