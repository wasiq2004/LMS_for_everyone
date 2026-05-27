import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
    const { login, formatApiError } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const u = await login(email, password);
            toast.success("Welcome back!");
            const dest = u.role === "ADMIN" ? "/admin/dashboard"
                : u.role === "EDUCATOR" ? "/educator/dashboard"
                    : (location.state?.from?.pathname || "/dashboard");
            navigate(dest, { replace: true });
        } catch (err) {
            toast.error(formatApiError(err));
        } finally { setLoading(false); }
    };

    return (
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
            <div className="hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between"
                style={{
                    backgroundImage: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)",
                }}>
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="font-display text-xl font-bold">LearnHub</span>
                </Link>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">Welcome back</div>
                    <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight">
                        Continue your learning journey.
                    </h1>
                    <p className="mt-4 max-w-md text-white/80">
                        Pick up where you left off, explore new tracks, and earn certificates that move your career forward.
                    </p>
                </div>
                <div className="text-xs text-white/40">
                    "The structure and projects helped me ship my first React app to production." — Priya P.
                </div>
            </div>

            <div className="flex items-center justify-center bg-slate-50 p-8">
                <Card className="w-full max-w-md border-slate-200 p-8 shadow-lg">
                    <h2 className="font-display text-2xl font-bold text-slate-900">Sign in</h2>
                    <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your details below.</p>
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="login-email" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link to="/forgot-password" className="text-xs text-brand-800 hover:underline">Forgot?</Link>
                            </div>
                            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" data-testid="login-password" />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-brand-800 hover:bg-brand-900" data-testid="login-submit">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                        </Button>
                    </form>
                    <p className="mt-6 text-center text-sm text-slate-600">
                        Don't have an account? <Link to="/register" className="font-medium text-brand-800 hover:underline">Sign up</Link>
                    </p>

                    <div className="mt-6 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                        <div className="font-semibold">Demo accounts:</div>
                        <div className="mt-1">admin@lms.com / Admin@123</div>
                        <div>sarah.chen@lms.com / Educator@123</div>
                        <div>alex.kim@example.com / Student@123</div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
