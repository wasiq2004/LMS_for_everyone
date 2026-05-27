import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({ children, title, subtitle, action }) {
    const { user } = useAuth();
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
                    <div className="flex h-16 items-center justify-between px-6 lg:px-10">
                        <div>
                            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                        </div>
                        <div className="flex items-center gap-4">
                            {action}
                            <NotificationBell />
                            <div className="hidden text-right md:block">
                                <div className="text-sm font-semibold text-slate-900">{user?.first_name} {user?.last_name}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">{user?.role}</div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="px-6 py-8 lg:px-10 animate-fade-in">{children}</div>
            </main>
        </div>
    );
}
