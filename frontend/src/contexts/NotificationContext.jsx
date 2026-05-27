import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const socketRef = useRef(null);

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get("/notifications");
            setItems(data.data);
            setUnread(data.unread_count || 0);
        } catch { /* ignore */ }
    }, [user]);

    // Initial fetch & on user change
    useEffect(() => { load(); }, [load]);

    // Connect socket on login
    useEffect(() => {
        if (!user) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }
        const token = localStorage.getItem("access_token");
        const url = process.env.REACT_APP_BACKEND_URL;
        const socket = io(url, {
            path: "/socket.io",
            transports: ["polling", "websocket"],
            auth: { token },
            withCredentials: true,
        });
        socketRef.current = socket;

        socket.on("notification", (payload) => {
            setItems((p) => [payload, ...p]);
            setUnread((n) => n + 1);
            toast(payload.title, { description: payload.message });
        });

        return () => { socket.disconnect(); socketRef.current = null; };
    }, [user]);

    const markRead = async (id) => {
        await api.patch(`/notifications/${id}/read`);
        setItems((p) => p.map((n) => n.id === id ? { ...n, is_read: true } : n));
        setUnread((n) => Math.max(0, n - 1));
    };
    const markAllRead = async () => {
        await api.patch("/notifications/read-all");
        setItems((p) => p.map((n) => ({ ...n, is_read: true })));
        setUnread(0);
    };

    return (
        <NotificationContext.Provider value={{ items, unread, refresh: load, markRead, markAllRead }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
    return ctx;
}
