import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GraduationCap, LogOut, LayoutDashboard, BookOpen, User } from "lucide-react";

function initials(u) {
    if (!u) return "?";
    return `${(u.first_name || "")[0] || ""}${(u.last_name || "")[0] || ""}`.toUpperCase() || u.email?.[0]?.toUpperCase();
}

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const dashboardLink =
        user?.role === "ADMIN" ? "/admin/dashboard"
            : user?.role === "EDUCATOR" ? "/educator/dashboard"
                : "/dashboard";

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link to="/" className="flex items-center gap-2" data-testid="navbar-logo">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-white">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="font-display text-xl font-bold tracking-tight text-slate-900">LearnHub</span>
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    <Link to="/courses" className="text-sm font-medium text-slate-700 hover:text-brand-800" data-testid="nav-courses">Courses</Link>
                    <Link to="/certificate/verify" className="text-sm font-medium text-slate-700 hover:text-brand-800" data-testid="nav-verify">Verify Cert</Link>
                </nav>

                <div className="flex items-center gap-3">
                    {!user ? (
                        <>
                            <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-btn">Log in</Button>
                            <Button className="bg-brand-800 hover:bg-brand-900" onClick={() => navigate("/register")} data-testid="nav-register-btn">
                                Get started
                            </Button>
                        </>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100" data-testid="navbar-user-menu">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.avatar} />
                                        <AvatarFallback className="bg-brand-800 text-white">{initials(user)}</AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="font-display">{user.first_name} {user.last_name}</div>
                                    <div className="text-xs font-normal text-slate-500">{user.email}</div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate(dashboardLink)} data-testid="menu-dashboard">
                                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                                </DropdownMenuItem>
                                {user.role === "STUDENT" && (
                                    <DropdownMenuItem onClick={() => navigate("/dashboard/courses")} data-testid="menu-my-courses">
                                        <BookOpen className="mr-2 h-4 w-4" /> My Courses
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => navigate("/dashboard/profile")} data-testid="menu-profile">
                                    <User className="mr-2 h-4 w-4" /> Profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="menu-logout">
                                    <LogOut className="mr-2 h-4 w-4" /> Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    );
}
