import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50" data-testid="auth-loading">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-800 border-t-transparent" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

    return children;
}
