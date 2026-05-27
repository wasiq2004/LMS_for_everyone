import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children, title, subtitle, action }) {
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden" data-testid="mobile-sidebar">
                    <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
                    <div className="relative h-full w-72 animate-fade-in">
                        <Sidebar />
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute right-3 top-3 z-10 rounded-lg bg-white/10 p-1.5 text-white"
                            data-testid="close-mobile-sidebar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
            <main className="flex-1 overflow-x-hidden">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
                    <div className="flex h-16 items-center justify-between px-4 lg:px-10">
                        <div className="flex items-center gap-3">
                            <button
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                                onClick={() => setMobileOpen(true)}
                                data-testid="open-mobile-sidebar"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                            </div>
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
                <div className="px-4 py-8 lg:px-10 animate-fade-in">{children}</div>
            </main>
        </div>
    );
}
