import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
    LayoutDashboard, BookOpen, Award, Bell, User, Settings,
    Users, BarChart3, FolderTree, GraduationCap, LogOut, Pencil, Wallet, Library,
} from "lucide-react";

const STUDENT_LINKS = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/dashboard/courses", label: "My Courses", icon: BookOpen },
    { to: "/courses", label: "Browse Catalog", icon: Library },
    { to: "/dashboard/certificates", label: "Certificates", icon: Award },
    { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
    { to: "/dashboard/profile", label: "Profile", icon: User },
];

const EDUCATOR_LINKS = [
    { to: "/educator/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/educator/courses", label: "My Courses", icon: BookOpen },
    { to: "/educator/courses/new", label: "Create Course", icon: Pencil },
    { to: "/educator/earnings", label: "Earnings", icon: Wallet },
    { to: "/dashboard/profile", label: "Profile", icon: User },
];

const ADMIN_LINKS = [
    { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/categories", label: "Categories", icon: FolderTree },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const links = user?.role === "ADMIN" ? ADMIN_LINKS
        : user?.role === "EDUCATOR" ? EDUCATOR_LINKS
            : STUDENT_LINKS;

    return (
        <aside className="hidden w-64 shrink-0 flex-col bg-brand-800 text-white md:flex" data-testid="sidebar">
            <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500">
                    <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight">LearnHub</span>
            </Link>

            <div className="px-4 py-4">
                <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">Signed in as</div>
                    <div className="mt-1 font-display font-semibold truncate">{user?.first_name} {user?.last_name}</div>
                    <div className="text-xs text-white/60 truncate">{user?.email}</div>
                    <div className="mt-2 inline-flex rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {user?.role}
                    </div>
                </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
                {links.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        data-testid={`sidebar-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                isActive ? "bg-brand-900 text-white shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
                            }`
                        }
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <button
                onClick={logout}
                data-testid="sidebar-logout"
                className="flex items-center gap-3 border-t border-white/10 px-6 py-4 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
            >
                <LogOut className="h-4 w-4" /> Log out
            </button>
        </aside>
    );
}
