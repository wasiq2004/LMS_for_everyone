import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data.data);
        } catch {
            setUser(null);
            localStorage.removeItem("access_token");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        if (data?.access_token) localStorage.setItem("access_token", data.access_token);
        setUser(data.data);
        return data.data;
    };

    const register = async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        if (data?.access_token) localStorage.setItem("access_token", data.access_token);
        setUser(data.data);
        return data.data;
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch { /* ignore */ }
        localStorage.removeItem("access_token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refresh: fetchMe, formatApiError }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
